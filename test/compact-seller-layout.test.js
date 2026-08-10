import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/responsive.css", import.meta.url), "utf8");

test("901~1199px 판매자 화면은 압축형 2단 레이아웃을 유지한다", () => {
  assert.match(css, /@media \(min-width:901px\) and \(max-width:1199px\)/);
  assert.match(css, /grid-template-columns:340px minmax\(0,1fr\)/);
  assert.match(css, /\.preview-area\{display:flex/);
  assert.match(css, /\.control-panel\{[^}]*overflow-y:auto/);
  assert.match(css, /\.device-stage\{[^}]*overflow:auto/);
  assert.doesNotMatch(css, /@media \(min-width:901px\)[\s\S]*?transform:scale/);
});

test("900px 이하 태블릿 전환 방식은 미리보기를 계속 숨긴다", () => {
  assert.match(css, /@media \(min-width:768px\) and \(max-width:900px\)/);
  assert.match(css, /\.workspace\{grid-template-columns:minmax\(0,1fr\)\}[^\n]*\.preview-area\{display:none\}/);
});
