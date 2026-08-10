import test from "node:test";
import assert from "node:assert/strict";
import {
  orderListChange,
  orderPollDelay,
  newlyAddedOrderIds,
  createOrderAlertTracker,
  shouldStartOrderPoll,
} from "../src/order-polling.js";

test("숨겨진 탭과 진행 중 요청에서는 주문 polling을 시작하지 않는다", () => {
  assert.equal(shouldStartOrderPoll({ hidden: true, inFlight: false }), false);
  assert.equal(shouldStartOrderPoll({ hidden: false, inFlight: true }), false);
  assert.equal(shouldStartOrderPoll({ hidden: false, inFlight: false }), true);
});

test("활성화 직후 polling 가능하며 정상 간격은 15~30초다", () => {
  const now=1_000_000;
  assert.equal(orderPollDelay({section:"orders",lastNewAt:0,now}),15000);
  assert.equal(orderPollDelay({section:"design",lastNewAt:now-120000,now}),20000);
  assert.equal(orderPollDelay({section:"design",lastNewAt:0,now}),30000);
});

test("네트워크 오류가 반복되면 재시도 간격이 지수적으로 늘고 120초로 제한된다", () => {
  assert.deepEqual([1,2,3,9].map(failures=>orderPollDelay({failures})),[5000,10000,20000,120000]);
});

test("같은 주문 목록은 React 상태 갱신 대상으로 취급하지 않는다", () => {
  const first=orderListChange("",[{id:"one",status:"new"}]);
  assert.equal(first.changed,true);
  assert.equal(orderListChange(first.signature,[{id:"one",status:"new"}]).changed,false);
  assert.equal(orderListChange(first.signature,[{id:"one",status:"preparing"}]).changed,true);
});

test("첫 조회의 기존 주문은 알리지 않고 실제로 추가된 신규 주문 ID만 한 번 알린다", () => {
  const initial=newlyAddedOrderIds(new Set(),[{id:"old",status:"new"}],false);
  assert.deepEqual(initial.added,[]);
  const added=newlyAddedOrderIds(initial.seen,[{id:"new",status:"new"},{id:"old",status:"new"}],true);
  assert.deepEqual(added.added,["new"]);
  assert.deepEqual(newlyAddedOrderIds(added.seen,[{id:"new",status:"new"},{id:"old",status:"new"}],true).added,[]);
});

test("알림은 확인 전까지 유지되고 같은 주문은 중복 등록되지 않으며 확인 즉시 제거된다", () => {
  const tracker=createOrderAlertTracker();
  assert.equal(tracker.start(["new-order"]),true);
  assert.equal(tracker.start(["new-order"]),false);
  assert.equal(tracker.has("new-order"),true);
  assert.equal(tracker.size,1);
  assert.equal(tracker.acknowledge("new-order"),0);
  assert.equal(tracker.has("new-order"),false);
});
