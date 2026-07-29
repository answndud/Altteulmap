# AltteulMap 감사·개선 작업 회고

> 면접과 개인 회고를 위한 작업 기록입니다. 무엇을 만들었는가보다 어떤 위험을 발견했고, 어떤 근거로 고쳤으며, 어떻게 검증했는가를 중심으로 정리했습니다.

- 작성일: 2026-07-31
- 프로젝트: AltteulMap
- 운영 URL: https://altteulmap.altteul-lab.workers.dev
- 기술 스택: React/Vite, Hono, Cloudflare Workers, Drizzle ORM, PostgreSQL, NAVER Maps, Playwright

## 1. 한 문장 요약

알뜰맵을 단순한 지도 MVP가 아니라, 익명 제보와 가격 데이터가 실제 운영 환경에서 악용되거나 오염되지 않도록 인증·권한·데이터 정합성·migration·CI·E2E까지 다시 검증하고 보강한 작업이다.

## 2. 전체 요약

### 문제

저렴한 장소 정보는 있지만 가격 최신성과 신뢰도가 낮았고, 사용자 제보를 열면 abuse와 데이터 오염 위험이 생겼다. 초기 위험 기반 감사에서 P0 0건, P1 4건, P2 10건, P3 3건을 확인했다.

핵심 위험은 다음과 같았다.

- AUTH_SECRET 누락 시 인증이 안전하게 실패하지 않을 가능성
- unsigned visitor cookie가 rate limit·ownership·가격 신뢰의 actor로 사용됨
- production에서 mock/Turnstile bypass가 활성화될 가능성
- 가격 제보 중복과 verification count가 actor/provenance를 충분히 보존하지 않음
- 장소 승인 시 가격 report/item/대표 가격 summary가 분리됨
- 관리자 mutation에 stale 상태 보호가 부족함
- wide bbox/global search가 DB·Worker 비용을 키울 수 있음
- 좌표·금액·count invariant가 DB가 아닌 application validation에 의존함
- migration replay와 production preflight가 부족함
- 공공데이터 source/external id/import batch가 보존되지 않음

### 결과

- fail-closed session과 signed visitor actor
- Turnstile·request body cap·production mock guard
- 가격 provenance·idempotency·distinct verification
- 관리자 CAS와 transaction 기반 summary 재계산
- 좌표·금액·moderation DB constraints
- map bounds/global result cap
- 공공데이터 provenance와 중복 후보 분석 도구
- moderation suggestion lifecycle와 malformed output 검증
- migration history/data preflight
- OAuth malformed response·accessibility·full E2E 자동 검증

자동 검증 가능한 범위의 종합 상태는 95/100으로 평가했다. 완벽하다고 말하지 않은 이유는 실제 OAuth provider 성공 흐름, production migration/deploy, React Router upstream advisory, 장소 merge 정책이 남아 있기 때문이다.

## 3. 시스템 흐름

    React/Vite UI
      → Hono Worker route
      → Zod validation
      → session 또는 signed visitor actor
      → Turnstile / rate limit / body cap
      → domain repository
      → Drizzle transaction
      → PostgreSQL
      → 관리자 검수
      → 공개 지도·상세 화면 갱신

주요 기능은 지도 viewport·global search, 가격 항목·이력, 댓글·반응·공유, 비회원 제보, credentials/Kakao/Naver 로그인, 관리자 검수, AI 1차 검수 제안이다.

기준 감사 보고서:

- [full-repository-audit-2026-07-31.md](../audits/full-repository-audit-2026-07-31.md)

## 4. 단계별 개선 작업

### 4.1 세션·OAuth·공개 write

관련 파일:

- [session.ts](../../src/worker/auth/session.ts)
- [auth-oauth.ts](../../src/worker/routes/auth-oauth.ts)
- [auth-oauth-support.ts](../../src/worker/routes/auth-oauth-support.ts)
- [public-write-actor.ts](../../src/worker/public-write-actor.ts)
- [request-body.ts](../../src/worker/http/request-body.ts)

변경:

