import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const responsive = await readFile(new URL("../src/responsive.css", import.meta.url), "utf8");

test("/login 직접 진입은 판매자 로그인 모달을 자동으로 연다", () => {
  assert.match(
    main,
    /useState\(\(\) => location\.pathname === "\/login"\)/,
  );
});

test("로그인 성공 시 /seller 전환 전에 인증 모달을 닫는다", () => {
  assert.match(main, /setAuthOpen\(false\);\s*onAuth\(r\.user\);/);
  assert.match(
    main,
    /history\.replaceState\(\{\}, "", "\/seller"\);\s*setUser\(u\);/,
  );
});

test("모바일 판매자 헤더 축소 규칙은 로그인 GENO Studio 브랜드에 번지지 않는다", () => {
  assert.match(responsive, /\.topbar \.brand>span,\.topbar \.brand>b\{display:none\}/);
  assert.doesNotMatch(responsive, /(?:^|})\.brand>span,\.brand>b\{display:none\}/);
  assert.match(main, /<span>GENO<\/span>\s*<b>Studio<\/b>/);
});
