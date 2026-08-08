import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('운영 DB 스크립트는 승인된 0007 파일 하나만 직접 실행한다', async () => {
  const source=await readFile(new URL('../scripts/apply-remote-migrations.mjs',import.meta.url),'utf8');
  assert.match(source,/migrations\/0007_sessions_expiry_index\.sql/);
  assert.match(source,/\['wrangler', 'd1', 'execute', database, '--remote', '--file', approvedMigration\]/);
  assert.doesNotMatch(source,/migrations', 'apply/);
});