- AUTH_SECRET이 없으면 signing/verification이 fallback으로 진행되지 않고 fail-closed
- OAuth state에 provider·nonce·expiry를 포함하고 cookie state와 비교
- callback error에서도 state/callback cookie를 제거
- OAuth token response를 schema로 검증하고 malformed response를 거부
- visitor id를 AUTH_SECRET 기반 signed payload로 발급
- cookie 재발급으로 기존 actor를 주장하지 못하게 함
- 댓글 삭제·반응·신고·가격 제보가 같은 signed actor 정책을 사용
- Turnstile bypass를 local hostname으로 제한
- Content-Length만 믿지 않고 request stream을 읽어 mutation body를 256KB로 제한

핵심 판단:

> 익명성을 없애지 않으면서도 actor의 무결성은 보장해야 한다. 개발 편의용 fallback은 인증 경계에서 허용하지 않는다.

### 4.2 가격·장소 데이터 정합성

관련 파일:

- [schema-pricing.ts](../../src/db/schema-pricing.ts)
- [schema-place-core.ts](../../src/db/schema-place-core.ts)
- [price-report-identity.ts](../../src/worker/price-report-identity.ts)
- [places-write-price-reports-repository.ts](../../src/worker/places-write-price-reports-repository.ts)
- [admin-price-review-repository.ts](../../src/worker/admin/admin-price-review-repository.ts)
- [admin-places-repository.ts](../../src/worker/admin-places-repository.ts)

변경:

- reporterUserId, signed reporterVisitorId, submissionKey 보존
- 동일 actor·동일 내용 재전송을 unique key로 멱등 처리
- verification count를 distinct actor 기준으로 계산
- 장소 승인에서 initial report/item/대표 가격 summary를 transaction으로 갱신
- 장소 승인과 가격 검수에 stale 상태 확인 및 affected row check 적용
- latitude/longitude 범위, amount 양수, verified count 음수 방지 DB check 추가

핵심 모델:

    제보 row 수 ≠ 신뢰 가능한 독립 검증 수
    신뢰 가능한 검증 수 = 서로 다른 user 또는 signed visitor actor의 확인 수

### 4.3 관리자·AI 검수 경계

관련 파일:

- [admin-reports-repository.ts](../../src/worker/admin-reports-repository.ts)
- [schema-moderation.ts](../../src/db/schema-moderation.ts)
- [schema-enums.ts](../../src/db/schema-enums.ts)
- [moderation-suggestion-validation.ts](../../src/worker/admin/moderation-suggestion-validation.ts)

변경:

- 최종 처리된 신고를 open/reviewing 상태로 다시 덮어쓰지 못하게 CAS 적용
- moderation suggestion에 pending/applied/superseded lifecycle 추가
- modelVersion, promptVersion, inputFingerprint 필드 추가
- confidence 0~100, summary 길이 DB check 추가
- 관리자 큐에는 pending suggestion만 표시
- malformed output은 자동 approve가 아니라 review/malformed flag로 fail-closed

핵심 판단:

> AI 제안은 운영자의 판단을 보조할 뿐, 공개 데이터 상태를 직접 확정하지 않는다.

### 4.4 지도·공공데이터·운영 도구

관련 파일:

- [places-read.ts](../../src/worker/routes/places-read.ts)
- [places-read-map-repository.ts](../../src/worker/places-read-map-repository.ts)
- [measure-map-api.mjs](../../scripts/measure-map-api.mjs)
- [seed.ts](../../src/db/seed.ts)
- [analyze-place-duplicates.mjs](../../scripts/analyze-place-duplicates.mjs)

변경:

- bbox finite 여부, min/max 관계, 범위 검증
- global/map query 반환 row cap
- wide-bbox benchmark scenario
- places·price items·price reports에 sourceProvider/sourceExternalId/sourceImportBatch 보존
- GoodPrice seed에 stable external id와 import batch 기록
- 동일 이름·주소·근접 좌표의 중복 후보를 read-only로 출력하는 places:duplicates 명령 추가

중복 merge를 자동 실행하지 않은 이유는 댓글·가격 이력·북마크·신고·alias/redirect 보존과 rollback 정책이 먼저 필요하기 때문이다.

### 4.5 Migration·운영 안전망

관련 파일:

