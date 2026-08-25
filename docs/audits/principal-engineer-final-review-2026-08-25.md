# Principal Engineer 최종 인수인계 검토 — 2026-08-25

## 총평

이 저장소는 단일 Worker와 React SPA로 MVP를 운영하기에 충분히 명료하며, 최근 보안·신뢰성 보강도 실질적인 위험을 줄였다. 그러나 수년간 기능과 사용자가 늘어난다고 가정하면 인증·가격·관리자 상태가 여러 경계에 흩어져 있고, 실제 운영 환경 검증이 코드 검증보다 뒤처져 있다. 지금 필요한 것은 대규모 재작성보다 데이터 생명주기와 운영 검증을 먼저 고정하는 일이다.

## 가장 중요한 판단

| 질문 | 판단 | 구체적 근거 |
| --- | --- | --- |
| 가장 위험한 코드 | 세션 디코더와 관리자 진입 경로 | `src/worker/auth/session.ts:131-153`는 사용자 역할을 담은 서명 세션을 해석하고, 이 경계의 작은 호환성 예외가 관리자 권한으로 이어질 수 있었다. 이번 검토에서 평문 레거시 세션 허용을 실제로 발견·제거했다. |
| 가장 약한 추상화 | DB/모의 데이터 이중 실행 경계 | `src/worker/routes/*`와 `src/worker/*-repository.ts`가 `USE_MOCK_DATA`·DB 연결·장애 분기를 반복한다. 새 기능이 mock과 production 양쪽에서 다르게 동작할 가능성이 높다. |
| 비용이 가장 큰 기술 부채 | 가격 제보·가격 항목·장소 요약의 분산 생명주기 | `src/worker/admin/admin-price-review-repository.ts:148-251`가 여러 테이블과 검증 수치를 한 트랜잭션에서 갱신한다. 가격 정책이나 provenance를 바꾸기 가장 어렵고 migration 부담도 크다. |
| 성장 시 가장 먼저 깨질 영역 | 전체 지도 검색과 관리자 대기열 | `src/worker/places-read-map-repository.ts:85-95,233-245`의 다중 `%term%` ILIKE와 무제한 row read, 관리자 목록의 비페이지네이션 조회가 데이터 증가에 선형으로 악화된다. |
| 가장 안전하게 수정하기 어려운 영역 | 장소 승인과 가격 summary 동기화 | `src/worker/admin-places-repository.ts:203-273`에서 장소 상태·가격 제보·summary·감사 기록의 순서와 원자성을 동시에 보존해야 한다. |
| 가장 과도하게 설계된 영역 | 지도 SDK 런타임 훅 분해 | `src/features/map`에 SDK 초기화·resize·focus·pending·marker·runtime error를 별도 모듈로 나눈 구조는 기능상 이유가 있지만, 단순한 변경도 여러 훅의 계약을 함께 이해해야 한다. 즉시 합치기보다 안정화 후 경계를 재평가한다. |
| 가장 덜 검증된 영역 | 실제 운영 인증·외부 장애·복구 | 단위 테스트는 강하지만 실제 OAuth provider callback, Cloudflare binding, DB 장애, migration rollback, 백업 복구 리허설은 실행되지 않았다. |
| 가장 보안 민감한 영역 | 세션·OAuth·관리자 권한 | `src/worker/routes/auth-oauth.ts:100-221`에서 외부 주장과 세션 발급이 연결되고, 관리자 API 전체가 같은 세션 경계에 의존한다. |
| 가장 동시성 민감한 영역 | 가격 검수와 비정규화 summary | `admin-price-review-repository.ts`가 advisory lock·CAS·summary 갱신을 함께 수행한다. 잠금 범위나 새 price mutation이 빠지면 검증 수와 대표 가격이 달라진다. |
| 가장 유력한 미래 성능 병목 | global 지도 검색 | `places-read-map-repository.ts:233-267`가 count와 무제한 정렬 row 조회를 병렬 실행하고, 검색 조건은 여러 text column의 ILIKE다. 결과를 나중에 자르더라도 DB work는 줄지 않는다. |

## 이번 주에 바꿀 것

