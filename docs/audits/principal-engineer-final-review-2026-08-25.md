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
| UX | 7/10 | 모바일 지도, 폼 입력 보존, 오류 메시지, 접근성 E2E가 있다. 실제 iOS·저사양·스크린 리더·외부 SDK 장애 경험은 확인하지 못했다. (`tests/e2e/map.mobile.spec.ts`, `tests/e2e/accessibility.spec.ts`) |
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
- 지도 SDK·모바일 브라우저·스크린 리더의 실제 조합은 자동 테스트 결과만으로 승인할 수 없다.

## 변경 사항

- 평문 레거시 세션 쿠키 인증 경로 제거: `/Users/alex/project/altteulmap/src/worker/auth/session.ts`
- 관리자 세션 위조 방지 회귀 테스트 추가: `/Users/alex/project/altteulmap/tests/unit/http-and-rate-limit.test.ts`

## 검증

- `npm run verify` 통과
- 단위 테스트 25개 통과
- `npm run verify:quality` 통과
- `npm run build` 통과(Node `20.20.2`)
- `git diff --check` 통과
