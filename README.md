# GENO Studio

React UI, Cloudflare Worker/Pages Function, D1을 사용하는 키오스크 생성기입니다. `/seller`는 판매자용이고 `/shop/{매장주소}`는 공개 주문 화면입니다.

## 데이터베이스와 환경 구분

운영 D1 이름은 `geno-studio-db`, 코드의 바인딩 이름은 항상 `DB`입니다. `database_id`는 저장소에서 확인할 수 없어 임의 값이나 placeholder를 넣지 않았습니다.

Cloudflare Pages Git 배포를 사용한다면 대시보드의 **Workers & Pages → 해당 Pages 프로젝트 → Settings → Bindings**에서 환경별로 직접 연결해야 합니다.

- Production: `DB` → `geno-studio-db` (필수)
- Preview: 운영 DB와 분리된 기존 Preview D1이 있을 때만 `DB`에 연결합니다. Preview를 운영 DB에 연결하지 마세요.
- Local: `npm run db:local`과 `npm run dev:full`은 `.wrangler/state`의 로컬 D1을 사용합니다. 운영 데이터에 접근하지 않습니다.

```bash
npm install
npm run db:local
npm run dev:full
```

`npm run build`는 Pages용 `dist/_worker.js`를 만듭니다. Pages Git 연결에서는 Git push가 배포를 시작하며 `wrangler.jsonc`의 Cron Trigger를 Pages에 설치한다고 가정해서는 안 됩니다. 이 저장소는 의도하지 않은 Workers 프로젝트 배포를 피하기 위해 배포 명령을 제공하지 않습니다.

### 원격 마이그레이션 안전장치

`npm run db:remote`는 기본적으로 실패합니다. Cloudflare 대시보드에서 대상 계정과 `geno-studio-db`를 확인한 운영자만 다음처럼 명시적으로 승인할 수 있습니다.

```bash
CONFIRM_REMOTE_D1=geno-studio-db npm run db:remote
```

이 명령은 DB를 만들지 않지만 저장소의 미적용 마이그레이션을 운영 DB에 적용합니다. 실행 전 D1 Time Travel/백업 가능 여부와 `wrangler d1 migrations list geno-studio-db --remote` 결과를 확인하세요. 기존 마이그레이션에는 과거 스키마 변환 SQL이 있으므로 새 DB나 대상이 불명확한 DB에 실행하지 마세요.

## 주문 보관과 자정 정리 상태

자동 주문 삭제는 비활성화되어 있습니다. 과거 구현은 주문 요청과 Cron에서 이전 날짜 주문을 삭제해 데이터 손실 위험이 있었고, Pages Git 배포에서는 Worker Cron Trigger 실행도 보장되지 않았습니다. 보관 기간, 자정 전 CSV 백업, 복구 책임자와 복구 절차를 정한 뒤 별도 Worker의 Cron Trigger로 전환해야 합니다. 전환 시 삭제 전에 백업을 만들고, dry-run 조회와 삭제 건수 상한을 두며, 운영 DB 바인딩을 별도로 검증하세요.

## 운영 특성

- 공개 매장 API는 `Cache-Control: no-store`이며 화면이 10초마다 새 상태를 조회합니다.
- 주문 API는 제출 시 최신 D1 프로젝트를 다시 읽어 가격, 온도, 사이즈, 샷, 재료 품절을 재검증합니다.
- 비밀번호는 PBKDF2-SHA-256, 100,000회, 256비트이며 기존 사용자 해시 형식을 유지합니다.
- 로그인 성공 시 만료 세션을 정리하고, 쿠키는 `HttpOnly; Secure; SameSite=Lax`입니다.
- 메모리 기반 요청 제한은 Worker 인스턴스 간 공유되지 않는 보조 장치일 뿐입니다. 운영 방어에는 Turnstile, WAF Rate Limiting 또는 공유 상태 저장소를 별도로 검토해야 합니다.

문자·카카오 알림톡과 계정 복구 이메일은 외부 서비스와 제품 정책이 필요하므로 구현하지 않았습니다.