| 순위 | 변경 | 기대 효과와 완료 기준 |
| ---: | --- | --- |
| 1 | 세션 형식 단일화와 관리자 권한 회귀 테스트 유지 | 평문·구형 형식이 다시 인증되지 않도록 한다. 서명 없는 관리자 쿠키, 역할 강등, 계정 삭제 후 요청이 모두 거부되는 테스트를 CI 필수 경로로 유지한다. |
| 2 | staging 운영 계약 테스트 추가 | 실제 OAuth sandbox callback, `GET /api/health?deep=1`, 관리자 읽기, 공개 쓰기, Turnstile 실패를 배포 전 실행한다. “환경 변수가 있다”가 아니라 실제 요청 성공을 승인 기준으로 삼는다. |
| 3 | 백업 복구 리허설과 오류 알림 연결 | PostgreSQL PITR/백업 복구의 RPO·RTO를 기록하고, 5xx·DB unavailable·외부 timeout을 `requestId`와 함께 알림으로 연결한다. |
| 4 | 가격 생명주기 계약 고정 | report → item → place summary 상태 전이를 하나의 도메인 서비스와 integration test로 고정하고, 같은 actor·동시 승인·rollback을 DB에서 검증한다. |
| 5 | 지도·관리자 조회 상한을 DB 작업까지 내리기 | global 검색에 FTS/trigram·페이지네이션·검색어 상한을 적용하고 관리자 대기열을 페이지 단위로 읽는다. 10k/100k 데이터 p95와 rows-read를 측정한다. |
| 6 | mock 모드의 범위 축소 | mock은 local/E2E adapter로만 남기고 production route가 mock 분기를 통해 우회되지 않도록 실행 환경 계약을 한 곳에서 검사한다. |

## 10점 평가

| 영역 | 점수 | 근거 |
| --- | ---: | --- |
| 아키텍처 | 6/10 | Vite React + 단일 Worker + PostgreSQL은 규모에 맞지만, route·repository·mock 경계가 반복되고 가격 요약이 비정규화되어 변경 영향 범위가 넓다. (`src/worker/index.ts:61-180`, `src/worker/places-read-repository.ts:1-75`) |
| 코드 품질 | 7/10 | TypeScript·Zod·구조화된 repository와 fail-closed 처리는 좋다. 반면 인증 호환 경로에서 실제 보안 결함이 발견됐고, route별 오류·DB 분기 중복이 있다. (`src/worker/auth/session.ts:131-145`) |
| 보안 | 8/10 | CSRF, 서명 세션, OAuth state, 방문자 서명, 본문 제한, 관리자 DB role 확인이 있다. 평문 세션 결함은 수정했지만 실제 provider·운영 binding 검증은 남아 있다. (`src/worker/auth/session.ts:149-166`, `src/worker/routes/admin-support.ts:27-60`) |
| 성능 | 6/10 | viewport 캐시·marker cap·DB timeout은 유효하지만 global ILIKE와 무제한 DB row read, 500KB 초과 client chunk 경고가 성장 한계를 만든다. (`src/worker/places-read-map-repository.ts:233-267`) |
| 신뢰성 | 7/10 | 트랜잭션, CAS, timeout, 503, request ID가 있다. 백업 복구, 외부 장애 전환, 운영 알림과 실제 배포 중단 검증은 부족하다. (`src/worker/db.ts:17-35`, `src/worker/index.ts:83-100`) |
| 테스트 가능성 | 7/10 | 단위 25개, 핵심 E2E, migration·동시성 smoke가 있다. 실제 OAuth, production DB, 다중 Worker, 복구·부하 시나리오는 미검증이다. (`tests/unit`, `tests/e2e`, `.github/workflows/ci.yml`) |
| 유지보수성 | 6/10 | 기능별 파일 분리는 명확하지만 지도 훅과 public/admin mock·DB 이중 경계가 많아 기능 추가 시 읽어야 할 파일이 많다. (`src/features/map`, `src/worker/routes`) |
| UX | 7/10 | 데스크톱 지도, 폼 입력 보존, 오류 메시지, 접근성 E2E가 있다. 실제 스크린 리더·외부 SDK 장애 경험은 확인하지 못했다. (`tests/e2e/accessibility.spec.ts`) |
| 프로덕션 준비도 | 6/10 | 배포 가드·health·CI는 갖췄고 기본 검증은 통과한다. 실제 secret/provider/DB smoke, 백업 복구, 관측 알림이 없으므로 조건부 승인만 가능하다. (`scripts/check-cloudflare-deploy.mjs`, `scripts/migrate-production.mjs`) |

## 유지할 것

