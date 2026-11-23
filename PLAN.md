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

#### 1-0. 운영 DB를 Supabase에서 netcup VPS PostgreSQL로 이전하고 데모 복구 (사용자 작업 남음)
- Done in 이전 작업: 전용 컨테이너·cloudflared compose, 최소 권한 role 스크립트, 백업 스크립트, SSH 터널용 `PRODUCTION_VIA_SSH_TUNNEL` 스크립트 옵션, 절차 문서(`deploy/vps/README.md`)와 Supabase 문구 정리. 로컬에서 migration → role 부여 → seed → 앱 통합 테스트 27개(최소 권한 role) → 백업까지 검증했다.
- Current blocker: 아래는 VPS·Cloudflare 계정 권한이 필요해 사용자가 직접 한다. 현재 운영 `/api/health?deep=1`은 Supabase가 멈춘 상태라 `database: fail`이다.
- Next action (순서대로, 자세한 명령은 `deploy/vps/README.md`):
  1. VPS 여유 확인(`free -h && df -h && docker stats --no-stream`), compose·비밀 파일 배치, `postgres` 기동.
  2. SSH 터널로 `PRODUCTION_VIA_SSH_TUNNEL=1 npm run db:migrate`(migration 0020·0021 포함), 빈 DB에 `db:seed:production`, `grant-app-role.sh` 실행.
  3. Cloudflare Tunnel 생성 → 게시 경로(`tcp://postgres:5432`) → Access service token → `wrangler hyperdrive create` → `wrangler.jsonc`에 hyperdrive binding 추가.
  4. 환경변수 이름 변경(`docs/09-운영-가이드/secret-교체.md`) 후 `npm run deploy`. 로컬 `.env.production.local`의 옛 Supabase `DATABASE_URL`도 교체.
  5. 백업 cron 등록. GitHub secret `SMOKE_PUBLIC_URL`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD` 등록 후 `gh workflow run keep-alive.yml && gh workflow run ci.yml`.
  6. `npm run map:measure`로 Worker↔VPS 지연을 재고 결과와 판단을 ADR 0004에 기록한다(목표 p95 1초, 초과 시 가까운 리전 Postgres로 `DATABASE_URL`만 교체).
- Verify: `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`, `npm run db:check:production`
- Done: 운영 첫 화면에 장소 목록과 마커가 보이고, 운영 DB가 VPS 전용 컨테이너에서 동작하며 일 1회 백업이 생성된다. `Keep Alive`와 수동 실행한 CI의 `Remote Smoke`가 성공한다.

## Backlog

- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
