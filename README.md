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

`npm run db:remote`는 기본적으로 실패합니다. Cloudflare 대시보드에서 대상 계정과 `geno-studio-db`를 확인한 운영자만 다음처럼 명시적으로 승인할 수 있습니다. 현재 운영 DB는 과거 스키마가 적용되어 있지만 Wrangler 마이그레이션 추적 기록이 없어 `migrations apply`가 0001부터 전부 미적용으로 오인합니다. 따라서 이 스크립트는 승인된 `migrations/0007_sessions_expiry_index.sql` 하나만 `d1 execute --file`로 실행하도록 고정되어 있습니다.

```bash
CONFIRM_REMOTE_D1=geno-studio-db npm run db:remote
```

이 명령은 DB를 만들거나 과거 마이그레이션을 실행하지 않고 0007의 세션 만료 인덱스만 생성합니다. `wrangler d1 migrations apply geno-studio-db --remote`는 기존 마이그레이션의 `DROP TABLE`과 `ALTER TABLE`까지 실행하려 할 수 있으므로 사용하지 마세요. 직접 실행 방식은 Wrangler의 마이그레이션 추적 상태를 갱신하지 않는다는 점을 운영 기록에 남겨야 합니다.

## 주문 보관과 자정 정리 상태

자동 주문 삭제는 비활성화되어 있습니다. 과거 구현은 주문 요청과 Cron에서 이전 날짜 주문을 삭제해 데이터 손실 위험이 있었고, Pages Git 배포에서는 Worker Cron Trigger 실행도 보장되지 않았습니다. 보관 기간, 자정 전 CSV 백업, 복구 책임자와 복구 절차를 정한 뒤 별도 Worker의 Cron Trigger로 전환해야 합니다. 전환 시 삭제 전에 백업을 만들고, dry-run 조회와 삭제 건수 상한을 두며, 운영 DB 바인딩을 별도로 검증하세요.

## 운영 특성

- 공개 매장 API는 최신성과 읽기 절감을 위해 5초 공개 캐시를 사용하며 주문 API는 항상 최신 D1 데이터를 다시 확인합니다.
- 주문 API는 제출 시 최신 D1 프로젝트를 다시 읽어 가격, 온도, 사이즈, 샷, 재료 품절을 재검증합니다.
- 비밀번호는 PBKDF2-SHA-256, 100,000회, 256비트이며 기존 사용자 해시 형식을 유지합니다.
- 회원가입·로그인 성공 직전에 `expires_at`이 지난 세션만 오래된 순서로 최대 100건 정리합니다. 로그아웃은 해당 세션 ID 하나를 즉시 삭제합니다. 쿠키는 `HttpOnly; Secure; SameSite=Lax`입니다.
- 메모리 기반 요청 제한은 Worker 인스턴스 간 공유되지 않는 보조 장치일 뿐입니다. 운영 방어에는 Turnstile, WAF Rate Limiting 또는 공유 상태 저장소를 별도로 검토해야 합니다.

## 무료 Turnstile 활성화

코드는 회원가입(`register`)과 로그인(`login`)에서 Turnstile 토큰을 Worker가 Siteverify로 확인하도록 준비되어 있습니다. 토큰의 성공 여부, action, hostname을 모두 검사합니다. 키가 없거나 `TURNSTILE_REQUIRED`가 `true`가 아니면 기존 로그인은 그대로 동작합니다.

1. Cloudflare 대시보드의 Turnstile에서 무료 Managed 위젯을 사람이 생성합니다. 새 리소스는 코드가 자동 생성하지 않습니다.
2. 위젯 허용 호스트에 실제 Production 도메인을 등록합니다. 로컬 시험용 위젯은 `localhost`, `127.0.0.1`을 별도로 사용하고 Production 허용 목록에는 넣지 마세요.
3. Pages → Settings → Variables and Secrets에서 다음을 설정합니다.
   - `TURNSTILE_SITE_KEY`: 공개 사이트 키
   - `TURNSTILE_SECRET`: 반드시 Encrypt한 Secret
   - `TURNSTILE_HOSTNAMES`: 쉼표로 구분한 정확한 Production hostname