- 인증과 권한을 분리하고 관리자 요청에서 현재 역할을 재확인하는 정책.
- 가격 검수의 advisory lock·CAS·트랜잭션과 DB 불변조건.
- 요청 본문 상한, 외부 호출 timeout, 503 fail-closed, `requestId` 기반 오류 추적.
- 단위 테스트와 DB/브라우저 E2E를 행동별로 나누는 현재 테스트 방향.

## 잔여 위험

- 실제 OAuth/PKCE와 provider별 프로필·토큰 만료 동작은 원격 검증 전까지 확정할 수 없다.
- 운영 DB 백업·복구와 migration 중단/롤백은 코드만으로 보장되지 않는다.
- 데이터가 증가하면 global 지도 검색, 관리자 queue, Hyperdrive/DB 연결 수가 먼저 운영 한계에 도달할 가능성이 높다.
- 지도 SDK·스크린 리더의 실제 조합은 자동 테스트 결과만으로 승인할 수 없다.

## 변경 사항

- 평문 레거시 세션 쿠키 인증 경로 제거: `/Users/alex/project/altteulmap/src/worker/auth/session.ts`
- 관리자 세션 위조 방지 회귀 테스트 추가: `/Users/alex/project/altteulmap/tests/unit/http-and-rate-limit.test.ts`

## 검증

- `npm run verify` 통과
- 단위 테스트 25개 통과
- `npm run verify:quality` 통과
- `npm run build` 통과(Node `20.20.2`)
- `git diff --check` 통과

## P3 완료 후 재평가

P3에서는 지도 SDK 무한 대기·실패 Promise 재사용을 `8초 timeout`과 실패 후 정리로 제한했고, 지도 패널을 별도 청크로 지연 로딩했다. 초기 client chunk는 `500.31KB`에서 `471.65KB`로 줄고 지도 패널은 `29.30KB` 청크로 분리됐다. SDK 차단 fallback과 Chromium 접근성 3개 경로를 통과했다.

| 영역 | 점수 | 근거 |
| --- | ---: | --- |
| 아키텍처 | 7/10 | 단일 Worker·React·PostgreSQL 경계는 유지하면서 지도 SDK를 지연 로딩하고 DB 조회 상한·관리자 페이지 경계를 추가했다. 가격 생명주기와 mock/production 이중 경계는 여전히 크다. |
| 코드 품질 | 8/10 | TypeScript·Zod·fail-closed 처리와 명시적 SDK 실패 정리가 있다. 관리자 route의 DB 오류 분기 중복은 남아 있다. |
| 보안 | 8/10 | 서명 세션, CSRF, OAuth state, 관리자 DB role 재확인과 입력 상한이 검증됐다. 실제 OAuth provider sandbox 검증은 남아 있다. |
| 성능 | 8/10 | 지도 DB 행 읽기를 `2,000`으로 제한하고 관리자 큐를 최대 `100`개 페이지로 제한했으며 client chunk를 분리했다. global 검색의 text ILIKE와 실제 대규모 p95 측정은 남아 있다. |
| 신뢰성 | 8/10 | DB timeout·트랜잭션·CAS에 더해 외부 지도 SDK timeout·fallback·재로드 가능성을 보장한다. 백업 복구 리허설과 운영 알림은 문서 단계다. |
| 테스트 가능성 | 8/10 | 단위 25개, 접근성, SDK 장애 fallback, Chromium 핵심 여정을 자동화했다. 실제 DB 동시성·OAuth·다중 Worker 부하는 환경 의존적이다. |
| 유지보수성 | 7/10 | 지도 로딩 경계를 분리하고 현재 계획을 종료 상태로 정리했다. 지도 훅 분해와 mock/DB 분기 중복은 장기 비용으로 남는다. |
| UX | 8/10 | SDK 실패 시 장소 preview를 유지하고 데스크톱 목록·상세 이동 및 접근성 검사를 통과했다. 실제 스크린 리더 조합은 별도 확인이 필요하다. |
| 프로덕션 준비도 | 7/10 | 인증·조회 상한·운영 런북·브라우저 장애 검증이 개선됐다. 원격 OAuth/DB smoke, 백업 복구 증명, 모니터링 연동 없이는 완전 승인할 수 없다. |

### 남은 고위험 검증

- 로컬 PostgreSQL 부재로 `npm run test:e2e:all`의 DB 초기화가 실행되지 않았고, 목업 모드의 접근성·SDK fallback 경로만 통과했다.
- `migration:contract`는 `localhost:3118` 서버 부재로 실행되지 않았다.
- 실제 OAuth/PKCE provider, PostgreSQL 백업 복구, 1만/10만 synthetic dataset의 p95·rows-read는 운영 자격 증명과 환경에서 수행해야 한다.

