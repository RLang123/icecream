# 요청 제한 설계

기존 모듈 전역 `Map`은 하나의 Worker isolate 안에서만 공유되므로 보안 경계가 아니다. 프로세스 재시작, isolate 교체, 다른 Cloudflare 위치에서는 카운터가 분리된다.

Preview에서는 Cloudflare Workers Rate Limiting binding을 우선 사용한다. 로그인·회원가입, 공개 주문, 판매자 변경 요청을 서로 다른 namespace로 분리한다. binding이 없는 로컬 개발 환경에서만 기존 `Map`을 임시 방어로 사용한다.

Cloudflare 공식 문서상 Rate Limiting binding은 같은 위치의 여러 isolate가 공유하지만 위치별로 분리되고 결과가 의도적으로 permissive/eventually consistent하다. 따라서 정확한 전역 과금·재고·중복 방지에는 사용하지 않는다. 주문 중복과 재고 일관성은 D1 UNIQUE 제약, request_key, inventory_version, D1 batch 트랜잭션이 담당한다.

무료 범위에서 더 강한 전역 직렬화가 필요하면 Durable Objects 무료 제공 범위와 현재 계정 요금제를 별도로 확인한 뒤 도입해야 한다. 이번 변경에서는 새 유료 리소스나 결제수단을 만들지 않는다.
