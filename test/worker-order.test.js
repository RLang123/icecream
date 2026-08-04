import test from "node:test";
import assert from "node:assert/strict";
import { api, orderNumber } from "../worker/index.js";

test("주문번호는 기존 UUID에서도 항상 10자리 숫자로 표시된다", () => {
  const number = orderNumber("6f44b4b2-32fb-47d7-8f4f-23aa72b59c34");
  assert.match(number, /^\d{10}$/);
  assert.equal(orderNumber("6f44b4b2-32fb-47d7-8f4f-23aa72b59c34"), number);
});

test("판매자는 취소·환불 주문을 영구 삭제할 수 있다", async () => {
  let deletedWith;
  const env={DB:{prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){if(sql.includes("FROM sessions JOIN users"))return{id:"seller-1",email:"seller@account.geno",name:"판매자",role:"seller"};throw new Error(sql);},async run(){assert.match(sql,/DELETE FROM orders/);deletedWith=args;return{meta:{changes:1}};}};}}};
  const response=await api(new Request("https://example.com/api/orders/order-1",{method:"DELETE",headers:{cookie:"session=session-1"}}),env,{});
  assert.equal(response.status,200);
  assert.deepEqual(deletedWith,["order-1","seller-1"]);
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
  const env = { DB: { prepare(sql) { let args=[]; return { bind(...values){args=values;return this;}, async first(){ if(sql.includes("FROM projects")) return project; if(sql.includes("request_key")) return null; throw new Error(sql); }, async run(){ assert.match(sql,/INSERT OR IGNORE/); inserted=args; return {meta:{changes:1}}; } }; } } };
  const response = await api(new Request("https://example.com/api/orders", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({storeSlug:"store-test1234",items:[{id:"menu-1",qty:2,temperature:"ICE",size:"S",price:1}],requestKey:"price-recalc-123456"}) }), env, {waitUntil(){}});
  const result = await response.json();
  assert.equal(response.status,201);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(result.total,14000);
  assert.equal(inserted[5],14000);
});

test("동일 request_key의 주문은 기존 주문을 반환한다", async () => {
  const project = { owner_id:"seller-1", data:JSON.stringify({store:{name:"매장",ingredients:[]},categories:["전체"],items:[{id:"m",name:"메뉴",price:1000,temperatureMode:"none",sizesEnabled:false}]}) };
  const env={DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes("FROM projects"))return project;if(sql.includes("request_key"))return{id:"existing-order",total:1000};throw new Error(sql);},async run(){throw new Error("insert must not run");}};}}};
  const response=await api(new Request("https://example.com/api/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({storeSlug:"store-test1234",items:[{id:"m",qty:1}],requestKey:"duplicate-key-1234"})}),env,{waitUntil(){}});
  assert.equal(response.status,200);
  assert.equal((await response.json()).deduplicated,true);
});

test("동시에 같은 request_key가 제출돼도 한 건만 생성된다", async () => {
  const project={owner_id:'seller-1',data:JSON.stringify({store:{name:'매장'},categories:['전체'],items:[{id:'m',name:'메뉴',price:1000,temperatureMode:'none',sizesEnabled:false}]})};
  let saved=null;let inserts=0;
  const env={DB:{prepare(sql){let args=[];return{bind(...values){args=values;return this;},async first(){if(sql.includes('FROM projects'))return project;if(sql.includes('request_key'))return saved;throw new Error(sql);},async run(){if(!sql.startsWith('INSERT OR IGNORE'))throw new Error(sql);await Promise.resolve();if(saved)return{meta:{changes:0}};inserts+=1;saved={id:args[0],total:args[5]};return{meta:{changes:1}};}};}}};
  const request=()=>new Request('https://example.com/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({storeSlug:'store-test1234',items:[{id:'m',qty:1}],requestKey:'concurrent-key-12345'})});
  const responses=await Promise.all([api(request(),env,{}),api(request(),env,{})]);
  assert.equal(inserts,1);assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);
});