## P0~P3 및 실제 배포 후 재평가

2026-08-25 기준 P0~P3 변경을 `main`에 푸시하고 `https://altteulmap.altteul-lab.workers.dev`에 배포했다. deep health에서 runtime·public-config·auth-providers·database·static-assets가 모두 `ok`였고, 원격 smoke에서 홈·지도·상세·OAuth provider redirect·관리자 미인증 401·공개 쓰기 400 계약을 확인했다.

| 영역 | 점수 | 최신 근거 |
| --- | ---: | --- |
| 아키텍처 | 7/10 | 단일 Worker·React·PostgreSQL 구조와 CI/배포 경계는 명확하다. 가격 summary와 mock/DB 분기 중복은 남아 있다. |
| 코드 품질 | 8/10 | TypeScript·Zod·fail-closed 오류 처리, seed 보호, 운영 검증 스크립트가 있다. 일부 route 오류 분기 중복은 남아 있다. |
| 보안 | 9/10 | 관리자 DB role 재확인, 서명 세션·CSRF·OAuth state, API no-store·본문 상한·seed 이중 확인을 실제 smoke/테스트로 검증했다. 실제 OAuth callback 성공은 미검증이다. |
| 성능 | 8/10 | 지도 2,000행·관리자 100행 cap, timeout, p99 측정 기준을 적용했다. 1만/10만 데이터 실측은 남아 있다. |
| 신뢰성 | 9/10 | PostgreSQL 트랜잭션·CAS·동시성 통합 테스트, API 503/413/429 계약, CI artifact·복구 런북을 갖췄다. 실제 PITR 복구 리허설은 외부 권한이 필요하다. |
| 테스트 가능성 | 9/10 | unit 25개, PostgreSQL integration, 동시성 smoke, E2E, 원격 smoke와 CI 게이트를 연결했다. 실제 provider·부하·복구 시나리오는 남아 있다. |
| 유지보수성 | 8/10 | 실행 계획을 종료 상태로 정리하고 운영 명령·실패 계약·복구 절차를 문서화했다. 기능별 mock/production 중복은 장기 부채다. |
| UX | 8/10 | 데스크톱·접근성·입력 보존·실패 fallback을 검증했다. 실제 스크린리더 조합은 별도 확인이 필요하다. |
| 프로덕션 준비도 | 8/10 | 실제 배포·deep health·공개 원격 smoke까지 통과했다. 관리자 credentials smoke, 백업 복구, 관측 알림 설정이 완료되기 전에는 `READY WITH RISKS`다. |

### 최종 판정

**READY WITH RISKS** — 코드·CI·배포·기본 원격 동작은 승인 가능하지만, 실제 관리자 인증, PITR 복구와 운영 알림을 완료하기 전에는 무조건적인 production 승인으로 올리지 않는다.

## P4~P6 및 재배포 후 최종 점수

P4~P6에서 request telemetry와 API error contract를 공통화하고, 검색어·관리자 page·PostgreSQL query 작업량을 제한했다. `pg_trgm` migration을 원격에 seed 없이 적용했으며, Worker version `5ac57223-4273-43a0-9558-3ae006ee551e`에서 deep health와 공개 원격 smoke를 재통과했다.

| 영역 | 점수 | 최종 근거 |
| --- | ---: | --- |
| 아키텍처 | 8/10 | 단일 Worker·PostgreSQL 경계를 유지하면서 공통 오류 응답·request telemetry·검색 인덱스 migration을 추가했다. mock/production 분기와 가격 summary 결합은 남아 있다. |
| 코드 품질 | 9/10 | TypeScript·Zod·fail-closed 처리, bounded input/page, 공통 error helper와 migration replay가 lint/typecheck/integration을 통과했다. 일부 route 중복은 남아 있다. |
| 보안 | 9/10 | 인증과 권한을 분리하고 관리자 role을 DB에서 재확인하며, API no-store·요청 상한·seed 이중 확인·OAuth redirect를 검증했다. 실제 OAuth callback은 미검증이다. |
| 성능 | 8/10 | 지도 2,000행·관리자 100행·검색어 120자·page 1,000 상한과 trigram index를 적용했다. 1만/10만 dataset p95/p99 실측은 남아 있다. |
| 신뢰성 | 9/10 | DB transaction/CAS·동시성 통합 테스트·503/413/429 contract·request telemetry·migration guard·원격 health를 확보했다. PITR 복구는 외부 리허설이 필요하다. |
| 테스트 가능성 | 9/10 | unit 26개, PostgreSQL integration 6개, 동시성 smoke, E2E, 원격 smoke, CI PostgreSQL gate를 유지한다. 관리자 credentials smoke만 계정 미제공으로 건너뛰었다. |
| 유지보수성 | 8/10 | phase별 migration·운영 런북·공통 오류 계약을 정리했다. 기능별 mock/DB 분기와 일부 중복 route는 장기 과제다. |
| UX | 8/10 | 데스크톱·접근성·입력 보존·장애 fallback을 검증했고 오류 응답 의미를 안정화했다. 실제 스크린리더 조합은 남아 있다. |
| 프로덕션 준비도 | 8/10 | migration·배포·deep health·공개 smoke는 통과했다. 실제 관리자 인증, PITR 복구, Cloudflare 알림 규칙이 완료되기 전에는 `READY WITH RISKS`다. |

