import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../worker/index.js";

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
            assert.match(sql, /^DELETE FROM orders/);
            return { meta: { changes: 0 } };
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
  assert.match(result.error, /A 메뉴/);
  assert.match(result.error, /재료 A/);
});
