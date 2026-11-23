# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 백엔드 신입 채용 리뷰에서 지적될 보안·설계·저장소 위생 결함을 제거한다.

Observable finish state:
- 운영 데모가 실제 데이터로 동작하고, 정기 smoke가 실패하면 알 수 있다.
- 관리자 대시보드와 화면에 가짜 지표·빈 화면이 없고, UI가 `.impeccable.md` 기준과 일치한다.
- 운영 인증 경로에 하드코딩 계정·mock 분기가 없고, 세션은 DB에서 폐기 가능하다.
- 익명 rate limit은 쿠키 없이 우회되지 않는다.
- route → service → repository 계층과 도메인 에러 타입이 있고, 도메인 규칙은 DB 없이 unit test된다.
- `docs/`는 기준 문서 1벌 + ADR 중심이며, Next.js 잔재와 마이그레이션 drift가 없다.
- `npm run verify`, `npm run test:integration`, `npm run test:e2e:full`, `npm audit --omit=dev --audit-level=high`가 통과한다.

공통 integration 실행 명령(이하 `INTEGRATION`): `npm run test:integration:local`

## Active

### Phase 1. 데모 복구와 인증·남용 방지 결함 제거

#### 1-0. 운영 데모 복구 (수동 blocker만 남음)
- Current blocker: 운영 `/api/health?deep=1`이 `database: fail`, `/api/places/map`이 503이다(2026-11-23 확인, Supabase 비활성 일시정지 추정). GitHub secret `SMOKE_PUBLIC_URL`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`가 없다. 둘 다 사용자가 직접 처리해야 한다.
- Next action: 사용자가 Supabase 프로젝트를 복구하고 secret 3개를 등록한 뒤 `gh workflow run keep-alive.yml && gh workflow run ci.yml`로 확인한다.
- Verify: `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`
- Done: 운영 첫 화면에 장소 목록과 마커가 보이고, `Keep Alive`와 수동 실행한 CI의 `Remote Smoke`, `E2E Full`이 성공한다.

### Phase 2. 서비스 계층·에러 모델·테스트 구조

#### 2-4. 나머지 도메인 서비스 계층 확장 (2-3 패턴 적용)
- 기준 구현: `src/worker/services/price-report-service.ts`(서비스) · `price-report-stores.ts`(DB/mock 선택을 한 곳에서) · `price-report-rules.ts`(순수 규칙) · `tests/unit/price-report-service.test.ts`(in-memory fake). 새 도메인은 이 구조를 그대로 따른다.
- Likely files: slice를 도메인별로 나눠 진행한다. `src/worker/services/*`, `src/worker/routes/admin-prices.ts`(가격 검수), `public-write-submissions.ts`, `public-write-comments.ts`, `public-write-reports.ts`, `auth-credentials.ts`, 해당 repository
- Changes:
  - 도메인당 1 slice로 서비스·store·규칙을 만들고 라우트의 `isWorkerDatabaseEnabled`/`isWorkerMockDataEnabled`/미설정 3분기를 제거한다. 라우트는 HTTP(파싱·rate limit·Turnstile·응답)만 맡고 실패는 `DomainError`로 던진다.
  - 가격 검수 승인(`moderateWorkerPriceReport`)의 결과 객체(`{ok:false,message}`)를 `DomainError(CONFLICT|NOT_FOUND)`로 바꾸고 서비스 뒤로 옮긴다.
  - `src/worker`의 평탄 파일을 `places/`, `auth/`, `moderation/`, `admin/` 폴더로 이동한다.
- Verify: `npm run verify && INTEGRATION && npm run test:e2e:full && npm run hygiene:dead-code`
- Done: `grep -rln "isWorkerMockDataEnabled" src/worker/routes` 0건, `src/worker` 루트에 `index.ts`, `db.ts`만 남는다.

## Backlog

- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
