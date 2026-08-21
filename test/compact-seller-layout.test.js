import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/responsive.css", import.meta.url), "utf8");
const simplified = fs.readFileSync(new URL("../src/seller-simplified.css", import.meta.url), "utf8");
const senior = fs.readFileSync(new URL("../src/senior-ui.css", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

test("판매자 작업 화면은 모든 크기에서 고정 미리보기 없이 전체 폭을 사용한다", () => {
  assert.match(css, /@media \(min-width:901px\) and \(max-width:1199px\)/);
  assert.match(simplified, /\.app \.workspace\{display:block/);
  assert.match(simplified, /\.app \.control-panel\{width:100%/);
  assert.match(simplified, /\.app \.preview-area\{display:none\}/);
  assert.doesNotMatch(main, /className="preview-area"/);
});

test("900px 이하 태블릿 전환 방식은 미리보기를 계속 숨긴다", () => {
  assert.match(css, /@media \(min-width:768px\) and \(max-width:900px\)/);
  assert.match(css, /\.workspace\{grid-template-columns:minmax\(0,1fr\)\}[^\n]*\.preview-area\{display:none\}/);
});

test("주문 카드의 사이즈와 품목 금액은 16px 수준의 고대비 정보로 표시한다", () => {
  assert.match(main, /className="order-size"/);
  assert.match(main, /className="order-item-price"/);
  assert.match(simplified, /\.order-items \.order-size\{[^}]*font-size:16px/);
  assert.match(senior, /\.order-items \.order-size\{[^}]*color:#fff!important/);
  assert.match(simplified, /\.order-item-price b\{font-size:16px/);
});
