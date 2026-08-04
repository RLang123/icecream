import test from "node:test";
import assert from "node:assert/strict";
import {
  getMenuAvailability,
  normalizeProjectIngredientData,
  soldOutReason,
} from "../worker/menu-availability.js";

const store = (a = true, b = true) => ({
  ingredients: [
    { id: "a", name: "재료 A", available: a },
    { id: "b", name: "재료 B", available: b },
  ],
});

test("연결 재료가 정상이면 판매 가능하고 소진되면 품절된다", () => {
  const item = { ingredientIds: ["a"], soldout: false };
  assert.equal(getMenuAvailability(item, store()).soldOut, false);
  const unavailable = getMenuAvailability(item, store(false));
  assert.equal(unavailable.soldOut, true);
  assert.equal(soldOutReason(unavailable), "재료 소진: 재료 A");
});

test("복수 재료 중 하나만 소진되어도 품절되고 복구 시 판매 재개된다", () => {
  const item = { ingredientIds: ["a", "b"], soldout: false };
  assert.equal(getMenuAvailability(item, store(true, false)).soldOut, true);
  assert.equal(getMenuAvailability(item, store(true, true)).soldOut, false);
});

test("수동 품절은 재료 복구와 무관하게 유지된다", () => {
  const availability = getMenuAvailability(
    { ingredientIds: ["a"], soldout: true },
    store(true),
  );
  assert.equal(availability.soldOut, true);
  assert.equal(soldOutReason(availability), "수동 품절");
});

test("재료 연결이 없는 과거 메뉴는 판매 가능하다", () => {
  assert.equal(getMenuAvailability({ soldout: false }, {}).soldOut, false);
});

test("존재하지 않는 재료 ID는 읽기 호환 정규화에서 제거된다", () => {
  const normalized = normalizeProjectIngredientData({store:{ingredients:[{id:"a",name:"A"}]},items:[{id:"m",ingredientIds:["missing"]}]});
  assert.deepEqual(normalized.items[0].ingredientIds, []);
});

test("과거 데이터는 빈 배열로 보정하고 고아 및 중복 참조를 제거한다", () => {
  const normalized = normalizeProjectIngredientData({
    store: {},
    items: [{ id: 1 }, { id: 2, ingredientIds: ["missing"] }],
  });
  assert.deepEqual(normalized.store.ingredients, []);
  assert.deepEqual(normalized.items.map((item) => item.ingredientIds), [[], []]);

  const withIngredients = normalizeProjectIngredientData({
    store: { ingredients: [{ id: "a", name: "재료 A" }] },
    items: [{ id: 1, ingredientIds: ["a", "a", "missing"] }],
  });
  assert.deepEqual(withIngredients.items[0].ingredientIds, ["a"]);
  assert.equal(withIngredients.store.ingredients[0].available, true);
});
