import test from "node:test";
import assert from "node:assert/strict";
import { priceOrderItems, projectError } from "../worker/index.js";

const storeData = {
  store: { name: "가격 검증 매장", shotPrice: 500, ingredients: [] },
  categories: ["전체"],
  items: [
    { id: "snack", name: "과자", price: 1500, sizesEnabled: false, temperatureMode: "none" },
    { id: "latte", name: "라테", price: 3000, smallPrice: 3000, largePrice: 4000, sizesEnabled: true, temperatureMode: "both", shotsEnabled: true },
  ],
};

test("서버 가격 계산은 1,500원 상품의 수량을 정확히 반영한다", () => {
  assert.equal(priceOrderItems([{ id: "snack", qty: 1 }], storeData).total, 1500);
  assert.equal(priceOrderItems([{ id: "snack", qty: 2 }], storeData).total, 3000);
});

test("S/L·옵션·혼합 메뉴를 서버 가격으로 합산하고 클라이언트 가격은 무시한다", () => {
  const priced = priceOrderItems([
    { id: "latte", size: "S", temperature: "ICE", shots: 0, qty: 1, price: 1 },
    { id: "latte", size: "L", temperature: "HOT", shots: 2, qty: 1, price: 1 },
    { id: "snack", qty: 2, price: 999999 },
  ], storeData);
  assert.deepEqual(priced.items.map((item) => item.price), [3000, 5000, 1500]);
  assert.equal(priced.total, 11000);
  assert.equal(priced.items.reduce((sum, item) => sum + item.price * item.qty, 0), priced.total);
});

test("문자열·소수·음수·NaN 메뉴 가격과 문자열 수량은 거부한다", () => {
  for (const invalid of ["1500", 1.5, -1, Number.NaN]) {
    const data = structuredClone(storeData); data.items[0].price = invalid;
    assert.match(projectError(data), /가격/);
    assert.throws(() => priceOrderItems([{ id: "snack", qty: 1 }], data), /INVALID_PRICE/);
  }
  assert.throws(() => priceOrderItems([{ id: "snack", qty: "2" }], storeData), /INVALID_QUANTITY/);
});

test("주문 가격 스냅샷은 이후 메뉴 가격 변경과 무관하다", () => {
  const created = priceOrderItems([{ id: "snack", qty: 2 }], storeData);
  const stored = structuredClone(created.items);
  const changed = structuredClone(storeData); changed.items[0].price = 9000;
  assert.equal(stored.reduce((sum, item) => sum + item.price * item.qty, 0), 3000);
  assert.equal(priceOrderItems([{ id: "snack", qty: 2 }], changed).total, 18000);
});
