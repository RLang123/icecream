import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STORE_HERO_MESSAGE,
  STORE_HERO_MESSAGE_MAX_LENGTH,
  normalizeStoreHeroMessage,
  storeHeroMessage,
} from "../shared/store-message.js";
import { projectError } from "../worker/index.js";

const project = heroMessage => ({
  store: { name: "테스트 매장", ingredients: [], ...(heroMessage === undefined ? {} : { heroMessage }) },
  categories: ["전체"],
  items: [],
});

test("대표 문구는 값이 없을 때만 기존 기본값을 사용한다", () => {
  assert.equal(storeHeroMessage(undefined), DEFAULT_STORE_HERO_MESSAGE);
  assert.equal(storeHeroMessage("  새 문구  "), "새 문구");
});

test("대표 문구는 앞뒤 공백을 정리하고 빈 값과 초과 길이를 거부한다", () => {
  assert.equal(normalizeStoreHeroMessage("  한글 English 123 !?  "), "한글 English 123 !?");
  assert.match(projectError(project("   ")), /입력/);
  assert.match(projectError(project("가".repeat(STORE_HERO_MESSAGE_MAX_LENGTH + 1))), /60자/);
  assert.equal(projectError(project("가".repeat(STORE_HERO_MESSAGE_MAX_LENGTH))), null);
});

test("HTML과 스크립트 모양의 문구도 실행 데이터가 아닌 일반 문자열로 보존한다", () => {
  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const data = project(payload);
  assert.equal(projectError(data), null);
  assert.equal(data.store.heroMessage, payload);
});
