import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('0014는 주문 수정 멱등성과 폐기 slug 예약 구조를 추가한다', async()=>{
  const sql=await readFile(new URL('../migrations/0014_order_edit_idempotency_and_slug_reservations.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS order_change_requests/);assert.match(sql,/UNIQUE \(seller_id, request_key\)/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS reserved_store_slugs/);assert.match(sql,/slug TEXT PRIMARY KEY/);assert.match(sql,/INSERT OR IGNORE INTO reserved_store_slugs/);
});
