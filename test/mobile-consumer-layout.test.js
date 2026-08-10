import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/responsive.css", import.meta.url), "utf8");
const jsx = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

test("모바일 소비자 상단과 장바구니는 좁은 화면 전용 회귀 규칙을 유지한다", () => {
  assert.match(css, /\.customer-page\.public \.kiosk-head\{height:64px/);
  assert.match(css, /\.customer-page\.public \.hero\{height:128px/);
  assert.match(css, /\.customer-page\.public \.category-row\{height:58px/);
  assert.match(css, /\.customer-page\.public \.cart-layout\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /overflow-x:auto/);
});

test("대표 문구는 HTML 삽입 없이 React 텍스트로 렌더링한다", () => {
  assert.match(jsx, /<h1>\{storeHeroMessage\(data\.store\.heroMessage\)\}<\/h1>/);
  assert.doesNotMatch(jsx, /dangerouslySetInnerHTML/);
});
