import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main=await readFile(new URL("../src/main.jsx",import.meta.url),"utf8");
const worker=await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
const availability=await readFile(new URL("../worker/menu-availability.js",import.meta.url),"utf8");

test("첫 포인터·키보드 입력은 AudioContext를 활성화하고 설정을 새로고침 뒤에도 유지한다",()=>{
  assert.match(main,/document\.addEventListener\("pointerdown", unlock/);
  assert.match(main,/document\.addEventListener\("keydown", unlock/);
  assert.match(main,/await audioRef\.current\.resume/);
  assert.match(main,/localStorage\.setItem\("geno-order-alert-enabled", "true"\)/);
  assert.match(main,/localStorage\.getItem\("geno-order-alert-enabled"\)/);
});

test("새 주문 반복 알림은 단일 타이머이며 주문 확인·준비·완료에서 정지한다",()=>{
  assert.match(main,/alertTimerRef\.current = window\.setInterval/);
  assert.match(main,/if \(alertTimerRef\.current \|\| !alertTrackerRef\.current\.size\) return/);
  assert.match(main,/onClick=\{\(\) => acknowledgeOrder\?\.\(o\.id\)\}/);
  assert.match(main,/const update = async \(id, status, extra = \{\}\) => \{\s*acknowledgeOrder\?\.\(id\)/);
  assert.match(main,/알림 확인/);
});

test("소리 실패 경고·테스트 버튼·허용된 시스템 알림·진동을 제공한다",()=>{
  assert.match(main,/소리 재생이 차단됐습니다/);
  assert.match(main,/알림 소리 테스트/);
  assert.match(main,/Notification\.permission === "granted"/);
  assert.match(main,/navigator\.vibrate/);
  assert.doesNotMatch(main,/Notification\.requestPermission\(\)/);
});

test("재고 숫자 UI는 숨기되 상태와 원자적 차감·자동 품절 로직은 유지한다",()=>{
  assert.doesNotMatch(main,/className="ingredient-stock"/);
  assert.doesNotMatch(main,/ingredients\.filter\(\(i\) => i\.available\)\.length/);
  for(const status of ["재고 정상","일부 재료 품절","전체 재료 품절","품절"])assert.match(availability,new RegExp(status));
  assert.match(worker,/ingredient\.stock-=needed/);
  assert.match(worker,/ingredient\.available=ingredient\.available!==false&&ingredient\.stock>0/);
  assert.match(worker,/inventory_version=inventory_version\+1/);
});