4. 먼저 Preview에서 세 값을 넣고 `/api/health`의 `turnstile`이 `optional`인지 확인합니다.
5. 마지막에 `TURNSTILE_REQUIRED=true`를 추가해 새 배포를 만든 뒤 `turnstile: required`와 실제 로그인 성공·토큰 재사용 실패를 확인합니다.

설정이 일부 빠진 상태에서 `TURNSTILE_REQUIRED=true`만 들어가면 서비스 중단 대신 `/api/health`가 `configuration-incomplete`를 반환하고 기존 인증은 유지됩니다. 이 상태를 보호 완료로 간주하면 안 됩니다. Secret과 토큰은 로그에 기록하지 않습니다.

## 상태 확인

`GET /api/health`는 D1에 `SELECT 1`만 실행합니다. 정상은 `200 { ok: true }`, DB 미연결·응답 실패는 503이며 사용자 데이터와 테이블 구조를 반환하지 않습니다. 외부 무료 모니터링 서비스는 추가하지 않았으므로 배포 직후와 장애 신고 시 직접 확인하세요.

관리자 운영 점검은 Cloudflare 계정 권한이 있는 터미널에서만 다음 읽기 전용 명령으로 수행합니다. SQL은 주요 테이블의 행 개수만 반환하며 비밀번호 해시, 세션 ID, 복구 코드나 주문·결제 상세를 출력하지 않습니다. 원격 조회도 D1 무료 사용량을 소비하므로 이상 징후가 있을 때만 실행하세요.

```bash
npx wrangler d1 execute geno-studio-db --remote --file=ops/table-counts.sql
```

저장공간 증가는 D1 대시보드의 Metrics에서 storage와 rows written을 먼저 확인하고, 위 결과를 이전 점검 기록과 비교해 `sessions`, `orders`, `payment_attempts` 증가폭을 확인합니다. `payment_attempts`는 성공·거절 결제 감사 기록으로 사용 중이고 법적·정산 보관 기준이 확정되지 않았으므로 자동 삭제하지 않습니다.

## 무료 WAF 속도 제한

Cloudflare Free zone은 Rate Limiting 규칙 1개를 제공할 수 있습니다. 자체 도메인이 Cloudflare zone에 연결된 경우 Security → WAF → Rate limiting rules에서 경로 `/api/login`을 우선 보호하는 것을 권장합니다. 로그인은 기존 계정 탈취 시도가 반복되는 표면이기 때문입니다. Free 규칙은 경로 기준과 IP 집계 등 제한된 조건만 지원하므로 대시보드에서 제공되는 값 안에서 10초 단위의 완화된 Managed Challenge로 시작하고 정상 사용자를 관찰하세요. `*.pages.dev`는 사용자가 소유한 zone이 아니므로 해당 Pages 기본 도메인에 zone WAF 규칙을 임의 적용할 수 없습니다. 코드의 메모리 제한은 여러 Worker 인스턴스에 공유되지 않는 보조 장치입니다.

## 백업과 복구 범위

- 프로젝트 JSON 내보내기: 매장 디자인, 메뉴, 재료 설정만 포함합니다. 사용자 계정, 비밀번호 해시, 세션, 주문, 결제 시도는 포함하지 않습니다.
- 주문 CSV: 화면에 조회된 최근 150건 중 판매 완료 주문만 포함합니다. 계정, 프로젝트 원본, 대기·취소 주문, 전체 결제시도 행을 완전하게 백업하지 않습니다.
- 전체 복구: D1 production 저장소의 Time Travel을 사용합니다. Free 보존 기간은 7일이며 별도 활성화나 추가 비용은 없지만, restore는 운영 DB를 덮어쓰는 파괴적 작업입니다. 장애 시 먼저 `wrangler d1 info geno-studio-db`로 production 저장소인지 확인하고, `wrangler d1 time-travel info geno-studio-db --timestamp=<RFC3339>`로 복구 지점을 확인한 다음 운영 승인 후 restore해야 합니다. 이번 작업에서는 restore를 실행하지 않았습니다.

