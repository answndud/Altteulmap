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

#### 1-0. 운영 DB를 Supabase에서 netcup VPS PostgreSQL로 이전하고 데모 복구
- Decision: 사용자가 Supabase 사용을 중단하고 TownPet이 쓰는 netcup VPS(TownPet·kinderp와 공용)의 여유 자원을 쓰기로 했다. 운영 `/api/health?deep=1`이 `database: fail`, `/api/places/map`이 503인 상태(2026-11-23 확인)라 이 이전이 곧 데모 복구다.
- 확정 필요(권장안): ① TownPet DB를 공유하지 않고 altteulmap 전용 PostgreSQL 컨테이너를 따로 둔다(장애·권한 격리, TownPet은 PostGIS 18 `mem_limit` 1024m 내부망 전용). ② Workers는 공개 5432 대신 Cloudflare Tunnel(cloudflared) + Hyperdrive로 접속한다(DB 포트 비공개). 앱은 이미 `HYPERDRIVE` binding을 우선 읽는다.
- Likely files: `deploy/vps/postgres.yml`(신규), `deploy/vps/README.md`(신규), `deploy/vps/backup.sh`(신규), `wrangler.jsonc`, `README.md`, `docs/09-운영-가이드/*`, `docs/adr/0004-request-scoped-db-connection.md`
- Steps:
  - [사용자] VPS 여유 확인: `free -h && df -h && docker stats --no-stream`. 전용 컨테이너 기준 메모리 512MB·디스크 5GB 이상 여유가 있어야 한다.
  - [에이전트] `postgres:17`(contrib 포함, `pg_trgm`) compose 작성: 포트 미공개, named volume, healthcheck, `mem_limit`, 앱 전용 최소 권한 role, 일 1회 `pg_dump` 백업과 보관 정책.
  - [사용자] VPS에 compose 배포, cloudflared tunnel 생성, `wrangler hyperdrive create`로 Hyperdrive 구성 생성. 비밀값은 저장소·채팅에 남기지 않는다.
  - [에이전트] `wrangler.jsonc`에 hyperdrive binding 추가, migration·seed 절차 문서화(`PRODUCTION_DATABASE_URL`로 `npm run db:migrate`, `npm run db:seed:production`, 이후 `npm run db:check:production`).
  - [사용자] 운영 secret `DATABASE_URL` 교체 또는 Hyperdrive binding 연결 후 배포, 환경변수 이름 변경(`docs/09-운영-가이드/secret-교체.md`)과 migration `0020`·`0021` 적용을 함께 한다.
  - [에이전트] 문서의 Supabase 언급(README·TRD·배포·백업·ADR 0004)을 VPS 기준으로 고치고, `npm run map:measure`로 지연을 측정해 ADR에 남긴다.
- Risk: Worker(엣지)와 netcup VPS(유럽 리전 추정) 사이 왕복 지연이 Supabase 서울 대비 크다. 요청당 쿼리 왕복이 2~3회라 p95가 늘 수 있으므로 이전 후 `map:measure` 결과를 비교하고, 목표(지도 조회 p95 1초 이내) 초과 시 Neon 등 가까운 리전 Postgres로 되돌릴 수 있게 `DATABASE_URL`만 바꾸는 구조를 유지한다.
- Verify: `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`, `npm run db:check:production`
- Done: 운영 첫 화면에 장소 목록과 마커가 보이고, 운영 DB가 VPS 전용 컨테이너에서 동작하며 일 1회 백업이 생성된다. `Keep Alive`와 수동 실행한 CI의 `Remote Smoke`가 성공하고 저장소에 Supabase 언급이 없다. (`SMOKE_*` GitHub secret 3개는 사용자가 등록한다.)

## Backlog

- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
