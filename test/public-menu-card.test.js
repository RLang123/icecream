import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const responsive = await readFile(new URL("../src/responsive.css", import.meta.url), "utf8");

test("소비자 메뉴 카드는 API의 이름·가격·설명 또는 재료 정보를 유지한다", () => {
  assert.match(main, /<h3>\{item\.name\}<\/h3>/);
  assert.match(main, /<strong>\{won\(item\.largePrice \?\? item\.price\)\}<\/strong>/);
  assert.match(main, /String\(item\.desc \|\| ""\)\.trim\(\) \|\| ingredientSummary \|\| item\.category/);
  assert.match(main, /<p>\{menuSummary\}<\/p>/);
  assert.match(main, /item\.badge && <b>\{item\.badge\}<\/b>/);
  assert.match(main, /availability\.soldOut && <i>\{t\.soldout\}<\/i>/);
});

test("모바일 공개 메뉴 그리드는 콘텐츠 높이로 행을 만들고 텍스트를 자르지 않는다", () => {
  assert.match(responsive, /\.kiosk \.product-grid\{grid-auto-rows:max-content\}/);
  assert.match(responsive, /\.kiosk \.product\{height:max-content;align-self:start\}/);
  assert.match(responsive, /\.customer-page\.public \.product-info h3\{[^}]*overflow-wrap:anywhere/);
  assert.match(responsive, /\.customer-page\.public \.product-info p\{[^}]*white-space:normal/);
  assert.match(responsive, /\.customer-page\.public \.product\.is-soldout\{opacity:\.72\}/);
});

test("모바일 장바구니는 단일 열로 주문 정보와 결제 영역을 보여준다", () => {
  assert.match(responsive, /\.customer-page\.public \.cart-layout\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(responsive, /\.customer-page\.public \.qty button\{width:40px;height:40px\}/);
});