자동 자정 삭제는 계속 비활성화되어 있습니다. 다시 도입하려면 최소 7일 이상 보관 기간, 삭제 전 프로젝트 JSON·주문 CSV 확인, D1 Time Travel 복구 가능 여부, 담당자 승인과 삭제 건수 상한을 먼저 정해야 합니다. 현재 Pages Git 배포에 Cron이 실행된다고 주장하지 않습니다.

## Free 사용량 확인

Cloudflare 대시보드에서 Workers & Pages → 프로젝트 → Metrics의 요청·오류·CPU와 D1 → `geno-studio-db` → Metrics → Row Metrics의 rows read/written 및 저장 용량을 매일 확인하세요.

- Workers Free: 하루 100,000 요청. 초과 시 추가 과금 대신 요청이 실패할 수 있습니다.
- D1 Free: 하루 5백만 rows read, 10만 rows written, DB당 500MB, 계정 전체 5GB. 초과 시 쿼리나 쓰기가 다음 UTC 초기화까지 실패할 수 있습니다.
- 주문 목록 API는 `page`와 `limit`을 받으며 기본 50건, 최대 100건만 판매자 또는 고객 소유권 범위에서 조회합니다. 큰 페이지 번호의 OFFSET 비용이 커지면 cursor 페이지네이션으로 전환해야 합니다.
- 공개 매장 API는 최대 5초만 캐시합니다. 판매자 주문 화면은 활성 상태에서 10~30초 간격으로 조회하고 숨긴 탭에서는 중단하며, 주문 API는 항상 최신 D1 데이터를 재검증합니다.
- 프로젝트 JSON은 D1 단일 행 제한보다 여유 있게 1.8MB로 제한합니다.

문자·카카오 알림톡과 계정 복구 이메일은 외부 서비스와 제품 정책이 필요하므로 구현하지 않았습니다.

# 공개 콘텐츠와 AdSense 준비

공개 정보 페이지는 `/about`, `/guide`, `/privacy`, `/terms`입니다. 광고는 정보성 페이지인 `/about`, `/guide`에서만 허용하며 `/login`, `/seller`, `/shop/*`, `/privacy`, `/terms` 및 그 밖의 경로에서는 렌더링하거나 광고 스크립트를 불러오지 않습니다.

`public/ads.txt`와 AdSense 계정 확인용 메타 태그에는 게시자 `ca-pub-4934943702995460`이 반영되어 있습니다. 이것만으로 광고가 활성화되지는 않습니다. 승인 후 Cloudflare Pages의 Production 빌드 환경 변수에 다음 세 값을 모두 설정하고 새 배포를 만든 경우에만 광고 코드가 로드됩니다.

```text
VITE_ADSENSE_ENABLED=true
VITE_ADSENSE_CLIENT=ca-pub-4934943702995460
VITE_ADSENSE_CONTENT_SLOT=<AdSense에서 발급한 숫자 광고 단위 ID>
```

승인 전에는 위 변수를 설정하지 마세요. 특히 `VITE_ADSENSE_ENABLED` 기본값은 꺼짐이며, 클라이언트 ID 또는 광고 단위 ID가 잘못되면 `AdSlot`은 아무것도 표시하지 않습니다. Vite 환경 변수는 빌드 결과에 공개되므로 비밀키를 넣으면 안 됩니다.

개인정보 처리방침에는 현재 코드 기준의 수집 항목, 외부 처리, 문의 경로, 보관 원칙과 시행일을 공개했습니다. 실제 사업자 등록 정보나 별도 개인정보 담당자·전용 이메일이 생기면 즉시 해당 페이지에 추가해야 합니다. AdSense 활성화 전에는 Google의 개인정보 및 메시지 설정에서 서비스 대상 지역에 필요한 동의 절차도 검토하세요.
