import test from "node:test";
import assert from "node:assert/strict";
import { api, publicOrderNumber } from "../worker/index.js";
import { readFile } from "node:fs/promises";

test("공개 주문번호는 1~100 정수만 허용한다", () => {
  assert.equal(publicOrderNumber(1),1);
  assert.equal(publicOrderNumber("100"),100);
  assert.equal(publicOrderNumber(0),null);
  assert.equal(publicOrderNumber(101),null);
  assert.equal(publicOrderNumber("uuid-order"),null);
});

test("0009는 1~100 CHECK와 실제 활성 상태 부분 UNIQUE 인덱스를 추가한다", async () => {
  const migration=await readFile(new URL("../migrations/0009_order_display_numbers.sql",import.meta.url),"utf8");
  assert.match(migration,/ALTER TABLE orders ADD COLUMN display_order_number INTEGER/);
  assert.match(migration,/BETWEEN 1 AND 100/);
  assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_seller_active_display_number/);
  assert.match(migration,/WHERE status IN \('new', 'preparing'\)/);
  assert.doesNotMatch(migration,/DELETE|DROP/i);
});

test("서버가 가장 작은 빈 번호를 원자적으로 배정하고 100에서 멈춘다", async () => {
  const source=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
  assert.match(source,/WITH RECURSIVE numbers\(n\) AS \(VALUES\(1\) UNION ALL SELECT n\+1 FROM numbers WHERE n<100\) INSERT OR IGNORE INTO orders/);
  assert.match(source,/ORDER BY numbers\.n LIMIT 1/);
  assert.match(source,/ORDER_NUMBERS_EXHAUSTED/);
  assert.match(source,/현재 사용 가능한 주문번호가 없습니다\. 진행 중인 주문을 먼저 완료해 주세요\./);
  assert.doesNotMatch(source,/Math\.random\(\).*display_order_number/);
});

test("일반 화면과 CSV는 UUID 해시나 0 채움 없이 표시번호만 사용한다", async () => {
  const source=await readFile(new URL("../src/main.jsx",import.meta.url),"utf8");
  assert.match(source,/const numericOrderNumber =/);
  assert.match(source,/display_order_number/);
  assert.doesNotMatch(source,/padStart\(/);
  assert.doesNotMatch(source,/slice\(-10\)/);
});

test("결제 기록이 없는 마감 전 취소·환불 주문만 영구 삭제할 수 있다", async () => {
  let deletedWith;let deleteSql;
  const env={DB:{prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){if(sql.includes("FROM sessions JOIN users"))return{id:"seller-1",email:"seller@account.geno",name:"판매자",role:"seller"};throw new Error(sql);},async run(){assert.match(sql,/DELETE FROM orders/);deleteSql=sql;deletedWith=args;return{meta:{changes:1}};}};}}};
  const response=await api(new Request("https://example.com/api/orders/order-1",{method:"DELETE",headers:{cookie:"session=session-1"}}),env,{});
  assert.equal(response.status,200);
  assert.deepEqual(deletedWith,["order-1","seller-1"]);
  assert.match(deleteSql,/details_cleaned_at IS NULL/);
  assert.match(deleteSql,/NOT EXISTS \(SELECT 1 FROM payment_attempts/);
});

test("진행 중 주문은 삭제할 수 없다", async () => {
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes("FROM sessions JOIN users"))return{id:"seller-1",email:"seller@account.geno",name:"판매자",role:"seller"};throw new Error(sql);},async run(){return{meta:{changes:0}};}};}}};
  const response=await api(new Request("https://example.com/api/orders/order-1",{method:"DELETE",headers:{cookie:"session=session-1"}}),env,{});
  assert.equal(response.status,409);
  assert.match((await response.json()).error,/취소 또는 환불/);
});

test("장바구니에 담은 뒤 재료가 소진되면 주문 API가 메뉴와 재료명을 알려주며 차단한다", async () => {
  const project = {
    owner_id: "seller-1",
    data: JSON.stringify({
      store: {
        name: "테스트 매장",
        ingredients: [{ id: "a", name: "재료 A", available: false }],
      },
      categories: ["전체"],
      items: [{
        id: "menu-1",
        name: "A 메뉴",
        price: 5000,
        ingredientIds: ["a"],
        soldout: false,
      }],
    }),
  };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return this;
          },
          async run() {
            throw new Error(`Unexpected run query: ${sql}`);
          },
          async first() {
            assert.match(sql, /SELECT owner_id,data FROM projects/);
            return project;
          },
        };
      },
    },
  };
  const request = new Request("https://example.com/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      storeSlug: "store-test1234",
      items: [{ id: "menu-1", qty: 1, temperature: "HOT", size: "L" }],
      requestKey: "12345678-1234-1234-1234-123456789012",
    }),
  });

  const response = await api(request, env, { waitUntil() {} });
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(result.error, /A 메뉴/);
  assert.match(result.error, /재료 A/);
});

test("수동 품절 메뉴는 API 직접 호출로도 주문할 수 없다", async () => {
  const project={owner_id:'seller-1',data:JSON.stringify({store:{name:'매장'},categories:['전체'],items:[{id:'sold',name:'수동 품절 메뉴',price:1000,soldout:true,temperatureMode:'none',sizesEnabled:false}]})};
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes('FROM projects'))return project;throw new Error(sql);},async run(){throw new Error('must not insert');}};}}};
  const response=await api(new Request('https://example.com/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({storeSlug:'store-test1234',items:[{id:'sold',qty:1}],requestKey:'manual-soldout-1234'})}),env,{});
  assert.equal(response.status,409);assert.match((await response.json()).error,/수동 품절 메뉴.*수동 품절/);
});