- [migrate-production.mjs](../../scripts/migrate-production.mjs)
- [check-production-db.mjs](../../scripts/check-production-db.mjs)
- [0013 migration](../../drizzle/0013_right_nocturne.sql)
- [0014 migration](../../drizzle/0014_mysterious_pepper_potts.sql)
- [0015 migration](../../drizzle/0015_ambiguous_quicksilver.sql)
- [0016 migration](../../drizzle/0016_mature_vermin.sql)
- [check-node-version.mjs](../../scripts/check-node-version.mjs)

migration 전에 application schema/history 불일치, invalid price, invalid moderation data를 검사하고 문제가 있으면 변경 전에 중단한다. invalid data를 자동 삭제하지 않은 이유는 production 데이터 손실을 막기 위해서다.

## 5. Cloudflare와 운영 환경

Wrangler 인증 후 read-only inventory를 확인하고 Worker secret을 설정했다.

설정·확인한 범위:

- DATABASE_URL, AUTH_SECRET
- credentials admin/demo password
- Kakao/Naver OAuth id·secret
- Naver Maps key
- admin app URL
- email provider 설정
- USE_MOCK_DATA=false

원격 read-only smoke:

- deep health: runtime/db/auth/static
- home, robots, sitemap, public config
- database map/place API
- unauthenticated admin API가 401인지
- Kakao/Naver authorization redirect

실제 production DB migration, OAuth credential login, 이메일 발송, AI provider 호출, production admin mutation은 실행하지 않았다. 외부 상태 변경이나 실제 계정 승인이 필요한 영역이기 때문이다.

## 6. 검증 결과

### 정적·단위

| 명령 | 결과 |
| --- | --- |
| npm run lint | 통과 |
| npm run typecheck | 통과 |
| npm run test:unit | 19개 통과 |
| npm run build | Node 20.19.1에서 통과 |
| npm run db:generate | schema drift 없음 |
| npm run csp:inventory | finding 0, CSP parity 통과 |
| npm run hygiene:dead-code | 통과 |
| npm run design:detect:json | finding 없음 |
| git diff --check | 통과 |

### DB·통합·E2E

| 검증 | 결과 |
| --- | --- |
| disposable PostgreSQL fresh migration | 통과 |
| disposable seed와 production DB check | 통과 |
| DB mode full E2E | 통과 |
| mobile E2E | 통과 |
| client performance E2E | 통과 |
| accessibility axe: /, /login, /submit | 통과 |
| price concurrency smoke | 첫 요청 1건 반영, 두 번째 stale 처리 |
| Vite contract check | 통과 |
| npm run places:duplicates | read-only 후보 28건 출력 |

마지막 full/mobile/performance/accessibility 실행은 총 24개가 통과했다.

### CI·배포

- CI local DB 흐름을 db:push에서 migration replay 중심으로 변경
- exact Node, build output, deploy output, migration drift, quality gate 연결
- deploy check에서 required env와 USE_MOCK_DATA=false 확인
- Cloudflare remote smoke는 read-only 범위에서 통과

## 7. 면접에서 말할 대표 사례

### 사례 A. 익명 사용자를 허용하면서 abuse를 어떻게 막았나?

비회원 제보는 전환율에 중요하므로 열어 두되, unsigned cookie를 actor로 믿으면 cookie 재발급으로 rate limit과 ownership을 우회할 수 있었다. 그래서 signed visitor actor를 도입하고 Turnstile·rate limit·body cap을 route 경계에 배치했다. 댓글 삭제·반응·신고·가격 제보가 같은 actor 정책을 사용하게 하고 cookie rotation, local-only bypass, chunked body 413을 테스트했다.

### 사례 B. 가격 데이터 신뢰성을 어떻게 보장했나?

제보 row 수와 독립 확인 수를 구분했다. user/visitor actor와 submission key를 저장해 중복 요청을 멱등 처리하고, verified count를 distinct actor 기준으로 계산했다. 승인 transaction에서 report·item·summary를 함께 갱신하고 금액·count·좌표를 DB constraint로도 보호했다. concurrency smoke에서 첫 요청만 반영되고 두 번째는 stale 처리되는 것을 확인했다.

### 사례 C. AI가 잘못 판단하면 어떻게 하나?

AI를 자동 승인자가 아닌 suggested action 보조 레이어로 제한했다. suggestion에 lifecycle과 model/prompt version·input fingerprint를 둘 수 있게 하고, confidence와 summary를 DB에서 제한했다. malformed output은 review로 낮추며, 최종 상태 변경은 운영자 API와 audit action이 담당한다.

