import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { api, seoulBusinessWindow } from "../worker/index.js";
import {
  BUSINESS_CLOSE_COUNTDOWN_SECONDS,
  canConfirmBusinessClose,
} from "../src/business-close.js";

test("Asia/Seoul 자정 직전과 직후의 영업 날짜 범위가 정확하다", () => {
  assert.deepEqual(seoulBusinessWindow(new Date("2026-08-08T14:59:59.999Z")), {
    businessDate: "2026-08-08",
    start: "2026-08-07 15:00:00",
    end: "2026-08-08 15:00:00",
  });
  assert.deepEqual(seoulBusinessWindow(new Date("2026-08-08T15:00:00.000Z")), {
    businessDate: "2026-08-09",
    start: "2026-08-08 15:00:00",
    end: "2026-08-09 15:00:00",
  });
});

test("최종 마감 버튼은 3초 전과 처리 중에는 실행할 수 없다", () => {
  assert.equal(BUSINESS_CLOSE_COUNTDOWN_SECONDS, 3);
  assert.equal(canConfirmBusinessClose(3, false), false);
  assert.equal(canConfirmBusinessClose(1, false), false);
  assert.equal(canConfirmBusinessClose(0, true), false);
  assert.equal(canConfirmBusinessClose(0, false), true);
});

test("첫 클릭은 모달만 열고 서버 요청은 최종 처리 함수에만 있다", async () => {
  const source = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /onClick=\{\(\) => activeOrderCount === 0 && setCloseModal\(true\)\}/);
  assert.match(source, /const closeBusiness = async \(\) =>/);
  assert.match(source, /api\("\/api\/business-close", \{\s*method: "POST"/);
  assert.match(source, /영업 종료 및 주문 상세 정리/);
  assert.match(source, /정리된 주문 상세 수/);
  assert.match(source, /진행 중인 주문 \$\{activeOrderCount\}건을 먼저 완료하거나 취소해 주세요\./);
  assert.match(source, /disabled=\{activeOrderCount !== 0\}/);
});

test("진행 중 주문이 있으면 마감 API는 409이며 쓰기 작업을 시작하지 않는다", async () => {
  let batchCalled = false;
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("FROM sessions JOIN users"))
              return { id: "seller-active", role: "seller" };
            if (sql.includes("COUNT(*) AS count")) return { count: 1 };
            throw new Error(sql);
          },
        };
      },
      async batch() { batchCalled = true; throw new Error("write must not start"); },
    },
  };
  const response = await api(new Request("https://example.com/api/business-close", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "session=active" },
    body: JSON.stringify({ requestKey: "active-close-request-1234", seller_id: "forged" }),
  }), env, {});
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.code, "ACTIVE_ORDERS_REMAIN");
  assert.equal(result.activeOrderCount, 1);
  assert.equal(batchCalled, false);
});

test("마감 SQL은 주문을 삭제하지 않고 판매자·날짜·미정리 조건으로만 비식별화한다", async () => {
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  const start = source.indexOf("if(path==='/api/business-close' && method==='POST')");
  const end = source.indexOf("if(path==='/api/my-orders'", start);
  const closeRoute = source.slice(start, end);
  assert.doesNotMatch(closeRoute, /DELETE FROM orders/i);
  assert.match(closeRoute, /WHERE seller_id=\? AND created_at>=\? AND created_at<\? AND status IN \('completed','done','cancelled','refunded'\) AND details_cleaned_at IS NULL/);
  assert.match(closeRoute, /status IN \('new','preparing'\)/);
  assert.match(closeRoute, /customer_id=NULL/);
  assert.match(closeRoute, /customer_name='비식별 고객'/);
  assert.match(closeRoute, /items='\[\]'/);
  assert.match(closeRoute, /department=NULL/);
  assert.match(closeRoute, /details_cleaned_at=CURRENT_TIMESTAMP/);
});