test("서버가 클라이언트 가격을 무시하고 최신 메뉴 가격으로 계산한다", async () => {
  let inserted;
  const project = { owner_id: "seller-1", data: JSON.stringify({ store: { name: "매장", ingredients: [] }, categories: ["전체"], items: [{ id: "menu-1", name: "메뉴", price: 7000, soldout: false, ingredientIds: [], temperatureMode: "none", sizesEnabled: false }] }) };
  const env = { DB: { prepare(sql) { let args=[]; return { bind(...values){args=values;return this;}, async first(){ if(sql.includes("FROM projects")) return project; if(sql.includes("request_key")) return null; if(sql.startsWith("SELECT display_order_number")) return {display_order_number:1}; throw new Error(sql); }, async run(){ assert.match(sql,/INSERT OR IGNORE/); inserted=args; return {meta:{changes:1}}; } }; } } };
  const response = await api(new Request("https://example.com/api/orders", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({storeSlug:"store-test1234",items:[{id:"menu-1",qty:2,temperature:"ICE",size:"S",price:1}],requestKey:"price-recalc-123456"}) }), env, {waitUntil(){}});
  const result = await response.json();
  assert.equal(response.status,201);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(result.total,14000);
  assert.equal(result.number,1);
  assert.equal(inserted[5],14000);
});

test("동일 request_key의 주문은 기존 주문을 반환한다", async () => {
  const project = { owner_id:"seller-1", data:JSON.stringify({store:{name:"매장",ingredients:[]},categories:["전체"],items:[{id:"m",name:"메뉴",price:1000,temperatureMode:"none",sizesEnabled:false}]}) };
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes("FROM projects"))return project;if(sql.includes("request_key"))return{id:"existing-order",total:1000,display_order_number:7};throw new Error(sql);},async run(){throw new Error("insert must not run");}};}}};
  const response=await api(new Request("https://example.com/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({storeSlug:"store-test1234",items:[{id:"m",qty:1}],requestKey:"duplicate-key-1234"})}),env,{waitUntil(){}});
  assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.deduplicated,true);assert.equal(result.number,7);
});

test("동시에 같은 request_key가 제출돼도 한 건만 생성된다", async () => {
  const project={owner_id:'seller-1',data:JSON.stringify({store:{name:'매장'},categories:['전체'],items:[{id:'m',name:'메뉴',price:1000,temperatureMode:'none',sizesEnabled:false}]})};
  let saved=null;let inserts=0;
  const env={DB:{prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){if(sql.includes('FROM projects'))return project;if(sql.includes('request_key'))return saved;if(sql.startsWith('SELECT display_order_number'))return{display_order_number:saved?.display_order_number};throw new Error(sql);},async run(){if(!sql.includes('INSERT OR IGNORE INTO orders'))throw new Error(sql);await Promise.resolve();if(saved)return{meta:{changes:0}};inserts+=1;saved={id:args[0],total:args[5],display_order_number:1};return{meta:{changes:1}};}};}}};
  const request=()=>new Request('https://example.com/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({storeSlug:'store-test1234',items:[{id:'m',qty:1}],requestKey:'concurrent-key-12345'})});
  const responses=await Promise.all([api(request(),env,{}),api(request(),env,{})]);
  assert.equal(inserts,1);assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);
});

test("판매자 주문 목록은 소유권과 기본 50·최대 100 페이지 제한을 SQL에 바인딩한다", async () => {
  const calls=[];
  const env={DB:{prepare(sql){let args=[];return{bind(...values){args=values;calls.push({sql,args});return this;},async first(){if(sql.includes('FROM sessions JOIN users'))return{id:'seller-1',email:'seller@test.invalid',name:'판매자',role:'seller'};throw new Error(sql);},async all(){return{results:[]};}};}}};
  const first=await api(new Request('https://example.com/api/orders',{headers:{cookie:'session=list-default','x-forwarded-for':`list-${crypto.randomUUID()}`}}),env,{});
  assert.deepEqual(await first.json(),{orders:[],page:1,limit:50});
  const capped=await api(new Request('https://example.com/api/orders?limit=999&page=2',{headers:{cookie:'session=list-capped','x-forwarded-for':`list-${crypto.randomUUID()}`}}),env,{});
  assert.deepEqual(await capped.json(),{orders:[],page:2,limit:100});
  const listCalls=calls.filter(call=>call.sql.includes('FROM orders WHERE seller_id=?'));
  assert.ok(listCalls.every(call=>/WHERE seller_id=\? ORDER BY created_at DESC LIMIT \? OFFSET \?/.test(call.sql)));
  assert.deepEqual(listCalls.map(call=>call.args),[['seller-1',50,0],['seller-1',100,100]]);
});

test("주문 식별자 SQL 인젝션은 판매자 소유권 바인딩 밖으로 나가지 않는다", async () => {
  let orderQuery=false;
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes('FROM sessions JOIN users'))return{id:'seller-1',email:'seller@test.invalid',name:'판매자',role:'seller'};orderQuery=true;return null;}};}}};
  const injected=encodeURIComponent("x' OR 1=1 --");
  const response=await api(new Request(`https://example.com/api/orders/${injected}`,{method:'PATCH',headers:{cookie:'session=sql-injection','content-type':'application/json'},body:JSON.stringify({status:'preparing'})}),env,{});
  assert.equal(response.status,400);
  assert.equal(orderQuery,false);
});
