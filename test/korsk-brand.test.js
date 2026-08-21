import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const visibleSources = [
  "../index.html",
  "../src/main.jsx",
  "../src/public-content.jsx",
  "../src/closing-xlsx.js",
];

test("사용자 화면과 내보내기 이름은 KORSK로 통일된다", async () => {
  const sources = await Promise.all(
    visibleSources.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /GENO Studio|Geno Studio|\bGENO\b/);
  assert.match(combined, /<title>KORSK — 키오스크 빌더<\/title>/);
  assert.match(combined, /KORSK-소비자-QR\.png/);
  assert.match(combined, /KORSK_\$\{safe\}_\$\{businessDate\}_영업마감\.xlsx/);
});