test("추가형 마이그레이션은 payment_attempts 외래키를 변경하지 않는다", async () => {
  const migration = await readFile(
    new URL("../migrations/0008_daily_business_closures.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /UNIQUE \(seller_id, business_date\)/);
  assert.match(migration, /ALTER TABLE orders ADD COLUMN details_cleaned_at TEXT/);
  assert.doesNotMatch(migration, /payment_attempts|DELETE|DROP|ON DELETE SET NULL/i);
});

test("마감 금액은 총 주문·취소·환불·순매출을 분리하고 total_revenue는 순매출과 같다", async () => {
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  const migration = await readFile(new URL("../migrations/0010_daily_closure_amount_breakdown.sql", import.meta.url), "utf8");
  assert.match(source, /total_order_amount,cancelled_amount,refunded_amount,net_revenue/);
  assert.match(source, /status='cancelled' THEN total ELSE 0/);
  assert.match(source, /status='refunded' THEN total ELSE 0/);
  assert.match(source, /status IN \('completed','done'\) THEN total ELSE 0/);
  assert.match(migration, /ALTER TABLE daily_closures ADD COLUMN total_order_amount/);
  assert.match(migration, /ALTER TABLE daily_closures ADD COLUMN cancelled_amount/);
  assert.match(migration, /ALTER TABLE daily_closures ADD COLUMN refunded_amount/);
  assert.match(migration, /ALTER TABLE daily_closures ADD COLUMN net_revenue/);
  assert.doesNotMatch(migration, /DELETE|DROP/i);
});

test("마감 API는 본문 seller_id를 무시하고 로그인 판매자 ID만 SQL에 바인딩한다", async () => {
  const statements = [];
  const closure = {
    business_date: "2026-08-09",
    total_order_count: 2,
    completed_order_count: 1,
    cancelled_order_count: 1,
    total_revenue: 12000,
    closed_at: "2026-08-08 15:00:01",
    cleaned_order_count: 2,
    request_key: "close-request-1234567890",
  };
  const env = {
    DB: {
      prepare(sql) {
        const statement = {
          sql,
          args: [],
          bind(...args) {
            this.args = args;
            statements.push(this);
            return this;
          },
          async first() {
            if (sql.includes("FROM sessions JOIN users"))
              return { id: "seller-session", role: "seller", email: "s@example.invalid", name: "S" };
            if (sql.includes("COUNT(*) AS count")) return { count: 0 };
            if (sql.includes("FROM daily_closures")) return closure;
            throw new Error(sql);
          },
        };
        return statement;
      },
      async batch(batch) {
        assert.equal(batch.length, 2);
        return [{ meta: { changes: 1 } }, { meta: { changes: 2 } }];
      },
    },
  };
  const response = await api(
    new Request("https://example.com/api/business-close", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "session=test" },
      body: JSON.stringify({
        requestKey: "close-request-1234567890",
        seller_id: "forged-seller",
      }),
    }),
    env,
    {},
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deduplicated, false);
  const closeStatements = statements.filter((statement) =>
    /daily_closures|UPDATE orders SET customer_id/.test(statement.sql),
  );
  assert.ok(closeStatements.length >= 3);
  assert.equal(JSON.stringify(closeStatements).includes("forged-seller"), false);
  assert.ok(closeStatements.every((statement) => statement.args.includes("seller-session")));
});

test("비로그인과 판매자가 아닌 계정은 마감 API를 실행할 수 없다", async () => {
  const anonymous = await api(
    new Request("https://example.com/api/business-close", { method: "POST" }),
    { DB: { prepare() { return { bind() { return this; }, async first() { return null; } }; } } },
    {},
  );
  assert.equal(anonymous.status, 401);

  const customer = await api(
    new Request("https://example.com/api/business-close", {
      method: "POST",
      headers: { cookie: "session=customer" },
    }),
    { DB: { prepare() { return { bind() { return this; }, async first() { return { id: "customer-1", role: "customer" }; } }; } } },
    {},
  );
  assert.equal(customer.status, 403);
});
