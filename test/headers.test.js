import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Pages 정적 응답에 기본 보안 헤더가 선언된다", async () => {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  assert.match(headers, /^\/\*$/m);
  assert.match(headers, /^  X-Content-Type-Options: nosniff$/m);
  assert.match(headers, /^  Referrer-Policy: strict-origin-when-cross-origin$/m);
  assert.match(headers, /^  X-Frame-Options: SAMEORIGIN$/m);
  assert.match(headers, /^  Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)$/m);
});

test("해시 자산만 immutable이고 HTML 공통 규칙에는 적용되지 않는다", async () => {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  const [common, assets] = headers.trim().split(/\n\s*\n/);
  assert.doesNotMatch(common, /immutable/i);
  assert.match(assets, /^\/assets\/\*$/m);
  assert.match(assets, /^  Cache-Control: public, max-age=31536000, immutable$/m);
});
