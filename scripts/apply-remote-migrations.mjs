import { spawnSync } from 'node:child_process';

const database = 'geno-studio-db';
if (process.env.CONFIRM_REMOTE_D1 !== database) {
  console.error(`원격 마이그레이션을 중단했습니다. 대상이 ${database}인지 Cloudflare 대시보드에서 확인한 뒤 CONFIRM_REMOTE_D1=${database} npm run db:remote 를 실행하세요.`);
  process.exit(2);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['wrangler', 'd1', 'migrations', 'apply', database, '--remote'],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
