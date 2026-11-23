# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 백엔드 신입 채용 리뷰에서 지적될 보안·설계·저장소 위생 결함을 제거한다.

Observable finish state:
- 운영 데모가 실제 데이터로 동작하고, 정기 smoke가 실패하면 알 수 있다.
- 관리자 대시보드와 화면에 가짜 지표·빈 화면이 없고, UI가 `.impeccable.md` 기준과 일치한다.
- 운영 인증 경로에 하드코딩 계정·mock 분기가 없고, 세션은 DB에서 폐기 가능하다.
- 익명 rate limit은 쿠키 없이 우회되지 않는다.
- route → service → repository 계층과 도메인 에러 타입이 있고, 도메인 규칙은 DB 없이 unit test된다.
- `npm run verify`, `npm run test:integration`, `npm run test:e2e:full`, `npm audit --omit=dev --audit-level=high`가 통과한다.

공통 integration 실행 명령(이하 `INTEGRATION`): `npm run test:integration:local`

## Active

### Phase 1. 데모 복구와 인증·남용 방지 결함 제거

#### 1-0. 한국 사용자 기준 운영 지연 확인
- Done in 이전 작업: 운영 DB를 VPS 전용 Postgres로 이전(Hyperdrive → Workers VPC → Tunnel), Turnstile·SMOKE secret·정기 감시(Keep Alive, Remote Smoke) 정상, Supabase 종료와 옛 secret 정리.
- Current blocker: 측정 머신(Cloudflare LAX 경유)에서 지도·상세가 약 1.9초다. VPS가 오스트리아라 한국 사용자는 DB 왕복이 대륙을 건너므로 목표(지도 p95 1초)를 못 맞출 수 있다. 한국에서의 실제 값은 아직 없다.
- Next action: 한국 네트워크(또는 한국 리전 측정 서비스)에서 `npm run map:measure`와 브라우저 첫 화면 로딩을 재고, 목표 초과 시 ① 공개 GET(`/api/places/map`, 상세)에 짧은 `s-maxage` 엣지 캐시를 추가하거나 ② 한국과 가까운 리전의 Postgres로 Hyperdrive 대상을 교체한다(`deploy/vps/README.md` §5). 결과와 결정은 ADR 0004에 기록한다.
- Verify: `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run map:measure`
- Done: 한국 기준 지도 조회 p95가 1초 이내이거나, 초과 시 위 조치가 적용돼 다시 측정한 값이 ADR에 있다.

## Backlog

- VPS 백업(`/opt/backups/altteulmap`)을 VPS 밖(다른 호스트·오브젝트 스토리지)으로 주기 복사하고 복구 리허설(`npm run db:rehearse:backup`)을 실행해 증적 확보
- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
