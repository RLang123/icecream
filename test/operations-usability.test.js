import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0013_order_change_history.sql", import.meta.url), "utf8");

test("간편 운영 화면은 시작 점검·주문 처리·품절 설정을 제공한다", () => {
  assert.match(main, /오늘의 간편 운영/);
  assert.match(main, /영업 시작 점검/);
  assert.match(main, /준비 시작/);
  assert.match(main, /판매 완료/);
  assert.match(main, /빠른 품절 설정/);
});

test("고객은 서버 전송 전에 주문 내용을 마지막으로 확인한다", () => {
  assert.match(main, /setScreen\("confirm"\)/);
  assert.match(main, /이대로 주문할까요\?/);
  assert.match(main, /네, 주문합니다/);
});

test("주문 변경 기록과 10초 되돌리기는 판매자 소유권으로 제한된다", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS order_changes/);
  assert.match(worker, /created_at>=datetime\('now','-10 seconds'\)/);
  assert.match(worker, /order_id=\? AND seller_id=\?/);
  assert.match(worker, /UPDATE order_changes SET undone_at=CURRENT_TIMESTAMP/);
});

test("음성 안내는 한국어와 느린 속도로 한 번 읽는다", () => {
  assert.match(main, /voiceOrderAnnouncements/);
  assert.match(main, /utterance\.lang = "ko-KR"/);
  assert.match(main, /utterance\.rate = 0\.85/);
  assert.match(main, /speechSynthesis\.speak\(utterance\)/);
});

test("화면별 단계 도움말은 번호가 있는 짧은 절차를 제공한다", () => {
  assert.match(main, /function StepHelp/);
  assert.match(main, /이 화면 사용 방법/);
  assert.match(main, /steps\.map/);
});