## 8. 정직하게 말해야 하는 한계

### React Router upstream advisory

최신 공개 버전에서도 RSC mode 관련 high advisory가 npm audit에 남아 있다. 앱은 client-only BrowserRouter를 사용하고 RSC/Server Action 경로를 사용하지 않지만 advisory가 사라진 것은 아니다. 취약 버전으로 되돌려 audit 수를 줄이지 않았다.

### 실제 OAuth provider 성공 흐름

authorization redirect와 state/token malformed 경계는 자동 검증했지만, 실제 Kakao/Naver sandbox 계정의 성공 로그인과 callback code replay·PKCE 검증은 하지 않았다.

### production migration/deploy

Cloudflare secret과 deploy readiness는 확인했지만 실제 production migration과 배포 명령은 실행하지 않았다. 운영 데이터 변경은 백업·승인·rollback 창구가 필요하다.

### Hyperdrive와 장소 merge

현재 코드는 Hyperdrive binding이 있으면 우선 사용하고 없으면 DATABASE_URL로 fallback한다. 현재 운영 trigger 안에 있어 즉시 binding을 만들지 않았다. 장소 merge는 후보 분석까지만 구현했으며, mutation은 보존·rollback 정책 확정 후 별도 구현해야 한다.

## 9. 배운 점

1. 정상 동작과 운영 가능한 동작은 다르다. 화면 200뿐 아니라 secret 누락, isolate 재시작, concurrent admin action, malformed body, migration drift까지 확인해야 한다.
2. 인증·데이터·운영은 연결되어 있다. visitor cookie 하나가 rate limit, ownership, 가격 신뢰 count에 동시에 영향을 준다.
3. DB constraint는 마지막 방어선이다. Zod가 보호하지 못하는 direct SQL·seed·import도 DB invariant로 막아야 한다.
4. destructive automation은 자동화하지 않는 것이 더 안전할 수 있다. invalid data는 migration에서 지우지 않고 preflight에서 중단했다.
5. AI-native의 핵심은 생성량이 아니라 검증 책임이다. AI는 초안을 빠르게 만들지만 완료 여부는 독립 검증 명령과 실패 범위로 판단했다.

## 10. 참고 파일

- [감사 보고서](../audits/full-repository-audit-2026-07-31.md)
- [PLAN.md](../../PLAN.md)
- [unit tests](../../tests/unit/http-and-rate-limit.test.ts)
- [accessibility E2E](../../tests/e2e/accessibility.spec.ts)
- [performance E2E](../../tests/e2e/performance.spec.ts)
- [price concurrency smoke](../../scripts/smoke-price-report-concurrency.ts)
- [Vite contract](../../scripts/compare-vite-contract.mjs)
- [CI](../../.github/workflows/ci.yml)

## 11. 면접용 30초 답변

> 알뜰맵을 만든 뒤 전체 저장소를 위험 기반으로 감사했습니다. 익명 visitor cookie 위조, 인증 secret fallback, 가격 중복 검증, 관리자 동시 처리, migration drift 같은 운영 위험을 발견했고, signed actor, fail-closed session, Turnstile/body cap, 가격 provenance·idempotency·DB constraint, CAS transaction, migration preflight, accessibility와 full E2E를 추가했습니다. disposable PostgreSQL과 Cloudflare read-only smoke로 검증했으며, AI는 구현 속도를 높이되 최종 품질과 공개 상태 결정은 테스트·운영 검증·관리자 승인으로 제 책임 아래 남겼습니다.

## 12. 회고 체크리스트

- [ ] 문제를 사용자 영향과 운영 위험으로 설명했는가?
- [ ] 수정한 파일 또는 함수명을 말할 수 있는가?
- [ ] 해결책의 trade-off를 설명했는가?
- [ ] 실패 조건과 테스트를 하나 이상 제시했는가?
- [ ] 자동 검증과 수동 검증을 구분했는가?
- [ ] upstream advisory와 제품 정책 미결정을 숨기지 않았는가?
- [ ] 19 unit / 24 E2E / disposable migration / remote smoke 수치를 정확히 말했는가?
