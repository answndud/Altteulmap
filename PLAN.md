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

공통 integration 실행 명령(이하 `INTEGRATION`):
`TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=x npm run test:integration`
(Phase 2-1 완료 후에는 `npm run test:integration` 단독으로 대체한다.)

## Active

### Phase 1. 데모 복구와 인증·남용 방지 결함 제거

#### 1-0. 운영 데모 복구 (수동 blocker만 남음)
- Current blocker: 운영 `/api/health?deep=1`이 `database: fail`, `/api/places/map`이 503이다(2026-11-23 확인, Supabase 비활성 일시정지 추정). GitHub secret `SMOKE_PUBLIC_URL`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`가 없다. 둘 다 사용자가 직접 처리해야 한다.
- Next action: 사용자가 Supabase 프로젝트를 복구하고 secret 3개를 등록한 뒤 `gh workflow run keep-alive.yml && gh workflow run ci.yml`로 확인한다.
- Verify: `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`
- Done: 운영 첫 화면에 장소 목록과 마커가 보이고, `Keep Alive`와 수동 실행한 CI의 `Remote Smoke`, `E2E Full`이 성공한다.

#### 1-1. 운영 인증에서 폴백 계정과 mock 분기 제거
- Likely files: `src/worker/auth-repository.ts`, `src/worker/auth-repository-support.ts`, `src/worker/db.ts`, `tests/integration/authorization.test.ts`
- Changes:
  - `legacyAuthFallbackPasswords`(`admin1234`/`demo1234`)와 `allowLegacyFallback` 경로를 삭제한다.
  - `verifyWorkerCredentials`는 `USE_MOCK_DATA === "true"`일 때만 mock 사용자를 허용하고, circuit breaker가 열린 경우(`isDatabaseTemporarilyUnavailable`)에는 503 성격의 `DATABASE_UNAVAILABLE` 결과를 반환한다.
  - DB 모드에서 env 비밀번호 평문 비교(`matchesKnownAccountPassword`) → `toLocalUser` 폴백을 제거하고 DB 사용자 + scrypt 검증만 사용한다.
  - integration test 추가: breaker가 열린 상태에서 `admin@altteulmap.local`/`admin1234` 로그인이 실패한다.
- Verify: `npm run verify && INTEGRATION`
- Done: `grep -rn "admin1234\|legacyAuthFallback" src` 결과가 0건이고 새 테스트가 통과한다.

#### 1-2. DB 기반 세션으로 전환 (폐기·role 재확인)
- Likely files: `src/worker/auth/session.ts`, `src/worker/routes/auth-session.ts`, `src/db/schema-auth.ts`, `tests/integration/authorization.test.ts`
- Changes:
  - 로그인 시 랜덤 256bit 토큰을 발급하고 `auth_sessions.session_token`에는 SHA-256 해시만 저장한다(만료 7일, sliding 갱신 여부는 ADR에 기록).
  - 쿠키에는 토큰만 넣고 role/email은 넣지 않는다. 요청마다 세션 행 + `users.role`을 조회한다.
  - 로그아웃 시 세션 행을 삭제하고, 사용자별 전체 세션 폐기 함수(role 강등·비밀번호 변경 시 호출)를 둔다.
  - 쿠키 이름을 `altteulmap.session` 등 프로젝트 이름으로 바꾼다(기존 `next-auth.*` 쿠키는 무시).
  - 댓글 삭제(`places-write-comments-repository.ts:142`)의 admin 판정이 DB role 기준이 되는지 테스트한다.
  - integration test: 로그아웃 후 같은 쿠키로 요청하면 401, role 강등 후 댓글 삭제가 403.
- Verify: `npm run verify && INTEGRATION && npm run test:e2e:smoke`
- Done: 세션 쿠키 payload에 role이 없고, 로그아웃·강등 테스트가 통과한다.

#### 1-3. 익명 rate limit 우회 차단과 정리 비용 제거
- Likely files: `src/worker/public-write-actor.ts`, `src/worker/rate-limit-repository.ts`, `src/worker/routes/public-write-reactions.ts`, `tests/integration/api-failure-paths.test.ts`
- Changes:
  - 익명 actor의 rate limit 키를 `CF-Connecting-IP`(로컬은 고정 fallback) 기반으로 바꾸고, visitor 쿠키 유무와 무관하게 IP 버킷을 함께 소비한다. `x-forwarded-for` 신뢰를 제거한다.
  - 로그인 rate limit에 IP와 무관한 email 단위 버킷을 추가한다.
  - 요청마다 실행하는 `DELETE WHERE expires_at < now`를 제거하고 Worker `scheduled` handler(cron) 또는 1% 확률 정리로 옮긴다(`wrangler.jsonc` cron 추가 포함 시 파일 1개 추가).
  - 반응 API에도 rate limit 정책을 적용한다.
  - integration test: 쿠키 없이 같은 IP로 반복 등록하면 429.
- Verify: `npm run verify && INTEGRATION`
- Done: 쿠키 미포함 반복 요청 테스트가 429를 반환하고 rate limit 핫패스에 DELETE 쿼리가 없다.

#### 1-4. 상태 판정·에러 노출·CSRF 정리
- Likely files: `src/worker/routes/auth-credentials.ts`, `src/worker/auth-repository.ts`, `src/worker/routes/health.ts`, `src/worker/index.ts`
- Changes:
  - 회원가입 중복을 메시지 문자열 대신 결과 코드(`EMAIL_TAKEN`)로 판정하고, 동시 가입의 unique 위반(23505)을 409로 매핑한다.
  - `/api/health` 공개 응답에서 DB 원본 에러 메시지를 제거하고 로그에만 남긴다.
  - `/api/*` 변경 요청에 `Origin`/`Sec-Fetch-Site` 검사 미들웨어를 추가하고, JSON 엔드포인트는 `Content-Type: application/json`만 허용한다.
  - OAuth access/refresh token을 DB에 저장하지 않도록 변경한다.
- Verify: `npm run verify && INTEGRATION && npm run test:e2e:smoke`
- Done: `grep -rn 'message.includes(' src/worker/routes` 0건, cross-origin POST가 403, 동시 가입 테스트가 409/201만 반환한다.

### Phase 2. 서비스 계층·에러 모델·테스트 구조

#### 2-1. 테스트 DB 분리와 integration 실행 경로 정리
- Likely files: `tests/integration/test-database.ts`, `package.json`, `docker-compose.yml`, `docs/04-실행-가이드/테스트-워크플로.md`
- Changes:
  - 테스트 전용 DB(`altteulmap_test`)를 기본값으로 쓰고, 실행 전 migrate하는 `test:integration:local` 스크립트를 추가한다.
  - `.github/workflows/ci.yml`의 `TEST_DATABASE_URL`도 테스트 DB로 맞춘다.
- Verify: `npm run db:local:up && npm run test:integration:local`
- Done: 개발 DB 데이터가 테스트 실행 전후로 변하지 않는다.

#### 2-2. 도메인 에러 타입과 단일 에러 응답 형식
- Likely files: `src/worker/http/errors.ts`, `src/worker/routes/admin-support.ts`, `src/worker/routes/public-write-support.ts`, `tests/unit/http-and-rate-limit.test.ts`
- Changes:
  - `DomainError`(code, httpStatus, publicMessage)와 `Result<T, DomainError>` 타입을 정의한다.
  - 모든 실패 응답을 `{ ok:false, error:{ code, message, details? }, requestId }` 하나로 통일한다(zod 실패는 `VALIDATION_FAILED` + `details`).
  - 에러 코드 목록을 `docs/02-설계/API-계약-지도.md`에 표로 남긴다.
- Verify: `npm run verify && INTEGRATION`
- Done: 라우트에서 `c.json({ ok: false, message` 직접 생성 0건.

#### 2-3. 가격 제보·검수 서비스 계층 도입 (파일럿)
- Likely files: `src/worker/services/price-report-service.ts`(신규), `src/worker/routes/public-write-price-reports.ts`, `src/worker/routes/admin-prices.ts`, `tests/unit/price-report-service.test.ts`(신규)
- Changes:
  - 상태 전이 규칙(pending→approved/rejected, 중복 승인 거부, 금액 경계)을 순수 함수로 서비스에 옮긴다.
  - repository는 interface로 주입받고, mock 구현은 `USE_MOCK_DATA`일 때 조립 지점(`index.ts`) 한 곳에서만 선택한다. 라우트의 DB/mock/미설정 3분기를 제거한다.
  - in-memory fake repository로 상태 전이 unit test를 작성한다.
- Verify: `npm run verify && INTEGRATION && npm run test:e2e:full`
- Done: 대상 라우트에 `isWorkerMockDataEnabled` 호출 0건, 서비스 unit test 10개 이상 통과.

#### 2-4. 나머지 도메인(장소 등록·댓글·신고·인증) 서비스 계층 확장
- Likely files: slice를 도메인별로 나눠 진행한다. `src/worker/services/*`, 해당 `src/worker/routes/public-write-*.ts`, `src/worker/routes/auth-credentials.ts`, `tests/unit/*-service.test.ts`
- Changes: 2-3 패턴을 도메인당 1 slice로 적용하고, `src/worker`의 평탄 파일을 `places/`, `auth/`, `moderation/`, `admin/` 폴더로 이동한다.
- Verify: `npm run verify && INTEGRATION && npm run test:e2e:full && npm run hygiene:dead-code`
- Done: `grep -rln "isWorkerMockDataEnabled" src/worker/routes` 0건, `src/worker` 루트에 `index.ts`, `db.ts`만 남는다.

### Phase 3. 저장소 위생·화면 정직성·문서 정리

#### 3-0. 로컬 실행 경로 복구
- Likely files: `README.md`, `.gitignore`, `.dev.vars.example`(신규), `docs/04-실행-가이드/로컬-개발-워크플로.md`
- Changes:
  - Cloudflare vite plugin은 `.dev.vars`가 있으면 `.env`를 읽지 않는다. 그래서 `npm run db:local:setup && npm run dev`를 해도 `DATABASE_URL`이 Worker에 전달되지 않아 지도 API가 503이 된다. 이 동작을 README에 적는다.
  - Worker 런타임 변수는 `.dev.vars` 하나로 통일하고, 로컬 DB 값이 든 `.dev.vars.example`을 커밋한다(`.gitignore`에 `!.dev.vars.example`).
- Verify: `cp .dev.vars.example .dev.vars && npm run db:local:setup && npm run dev` 실행 후 `curl -s -o /dev/null -w '%{http_code}' 'http://localhost:5173/api/places/map?minLat=37.4&maxLat=37.7&minLng=126.7&maxLng=127.3&zoom=11'`
- Done: 새 clone에서 README 순서만 따라 해도 위 curl이 200을 반환한다.

#### 3-1. Next.js 잔재와 env 템플릿 정리
- Likely files: `src/lib/env.ts`, `src/worker/index.ts`, `src/features/map/naver-map-sdk.ts`, `.gitignore`
- Changes:
  - `NEXTAUTH_URL` → `SITE_URL`, `NEXT_PUBLIC_*` → `NAVER_MAP_*`/`TURNSTILE_SITE_KEY`로 이름을 바꾸고 CI·문서·wrangler 설정을 함께 갱신한다(운영 secret 이름 교체 절차를 `docs/09-운영-가이드/secret-교체.md`에 반영).
  - 쓰지 않는 `auth_verification_tokens` 테이블과 `session_state`/`id_token` 컬럼을 migration으로 제거한다.
  - `.gitignore`에 `!.env.example`을 추가해 `.env.example`을 커밋하고(비밀번호 값은 placeholder), legacy Next 경로를 지운다. `next-env.d.ts`를 삭제한다.
  - `AssetFetcher`·`Bindings` 타입과 쿠키 유틸 중복을 `src/worker/http`로 합친다.
- Verify: `npm run verify && npm run cf:build:vite && npm run deploy:check:vite && npm run test:e2e:smoke`
- Done: `grep -rn "NEXTAUTH\|NEXT_PUBLIC\|next-auth" src scripts .github` 0건, `git ls-files .env.example` 출력이 있다.

#### 3-2. 마이그레이션 drift·의존성 취약점 정리
- Likely files: `drizzle/meta/_journal.json`, `src/db/schema-place-core.ts`, `.github/workflows/ci.yml`, `package.json`
- Changes:
  - trigram GIN 인덱스를 `schema-place-core.ts`에 선언해 `db:generate` 결과와 DB가 일치하게 한다. no-op인 0019의 사유를 SQL 주석으로 남기고, 저널 수기 편집 금지를 `database-migrations` 기준에 맞춰 문서화한다(적용된 migration 파일 자체는 삭제하지 않는다).
  - `bookmarks.place_id`, `price_reports.reporter_user_id` FK 인덱스를 추가한다.
  - hono·zod를 패치 버전으로 올리고 CI audit 게이트를 `--audit-level=high`로 올린다.
- Verify: `npm run db:generate && git diff --exit-code drizzle src/db && npm audit --omit=dev --audit-level=high && npm run db:check:contract && INTEGRATION`
- Done: drift 검사와 audit high 게이트가 통과한다.

#### 3-3. 관리자 대시보드 KPI를 실제 집계로 교체
- Likely files: `src/client/routes/admin/AdminDashboardRoute.tsx`, `src/worker/admin-repository.ts`, `src/worker/routes/admin.ts`, `tests/integration/authorization.test.ts`
- Changes:
  - "운영", "활성", "집계", "비율", "추적"처럼 단어가 들어간 KPI 카드를 지운다.
  - `GET /api/admin/stats` 하나로 실제 값을 내려준다: 전체 사용자 수, 7일 신규 가입, 승인 대기(장소·가격·신고), 7일 제보 수, 7일 승인율, 최근 승인 시각. 집계는 기존 인덱스를 타는 단일 쿼리 또는 `count(*) FILTER (WHERE ...)`로 작성하고, 실행 계획을 확인한다.
  - 관리자 권한 검사를 integration test로 고정하고, 값이 0인 빈 상태 문구도 정한다.
- Verify: `npm run verify && INTEGRATION && npm run test:e2e:full`
- Done: 대시보드의 모든 KPI가 숫자이고, `/api/admin/stats` 비관리자 요청은 401/403이다.

#### 3-4. 라우팅 빈 화면과 콘솔 오류 제거
- Likely files: `src/client/App.tsx`, `src/client/routes/NotFoundRoute.tsx`(신규), `src/client/routes/admin/AdminRoutes.tsx`, `src/worker/http/security-headers.ts`
- Changes:
  - catch-all 경로(`*`)와 404 화면(지도로 돌아가기 링크)을 추가하고, 없는 `/place/:id`도 같은 화면을 보여 준다.
  - 인증 전에는 관리자 탭을 숨기고 로그인 안내만 보여 준다.
  - CSP `connect-src`가 네이버 SDK 로그 호스트(`kr-col-ext.nelo.navercorp.com`)를 막아 콘솔 오류가 난다. 허용 여부를 결정하고 결과를 `docs/project/strict-csp-inventory-2026-05-08.md`에 기록한다.
- Verify: `npm run verify && npm run test:e2e:smoke`
- Done: `/does-not-exist`와 `/place/unknown`에서 404 화면이 보이고, 운영 첫 화면 콘솔에 CSP 위반이 없다.

#### 3-5. 지도 첫 화면 단순화와 목록·지도 연동
- Likely files: `src/client/routes/MapRoute.tsx`, `src/client/features/map/MapSearchControls.tsx`, `src/client/features/map/PlaceDetailSheet.tsx`, `src/features/map/naver-map-marker-visuals.ts`
- Changes:
  - 지도 위 제목·설명 블록과 지도 안의 "알뜰 지도" 설명 카드를 제거한다. 첫 화면 헤더는 검색 한 줄과 필터 한 줄로 줄인다.
  - 버튼 라벨을 정리한다: "현재 화면", "현재 화면 중심", "가격 중심 카드", "지도 영역 검색" → `이 지역 다시 찾기` 하나로 합친다. 필터 토글 라벨은 `열기`/`닫기`로 바뀌게 하고, 쓰임이 없는 빈 입력칸을 제거한다. 필터는 지도를 밀어내지 않는 popover로 연다.
  - 데스크톱 목록 rail 폭을 420~480px로 넓히고, 카드에서 반복 설명 문구를 뺀다.
  - 목록에서 장소를 고르면 지도를 그 마커로 이동하고 강조한다. 클러스터 마커에는 최저가("6,000원~")를 보여 준다.
- Verify: `npm run verify && npm run test:e2e:full && npm run design:detect`
- Done: 1440×900에서 지도가 첫 화면 높이의 75% 이상을 차지하고, 목록에서 고른 장소가 지도 중앙에 강조되는 E2E가 통과한다.

#### 3-6. 디자인 토큰 일치와 상세 페이지 정리
- Likely files: `src/client/styles.css`, `.impeccable.md`, `src/client/routes/PlaceDetailRoute.tsx`, `src/client/features/map/PlaceDetailSheet.tsx`
- Changes:
  - `.impeccable.md`는 따뜻한 톤(배경 `#f4f1ec`, 강조색 `#b55a2b`)을 기준으로 하는데 실제 화면은 파랑(`oklch(0.48 0.17 255)`)이다. 문서 기준으로 맞출지, 문서를 고칠지 정해 한쪽으로 통일한다.
  - 글자 크기를 11px, 11.52px, 12px처럼 비슷한 값이 섞인 상태에서 5단계 이하로 줄인다.
  - 상세 시트와 상세 페이지의 카드 안의 카드를 제거한다.
  - 상세 페이지에 위치를 보여 주는 작은 지도를 추가한다. "메모"에 그대로 노출되는 `출처/수집일/전화` 원본 문자열은 각각 정리된 항목으로 보여 준다(import 정규화 또는 mapper에서 분리).
- Verify: `npm run verify && npm run test:e2e:full && npm run design:detect && npm run readme:screenshots`
- Done: 화면 색상과 `.impeccable.md` 토큰이 같고, 상세 페이지에 지도·출처·전화가 각각 따로 보이며, README 스크린샷이 갱신된다.

#### 3-7. 문서 단일화와 ADR 작성
- Likely files: `docs/문서-안내.md`, `docs/adr/*.md`(신규), `README.md`, `docs/product/*`
- Changes:
  - PRD/TRD는 `docs/product`만 남기고 `docs/01-기준` 중복을 제거한다. 운영 문서는 `docs/09-운영-가이드`로 합치고 `docs/ops`를 제거한다.
  - `docs/audits/*`, `docs/blog/*` 초안, `docs/resume/*`, `docs/08-면접-복기/*`는 저장소 밖(개인 비공개 저장소)으로 옮긴다. 삭제 전 사용자 확인을 받고, Git history 잔존 여부는 사용자에게 알린다.
  - ADR 5개: DB 세션 vs 서명 쿠키, rate limit 저장소(Postgres vs KV/Durable Object), advisory lock vs row lock, 요청당 연결·Hyperdrive, offset vs cursor pagination.
  - README에 백엔드 관점 요약(아키텍처 그림, 핵심 트레이드오프 3개, integration 실행법)을 넣고 수치·테스트 개수를 실제 값으로 맞춘다.
- Verify: `npm run verify && git diff --check`
- Done: `docs/` md 파일 수 30개 이하, README의 모든 링크가 존재하는 파일을 가리킨다.

## Backlog

- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
