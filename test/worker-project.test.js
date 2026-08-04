import test from "node:test";
import assert from "node:assert/strict";
import { api, projectError } from "../worker/index.js";

test("저장 후 다시 불러와도 재료 상태와 메뉴 연결이 유지된다", async () => {
  let savedProject = null;
  const env = {
    DB: {
      prepare(sql) {
        let values = [];
        return {
          bind(...args) {
            values = args;
            return this;
          },
          async first() {
            if (sql.includes("FROM sessions JOIN users")) {
              return { id: "seller-1", email: "seller@test.dev", name: "판매자", role: "seller" };
            }
            if (sql === "SELECT slug FROM projects WHERE owner_id=?") {
              return savedProject ? { slug: savedProject.slug } : null;
            }
            if (sql === "SELECT data,slug FROM projects WHERE owner_id=?") {
              return savedProject;
            }
            throw new Error(`Unexpected first query: ${sql}`);
          },
          async run() {
            if (sql.startsWith("INSERT INTO projects")) {
              savedProject = { data: values[1], slug: values[2] };
              return { meta: { changes: 1 } };
            }
            throw new Error(`Unexpected run query: ${sql}`);
          },
        };
      },
    },
  };
  const data = {
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
  };
  const headers = { cookie: "session=test-session", "content-type": "application/json" };
  const putResponse = await api(new Request("https://example.com/api/project", {
    method: "PUT",
    headers,
    body: JSON.stringify({ data }),
  }), env, { waitUntil() {} });
  assert.equal(putResponse.status, 200);

  const getResponse = await api(new Request("https://example.com/api/project", {
    headers: { cookie: "session=test-session" },
  }), env, { waitUntil() {} });
  const result = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(result.data.store.ingredients[0].available, false);
  assert.equal(result.data.store.ingredients[0].name, "재료 A");
  assert.deepEqual(result.data.items[0].ingredientIds, ["a"]);
});

test("잘못된 프로젝트 데이터와 고아 재료 참조를 구체적으로 거부한다", () => {
  assert.match(projectError({store:{name:"매장",ingredients:[]},categories:["전체","전체"],items:[]}),/중복/);
  assert.match(projectError({store:{name:"매장",ingredients:[]},categories:["전체"],items:[{id:"m",name:"메뉴",price:1000,category:"전체",ingredientIds:["missing"]}]}),/존재하지 않는 재료/);
  assert.match(projectError({store:{name:"매장",ingredients:[]},categories:["전체"],items:[{id:"m",name:"메뉴",price:-1,category:"전체"}]}),/가격/);
});

test("프로젝트 변경 후 공개 매장 API가 최신 데이터를 반환한다", async () => {
  let name='이전 메뉴';
  const env={DB:{prepare(){return{bind(){return this;},async first(){return{slug:'store-refresh1',updated_at:'now',data:JSON.stringify({store:{name:'매장'},categories:['전체'],items:[{id:'m',name,price:1000}]})};}};}}};
  const request=()=>new Request('https://example.com/api/store/store-refresh1');
  assert.equal((await (await api(request(),env,{})).json()).data.items[0].name,'이전 메뉴');
  name='최신 메뉴';
  const response=await api(request(),env,{});assert.equal(response.headers.get('cache-control'),'public, max-age=5, s-maxage=5, must-revalidate');assert.equal((await response.json()).data.items[0].name,'최신 메뉴');
});