## P1~P3 추가 작업 후 재평가

P1에서는 staging credentials smoke에 CSRF·일반 사용자 관리자 API 403·OAuth invalid state callback을 추가했고, source/restore 분리와 명시적 확인이 필요한 backup/restore rehearsal, JSONL telemetry alert parser를 구현했다. P2에서는 실제 Docker PostgreSQL 기준 검색 benchmark, mutation 중복·동시성 회귀, schema/index/timeout contract gate를 추가했다. P3에서는 authorization ownership matrix, 장소 등록 503 입력 보존, 접근성 상태 semantics, dead code·dependency 감사 증거를 추가했다.

| 영역 | 점수 | 근거 |
| --- | ---: | --- |
| 아키텍처 | 9/10 | 기존 단일 Worker·PostgreSQL 경계를 유지하면서 운영 smoke·복구·benchmark·contract 검사 경계를 명시했다. 가격 summary와 mock/production 중복은 여전히 확장 비용이 있다. |
| 코드 품질 | 9/10 | lint/typecheck, Knip 0건, 공통 오류·timeout·bounded query, 명시적인 복구 실패 조건을 유지한다. 일부 route별 DB 오류 분기는 남아 있다. |
| 보안 | 9/10 | authentication과 authorization을 별도 테스트하고 role 강등·bookmark ownership·CSRF·OAuth state를 검증한다. 실제 provider 성공 callback은 외부 sandbox 증거가 필요하다. |
| 성능 | 9/10 | 검색 benchmark가 p50/p95/p99·rows read·payload·plan metric을 기록하고 DB timeout·결과 상한·CI contract를 연결한다. 10만/100만 staging 실측은 남아 있다. |
| 신뢰성 | 9/10 | 동시 mutation·중복 요청·migration replay·backup restore guard·telemetry alert parser를 확보했다. 실제 PITR과 다중 Worker 장애 주입은 운영 권한이 필요하다. |
| 테스트 가능성 | 10/10 | unit·integration·concurrency·authorization·E2E·axe·benchmark·migration contract가 행동별로 분리되어 CI에서 실행된다. 외부 provider/운영 복구는 환경 증거로 별도 관리한다. |
| 유지보수성 | 9/10 | dead code 0건과 dependency 사용 근거를 기록하고 운영 문서·검증 명령·계획을 현재 상태와 일치시켰다. mock/DB adapter 통합은 향후 ROI를 재평가한다. |
| UX | 9/10 | 네트워크/503 입력 보존, 접근 가능한 오류 알림, 지도 fallback, 키보드·axe 경로를 검증한다. 실제 스크린리더 기기 검증은 남아 있다. |
| 프로덕션 준비도 | 9/10 | 코드·CI·로컬 DB contract·검색 증거·권한 matrix가 강화됐다. staging OAuth 성공, 실제 backup/PITR, Cloudflare 알림 수신 증거 전에는 `READY WITH RISKS`다. |

### 이번 주 우선순위 갱신

1. 운영 계정으로 OAuth sandbox 성공 callback과 일반 사용자 권한 smoke를 실행하고 artifact를 보관한다.
2. 승인된 staging clone에서 backup/restore rehearsal을 실행해 RPO/RTO와 `evidence.json`을 확정한다.
3. Cloudflare Logpush/Sentry에 `requestId`, status, latency, DB/OAuth failure event를 연결하고 alert delivery를 확인한다.
4. 10만/100만 staging dataset에서 검색 p95/p99와 rows read를 측정한다.
