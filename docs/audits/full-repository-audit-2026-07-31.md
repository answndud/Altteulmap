# AltteulMap 전체 저장소 위험 기반 감사 보고서

감사일: 2026-07-31 (Asia/Seoul)  
대상 커밋: c0f233c fix: improve mobile map layout  
초기 감사 기준: 애플리케이션 코드는 수정하지 않고 기준 보고서만 생성했다. 이후 후속 조치에서 감사 발견사항을 코드·schema·검증에 반영했다.

## 1. Executive Summary

저장소는 Worker/Hono route 분리, 서버 측 admin role 확인, Zod validation, 가격 승인 transaction/advisory lock, CSP inventory, DB timeout, map cache, E2E 기반을 갖추고 있다. 반면 세션 secret, 익명 actor, Turnstile bypass, 가격 검증의 독립성은 실제 호출 가능한 위험 경계다. 특히 설정 실수와 visitor cookie rotation이 결합되면 공개 쓰기 제한과 가격 신뢰를 우회할 수 있다.

| 심각도 | 발견 수 |
| --- | ---: |
| P0 | 0 |
| P1 | 4 |
| P2 | 10 |
| P3 | 3 |

P0/P1은 실제 route와 발생 조건을 명시했다. 아래 후속 검증에는 로컬 disposable DB와 인증된 Cloudflare read-only smoke가 포함되며, 실제 OAuth credential login과 외부 provider callback 성공은 여전히 별도 수동 검증 범위다.

### 즉시 처리할 다섯 가지

1. AUTH_SECRET 미설정 시 고정 fallback으로 세션을 검증하는 경로 제거.
2. 서명되지 않은 visitor cookie를 rate-limit, 소유권, 가격 신뢰의 단일 actor로 사용하지 않기.
3. USE_MOCK_DATA=true가 원격 hostname에서도 Turnstile을 bypass하는 조건 제거.
4. 동일 actor 또는 동일 source의 가격 제보가 verified count에 중복 기여하지 않도록 모델 변경.
5. 장소 승인 transaction에서 initial price report, price item, 대표 가격 summary를 함께 재계산.

### Audit health score

| 차원 | 점수 | 근거 |
| --- | ---: | --- |
| 접근성 | 2/4 | 주요 input/button에는 label/aria가 있으나 댓글 textarea가 placeholder에 의존하며 실제 screen reader 검증은 미실행 |
| 성능 | 2/4 | viewport cache/marker cap은 있으나 global 검색 결과 상한·FTS·bbox 최대 범위가 없음 |
| 테마 | 3/4 | CSS token 사용과 CSP parity는 좋지만 지도 marker 동적 inline style로 unsafe-inline 유지 |
| 반응형 | 3/4 | mobile bottom sheet와 E2E가 있으나 실제 iOS/저사양 수동 검증 미실행 |
| anti-pattern | 3/4 | map-first 방향은 적절하나 dynamic marker style과 surface 복잡도가 남음 |
| 합계 | 13/20 | Acceptable — 보안·데이터 경계와 운영 검증을 먼저 보강해야 함 |

### 강점

- src/worker/routes/admin-support.ts:27-60에서 admin route마다 서버 측 session과 role을 검사한다.
- public write는 대체로 validation → persistent rate limit → Turnstile → DB write 순서를 가진다.
- src/worker/admin/admin-price-review-repository.ts:27-292는 transaction, pending CAS, advisory lock, admin_actions 기록을 사용한다.
- src/worker/http/security-headers.ts와 public/_headers가 CSP/header parity를 유지하고 npm run csp:inventory가 이를 검사한다.
- src/worker/db.ts:218-233은 요청 단위 connection 정리, timeout, unavailable TTL을 가진다.
- slug/price label/user email/bookmark/reaction unique key와 FK가 여러 기본 invariant를 보호한다.

## 2. 분석 범위와 한계

### 분석 범위

Git tracked 전체 인벤토리를 만든 뒤 React SPA → Hono Worker → Zod → session/visitor actor → Turnstile/rate limit → Drizzle repository → PostgreSQL → admin moderation → UI 흐름을 추적했다. 인증/OAuth, 모든 admin route, 공개 장소·가격·댓글·신고·반응·telemetry, 가격 history/summary, 지도 query/cache, schema/migration, import/seed/production script, CI, 테스트, 제품·배포 문서를 확인했다.

### 한계

- node_modules, dist, .wrangler, test-results, playwright-report, build cache, browser binary, 일반 이미지/favicon binary는 제외했다.
- production DB, Cloudflare, Supabase, OAuth, 이메일, AI provider에 쓰기 요청을 하지 않았다.
- production remote smoke, local E2E, disposable DB E2E, 실제 Naver Maps/Turnstile, 모바일 Safari, screen reader, concurrent admin 재현은 실행하지 않았다.
- 기존 working tree 변경(AGENTS.md, README.md, docs/PLAN.md 삭제, 루트 PLAN.md, docs/resume 등)은 보존했다.

## 3. 현재 아키텍처와 주요 데이터 흐름

React/Vite SPA가 map/search/detail/bookmark/submit/report/comment UI를 제공하고 fetch로 단일 Cloudflare Worker/Hono에 요청한다. Worker는 public read, auth, public write, admin, telemetry route를 등록한다. 공개 쓰기는 Zod validation, signed session 또는 visitor cookie actor, persistent rate limit, Turnstile, Drizzle transaction/repository를 거쳐 PostgreSQL에 저장한다. DB 연결은 Hyperdrive가 있으면 우선하지만 현재 wrangler.jsonc에는 binding이 없어 DATABASE_URL 직접 연결이 기본이다. 공개 read는 map/detail 요약과 price item/comment/history를 반환하고 admin은 pending queue와 moderation suggestion을 읽어 최종 상태를 기록한다.

핵심 데이터 경계:

- session cookie는 v1 payload.signature HMAC이며 payload에 user id/email/role/expires가 있다.
- anonymous actor는 altteulmap_visitor_id cookie 또는 forwarded header fallback이다.
- 원본 가격 제보는 price_reports, 공개 요약은 price_items와 places denormalized summary다.
- moderation_suggestions는 운영자에게 제안만 제공하는 레이어이며, 자동 공개/승인 route는 확인되지 않았다.

## 4. PRD/TRD 대비 기능 구현 상태

| 요구 | 상태 | 근거와 gap |
| --- | --- | --- |
| 지도/카테고리/대표 가격/상세 | 구현 | places-read, map UI, seed/import |
| viewport 갱신 | 구현 | places-read-map-repository, map E2E |
| 비회원 장소/가격/댓글/신고 | 구현 | public write routes |
| 동일 가격 2회 검증 | 부분 | accepted count만 세고 독립 actor를 보장하지 않음 |
| 가격 이력 | 부분 | place approval이 initial report와 summary를 재계산하지 않음 |
| 북마크 | 부분 | route가 항상 process-local mock store 사용 |
| 신고/수정 요청 | 신고 구현 | target별 중복 억제·queue cap 없음 |
| 관리자 검수 | 구현 | role guard와 admin_actions 존재 |
| 장소 병합 | 미구현 | TRD/화면 문서에는 merge가 있으나 route/repository 없음 |
| AI 1차 + 운영자 최종 | 제안 레이어 | suggestion 조회/UI는 있으나 생성 lifecycle·version binding 불명확 |
| 공공데이터 1,000건 | 파일/seed 구현 | DB source/external id/provenance 없음 |
| 방문/공유 지표 | 구현 | visitor actor 위조 시 unique 지표 신뢰 저하 |

## 5. P0/P1 최우선 발견사항

### ALT-AUTH-001
제목: AUTH_SECRET 미설정 시 알려진 고정 secret으로 admin session 위조 가능  
분류: 인증·권한 / 보안  
심각도: P1 (배포 환경 확인 필요)  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/auth/session.ts:43-45 getAuthSecret, :69-104 encode/decodeSignedPayload; src/worker/routes/admin-support.ts:27-60 requireAdminSession  
영향받는 route와 사용자 흐름: 모든 /api/admin/places*, /api/admin/prices*, /api/admin/reports*와 admin UI  
현재 동작: env.AUTH_SECRET가 없으면 vite-local-auth-secret을 HMAC key로 사용한다. admin guard는 signed payload의 role을 신뢰하고 매 요청 DB role lookup을 하지 않는다.  
코드 근거: getAuthSecret의 fallback과 requireAdminSession의 session.user.role 검사. deploy:check는 secret 누락을 검사하지만 runtime은 거부하지 않는다.  
발생 조건: secret binding 누락, 이름 오타, preview/production config drift. 공격자는 known fallback으로 role=admin payload를 서명할 수 있다.  
영향: admin queue 조회와 approve/reject/price-item/report mutation 직접 호출 가능.  
권장 해결 방향: non-local runtime에서 secret이 없으면 fail-closed; local fallback은 명시적 local-only adapter로 격리; admin mutation은 user id/role을 DB 재확인.  
필요한 테스트: missing secret rejection, forged fallback cookie 401/403, role demotion 후 cookie 거부, expiry boundary.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 아니오. signed session 요구는 있으나 fallback 위험은 미기록.

### ALT-SEC-001
제목: 서명되지 않은 visitor cookie가 rate-limit·소유권·방문자 지표의 actor identity임  
분류: 보안 / abuse / 데이터 정합성  
심각도: P1  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/public-write-actor.ts:70-151 getWorkerPublicWriteActor; src/worker/http/cookies.ts:90-95; src/worker/routes/public-write-support.ts:54-64; src/worker/places-write-comments-repository.ts:136-150  
영향받는 route와 사용자 흐름: anonymous place/price/comment/report/reaction/telemetry, comment delete  
현재 동작: cookie 값은 HMAC 검증 또는 server lookup 없이 visitorId와 actor.key가 된다. 사용자가 새 UUID를 매 요청 보낼 수 있다.  
코드 근거: actor.key가 visitorId이며 persistent rate limit도 actor key를 사용한다. comment ownership은 visitorId equality만 확인한다.  
발생 조건: Cookie: altteulmap_visitor_id=<new-value>를 반복 전송.  
영향: 공개 쓰기 quota와 telemetry unique actor를 우회하고, 동일 사용자가 여러 가격 제보처럼 보일 수 있다.  
권장 해결 방향: signed/opaque server-bound visitor token, rotation/revocation, target별 secondary limit, raw x-forwarded-for fallback 제거.  
필요한 테스트: cookie rotation, 다른 cookie의 comment delete 거부, price verification 독립성, spoofed forwarded header.  
구현 난이도: 중간~높음  
기존 문서에 기록된 문제인지: 부분적으로 아니오. TRD는 visitor cookie를 actor로 정의하지만 서명/rotation 방어는 없다.

### ALT-SEC-002
제목: USE_MOCK_DATA=true가 원격 hostname에서도 Turnstile을 bypass함  
분류: 보안 / 운영  
심각도: P1 (배포 환경 확인 필요)  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/routes/public-write-support.ts:76-105; wrangler.jsonc:1-15; scripts/check-cloudflare-deploy.mjs:89-97  
영향받는 route와 사용자 흐름: POST /api/places, POST /api/places/:id/prices, POST /api/places/:id/comments, POST /api/reports  
현재 동작: bypass 조건이 local hostname OR USE_MOCK_DATA=true이다.  
코드 근거: isLocalTurnstileBypassAllowed의 OR 조건; deploy check는 true/missing을 WARN만 내고 성공한다.  
발생 조건: production/shared Worker에서 USE_MOCK_DATA=true가 설정되거나 설정이 drift한다.  
영향: CAPTCHA 없이 spam/data poisoning 가능. visitor cookie rotation과 결합하면 rate limit도 약화된다.  
권장 해결 방향: bypass는 local test adapter에서만 허용하고 production deploy check를 non-zero fail로 변경. mock flag는 remote hostname과 AND로 묶지 말고 배포 환경에서 금지한다.  
필요한 테스트: remote URL + mock true bypass false, local test true only, each write route Turnstile failure.  
구현 난이도: 낮음  
기존 문서에 기록된 문제인지: 부분적으로 아니오. deploy guide는 false를 요구하지만 runtime OR와 WARN-only는 없다.

### ALT-COR-001
제목: 가격 검증이 독립 actor를 요구하지 않고 anonymous 제보자를 저장하지 않음  
분류: 정확성·정합성 / 신뢰 경계  
심각도: P1  
확신도: 높음  
관련 파일과 line 또는 함수: src/db/schema-pricing.ts:60-99; src/worker/places-write-price-reports-repository.ts:45-62; src/worker/admin/admin-price-review-repository.ts:166-180,227-238  
영향받는 route와 사용자 흐름: POST /api/places/:id/prices → PATCH /api/admin/prices/:id → public verified badge  
현재 동작: anonymous report는 reporterUserId=null만 저장한다. moderation은 place+normalizedLabel+amount+accepted row count만 센다.  
코드 근거: visitorId/source/idempotency key가 price_reports에 없고 distinct reporter 조건이 없다.  
발생 조건: 같은 로그인 사용자 반복 제출 또는 cookie rotation 후 anonymous 반복 제출을 운영자가 둘 다 approve.  
영향: verified badge와 representative price의 신뢰도가 실제 독립 확인보다 높아진다.  
권장 해결 방향: actor/source/provenance/idempotency를 저장하고 distinct actor/source 기반으로 count; 운영자 중복 경고.  
필요한 테스트: same actor two reports unverified, distinct actor two reports verified, rejected rows excluded, concurrent approval.  
구현 난이도: 높음  
기존 문서에 기록된 문제인지: 부분적으로 예. docs/project/production-hardening-report-2026-05-08.md:195에 concurrency/idempotency 후보가 있으나 distinct actor는 미기록.

## 6. 분야별 전체 발견사항

### 인증·권한·보안

#### ALT-AUTH-002
제목: 30일 self-contained session이 role 변경과 계정 삭제를 즉시 반영하지 않음  
분류: 인증·권한  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/auth/session.ts:36-45,103-147; src/worker/routes/admin-support.ts:27-60  
영향받는 route와 사용자 흐름: 모든 admin route, role downgrade/signout  
현재 동작: role을 30일 payload에 넣고 DB lookup 없이 신뢰한다. signout은 cookie clear만 한다.  
코드 근거: getSessionFromRequest가 HMAC·expiry·shape만 검사한다.  
발생 조건: admin 강등/삭제 후 기존 cookie로 요청.  
영향: 권한 철회 지연과 incident response 불확실성.  
권장 해결 방향: 짧은 access session 또는 server revocation/version, admin mutation DB role 재확인.  
필요한 테스트: role change/delete 후 cookie 거부, signout replay 정책, expiry.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 아니오.

#### ALT-SEC-003
제목: JSON/form body 전체 크기 제한이 없음  
분류: 보안 / 운영  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: public-write-submissions.ts:31-33; public-write-price-reports.ts:35-36; public-write-comments.ts:43-44; public-write-reports.ts:32-33; admin routes의 req.json 호출  
영향받는 route와 사용자 흐름: public/admin/auth JSON 및 form 요청  
현재 동작: field max만 있고 content-length/stream/body byte cap이 없다.  
코드 근거: route가 c.req.json 또는 formData를 직접 읽는다.  
발생 조건: oversized/deep payload 반복 전송.  
영향: Worker parse CPU/memory와 DB connection 점유.  
권장 해결 방향: route class별 413 body cap, content-type/length 선검사, array cap.  
필요한 테스트: 413, chunked request, malformed nested payload.  
구현 난이도: 낮음~중간  
기존 문서에 기록된 문제인지: 아니오.

### 데이터 정합성·가격·관리자

#### ALT-COR-002
제목: 장소 승인 시 initial price reports를 accepted로만 바꾸고 price item/summary를 재계산하지 않음  
분류: 정확성·정합성  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/places-write-submissions-repository.ts:107-149; src/worker/admin-places-repository.ts:232-255; src/worker/admin/admin-price-helpers.ts:107-172  
영향받는 route와 사용자 흐름: POST /api/places → PATCH /api/admin/places/:id approve → map/detail  
현재 동작: 신규 장소는 unverified priceItems와 pending priceReports를 만들지만 장소 승인에서는 place status와 reportStatus만 변경한다.  
코드 근거: moderateWorkerPlaceSubmission에 priceItems update/refreshWorkerPlacePricingSummary 호출이 없다.  
발생 조건: 공개 신규 장소를 승인.  
영향: active price item, history snapshot, verified count, 대표 summary가 서로 어긋날 수 있다.  
권장 해결 방향: 장소 승인 transaction에서 initial reports/items/summary를 한 번 재계산하거나 pending price를 public read에서 제외.  
필요한 테스트: 신규 장소 approve 전후 일관성, multiple price items, reject, rollback.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 아니오.

#### ALT-COR-003
제목: place/report admin mutation에 상태 CAS가 없어 동시 운영자 결정이 last-write-wins임  
분류: 정확성·운영  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/admin-places-repository.ts:202-249; src/worker/admin-reports-repository.ts:145-164; 비교: admin-price-review-repository.ts:70-89,121-141  
영향받는 route와 사용자 흐름: 장소 승인/반려, 신고 상태 변경  
현재 동작: place/report는 id만 조건으로 update한다. price report만 pending 상태 CAS와 affected row check가 있다.  
코드 근거: expected previous status/version 조건이 없다.  
발생 조건: 두 admin tab이 같은 item을 동시에 서로 다른 결정으로 저장.  
영향: audit와 최종 상태가 운영자 의도와 어긋남.  
권장 해결 방향: expected status/version CAS, stale UI 409, transition matrix.  
필요한 테스트: concurrent approve/reject, stale version, audit consistency.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 부분적으로 예. 기존 보고서는 price concurrency만 기록.

#### ALT-DATA-001
제목: 공공데이터 import가 source/external id를 DB에 보존하지 않아 재수집·정정·provenance 추적이 어려움  
분류: 데이터·공공데이터  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: scripts/import-goodprice.ts:32-44,538-579,882-925; src/db/schema-place-core.ts:38-69; src/db/schema-pricing.ts:21-90  
영향받는 route와 사용자 흐름: import/seed → map/detail, 공공 가격과 사용자 제보 결합  
현재 동작: bsshSn은 파일 slug/stable id로만 쓰고 manifest는 별도 JSON이다. DB row에는 provider, external id, import batch가 없다.  
코드 근거: place/price insert에 source metadata가 없고 db:seed는 app tables를 delete 후 재삽입한다.  
발생 조건: source 재수집, 일부 update, 사용자 제보와 merge, source 가격 정정.  
영향: 중복 장소와 stale price 원인 추적 불가, user history 보존이 어려움.  
권장 해결 방향: source/external id/import batch/provenance와 upsert 정책, seed local-only guard.  
필요한 테스트: idempotent reimport, source update 보존, rollback, source 표시.  
구현 난이도: 높음  
기존 문서에 기록된 문제인지: 아니오.

#### ALT-COR-004
제목: 핵심 invariant가 DB CHECK 없이 application validation에만 있음  
분류: DB 정합성  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/db/schema-place-core.ts:38-93; src/db/schema-pricing.ts:21-98; drizzle/0012_woozy_thunderbolt.sql  
영향받는 route와 사용자 흐름: admin update, seed/import, direct SQL, map/detail  
현재 동작: amount 양수, 좌표 범위, count non-negative, 대표 item 단일성은 Zod/선택 로직에 의존한다.  
코드 근거: schema에 CHECK가 없고 isRepresentative index는 true row 하나를 강제하지 않는다. 좌표는 nullable double precision이다.  
발생 조건: 새 script/운영 SQL/import가 validation을 우회하거나 concurrent update가 발생.  
영향: 잘못된 지도 좌표, 음수 가격/count, 대표 summary 불일치.  
권장 해결 방향: coordinate/amount/count/currency CHECK와 representative partial unique 또는 domain transaction invariant.  
필요한 테스트: DB direct invalid insert/update rejection, existing data preflight, representative uniqueness.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 아니오.

### 성능·지도

#### ALT-PERF-001
제목: global search와 malformed viewport가 결과·비용 상한 없이 query를 확장시킬 수 있음  
분류: 성능·비용 / 지도·공간검색  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/routes/places-read.ts:37-63,176-206; src/worker/places-read-map-repository.ts:68-111,249-284  
영향받는 route와 사용자 흐름: GET /api/places/map?scope=global, map refresh  
현재 동작: global query path는 matching rows 전체를 limit 없이 읽고 count와 rows를 병렬 실행한다. bbox parser는 finite number만 확인하고 범위, min≤max, 최대 면적을 확인하지 않는다.  
코드 근거: 여러 text column의 %term% ILIKE와 query path의 no-limit loadDatabaseMapPlaceRows.  
발생 조건: common/empty query, wide bbox, 데이터 10k/100k 증가.  
영향: DB CPU/전송량/Worker memory, timeout, 비용 상승.  
권장 해결 방향: query length, result cap/pagination, FTS/trigram, bbox area/span/zoom validation, count 전략.  
필요한 테스트: 1k/10k/100k common query, malformed bounds 400, result cap, rows-read/p95.  
구현 난이도: 중간~높음  
기존 문서에 기록된 문제인지: 부분적으로 예. global index가 future bottleneck이라는 기록은 있으나 입력/결과 상한은 없다.

#### ALT-MAP-001
제목: 좌표 read filter는 null만 제외하고 범위·lat/lng 의미를 DB에 보장하지 않음  
분류: 지도·공간검색 / 데이터 정합성  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/places-read-map-repository.ts:77-109; src/db/schema-place-core.ts:50-52; src/features/submission/schema.ts:17-36  
영향받는 route와 사용자 흐름: map marker/viewport, admin approve, import/seed  
현재 동작: map query는 non-null latitude/longitude만 요구한다. admin schema는 범위를 검사하지만 DB/import row는 그렇지 않다.  
코드 근거: DB CHECK가 없고 map where에는 null check와 bbox 비교만 있다.  
발생 조건: direct SQL/import bug 또는 좌표 순서 오류.  
영향: 장소가 잘못된 지역에 표시되거나 검색 결과에서 사라짐.  
권장 해결 방향: DB CHECK/PostGIS point와 import contract test.  
필요한 테스트: invalid row rejection, coordinate fixtures, bbox edge cases.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 아니오.

#### ALT-ARCH-001
제목: DB mode에서도 북마크가 process-local mock store임  
분류: 아키텍처 / 제품 기능  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/worker/routes/bookmarks.ts:22-38,44-145; src/db/schema-place-social.ts:35-47  
영향받는 route와 사용자 흐름: GET /api/bookmarks, PUT /api/bookmarks/:id, 로그인 사용자 북마크  
현재 동작: session만 확인하고 Map<string,Set<string>>를 사용하며 response source는 mock이다. DB bookmarks table과 연결되지 않았다.  
코드 근거: route에 DB mode 분기나 Drizzle query가 없다.  
발생 조건: production isolate 재시작, scale-out, 재방문.  
영향: 북마크 소실/불일치, PRD의 회원 핵심 기능 미충족.  
권장 해결 방향: DB upsert/delete/read와 production persistence E2E; mock은 test mode adapter로 제한.  
필요한 테스트: cross-request/isolate persistence, duplicate toggle, hidden place, unauthorized.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 아니오.

#### ALT-OPS-001
제목: 현재 Worker는 Hyperdrive binding 없이 Supabase DATABASE_URL 직접 연결을 사용함  
분류: 운영 / 성능·비용  
심각도: P2 (운영 환경 확인 필요)  
확신도: 높음  
관련 파일과 line 또는 함수: wrangler.jsonc:7-15; src/worker/db.ts:65-85,218-233; docs/project/hyperdrive-decision-2026-05-08.md  
영향받는 route와 사용자 흐름: 모든 DB read/write/admin/telemetry  
현재 동작: code는 Hyperdrive가 있으면 우선하지만 config에는 binding이 없고 DATABASE_URL fallback이 기본이다.  
코드 근거: getWorkerDatabaseConnection fallback과 wrangler config.  
발생 조건: 동시 traffic/connection limit/latency 증가.  
영향: connection exhaustion, latency/cost 상승. 현재 1k seed p95 결과만으로 확장을 보장하지 않는다.  
권장 해결 방향: connection/timeout/error metric과 trigger를 운영하고, Hyperdrive 전후 load test로 결정.  
필요한 테스트: concurrent connection count, timeout, p95, no fallback to mock.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 예. Hyperdrive decision 문서에 trigger가 있다.

### AI 검수·운영

#### ALT-OPS-002
제목: moderation suggestion의 confidence/version/lifecycle invariant가 강제되지 않음  
분류: 운영 / AI 신뢰 경계  
심각도: P2  
확신도: 중간  
관련 파일과 line 또는 함수: src/db/schema-moderation.ts:74-105; src/worker/admin/admin-price-read-repository.ts:54-100; src/worker/admin-reports-repository.ts:86-124; src/client/routes/admin/AdminShared.tsx:27-54  
영향받는 route와 사용자 흐름: admin queue AI suggestion 표시 → 운영자 최종 결정  
현재 동작: subject unique suggestion을 UI에 표시하지만 confidence 0~100 CHECK, input hash, prompt/model version, expired/used state가 없다. 외부 AI 자동 공개 route는 확인되지 않았다.  
코드 근거: confidence integer not null만 있고 admin action이 suggestion version/id와 명시적으로 연결되지 않는다.  
발생 조건: subject 처리 후 stale suggestion 재사용, malformed direct row, retry 중복.  
영향: 운영자가 stale/비정상 제안을 신뢰하거나 비용/queue 상태를 추적하기 어려움.  
권장 해결 방향: subject hash/version, provider/model/prompt, lifecycle, output schema validation, admin action snapshot.  
필요한 테스트: malformed output, stale suggestion, retry, confidence range, prompt injection, AI가 approval을 직접 바꾸지 않음.  
구현 난이도: 중간~높음  
기존 문서에 기록된 문제인지: 부분적으로 아니오.

### 테스트·CI·배포

#### ALT-TEST-001
제목: CI가 migration replay 대신 db:push에 의존하고 high-risk contract coverage가 비어 있음  
분류: 테스트·CI / 운영  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: .github/workflows/ci.yml:70-130; package.json의 verify/e2e/migration scripts; scripts/compare-vite-contract.mjs  
영향받는 route와 사용자 흐름: DB schema 변경, local E2E, deploy contract  
현재 동작: ephemeral Postgres E2E가 db:push 후 seed하고 migration replay는 하지 않는다. 이번 migration:contract는 localhost:3118 server 부재로 fetch failed였다.  
코드 근거: CI에 fresh drizzle migration replay가 없고 OAuth callback, visitor rotation, distinct price, admin CAS, malformed map/body, DB bookmark 테스트가 없다.  
발생 조건: push와 migration 결과가 다르거나 route가 production-like 환경에서만 실패.  
영향: production migration/인증/DB regression이 늦게 발견됨.  
권장 해결 방향: fresh DB migration replay와 schema inspection, high-risk integration matrix, deterministic contract server bootstrap.  
필요한 테스트: migration replay, auth/bypass/visitor, price concurrency/distinctness, bookmark persistence, query cap.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 부분적으로 예. CI drift check는 있으나 replay gap은 미기록.

#### ALT-OPS-003
제목: build가 package engine보다 오래된 Node에서 성공하고 warning만 남김  
분류: 운영 / 빌드  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: package.json:6-8; .node-version; vite.config.mts:3; src/worker/auth/session.ts:1; src/worker/db.ts:2  
영향받는 route와 사용자 흐름: 전체 Worker build와 auth/DB runtime  
현재 동작: 이번 환경 Node 20.13.1, package engine >=20.19.0. npm run build는 성공했지만 Vite가 upgrade warning을 출력했다. Worker source는 node:crypto/node:async_hooks/Buffer와 nodejs_compat에 의존한다.  
코드 근거: engine mismatch를 hard fail하지 않고 local Node와 workerd compatibility가 다르다.  
발생 조건: CI/Dashboard가 .node-version을 무시하거나 version drift.  
영향: build 재현성과 edge runtime 호환성 불확실성.  
권장 해결 방향: CI/deploy에서 exact Node hard check, wrangler/workerd smoke, Node-only import compatibility 문서화.  
필요한 테스트: clean npm ci, exact Node build, wrangler dev auth/DB route.  
구현 난이도: 낮음~중간  
기존 문서에 기록된 문제인지: TRD의 호환성 주의는 있으나 현재 mismatch는 미기록.

### UX·접근성·문서

#### ALT-UX-001
제목: 댓글 textarea가 placeholder에만 의존하고 accessible name이 없음  
분류: UI·접근성  
심각도: P2  
확신도: 높음  
관련 파일과 line 또는 함수: src/features/places/place-comments-section.tsx:111-121  
영향받는 route와 사용자 흐름: 장소 상세 댓글 입력, screen reader/voice input  
현재 동작: textarea에 label, aria-label, aria-labelledby가 없고 placeholder만 있다.  
코드 근거: line 113 textarea 주변에 label이 없다. 가격 form은 label wrapper를 사용한다.  
발생 조건: 보조기술로 댓글 입력을 탐색.  
영향: 입력 목적을 안정적으로 알기 어렵다.  
권장 해결 방향: visible label 또는 stable aria-label, error/status를 aria-live와 연결.  
필요한 테스트: axe label check, keyboard focus, screen-reader name, status announcement.  
구현 난이도: 낮음  
기존 문서에 기록된 문제인지: 아니오.

#### ALT-DOC-001
제목: PRD/TRD의 merge·북마크·AI 운영 범위가 실제 route/DB와 어긋남  
분류: 문서 / 제품 기능  
심각도: P3  
확신도: 높음  
관련 파일과 line 또는 함수: docs/product/prd.md:7.1,7.9,8; docs/product/trd.md:6.9,7.3; src/worker/routes/bookmarks.ts; src/worker/routes/admin.ts  
영향받는 route와 사용자 흐름: /admin/merge, 북마크, AI queue 운영  
현재 동작: 문서에는 merge와 production bookmark가 정의되지만 merge API가 없고 bookmark는 mock-only이며 suggestion lifecycle도 불명확하다.  
영향: 운영자와 제품 scope 판단이 실제 capability와 어긋난다.  
권장 해결 방향: implemented/partial/not started 상태를 문서와 acceptance criteria에 명시하고 route inventory contract를 추가.  
필요한 테스트: docs-to-route contract, bookmark production mode, AI persistence.  
구현 난이도: 낮음  
기존 문서에 기록된 문제인지: 아니오.

#### ALT-UX-002
제목: map fallback과 mobile sheet의 실제 외부 SDK 장애·보조기술 parity가 자동 검증되지 않음  
분류: UI·접근성 / 제품 경험  
심각도: P3  
확신도: 중간  
관련 파일과 line 또는 함수: src/features/map/naver-map-fallback.tsx:43-74; src/features/map/naver-map-preview-parts.tsx; tests/e2e/map.mobile.spec.ts; docs/project/mobile-qa-checklist.md  
영향받는 route와 사용자 흐름: Naver SDK 실패, geolocation 거부, 모바일 bottom sheet  
현재 동작: fallback과 mobile E2E는 있으나 real SDK marker/cluster, permission denied, screen-reader dismissal은 자동 검증되지 않는다.  
영향: 정상 CI와 실제 외부 장애의 UX가 달라질 수 있다.  
권장 해결 방향: no-map list/search/detail 대체 흐름과 SDK timeout/permission/keyboard fixture를 추가.  
필요한 테스트: SDK timeout, location denied, keyboard sheet, safe area.  
구현 난이도: 중간  
기존 문서에 기록된 문제인지: 부분적으로 예. mobile checklist가 검증 항목을 정의한다.

## 7. API 보안 및 테스트 매트릭스

| Method | Route | Access | Validation | Rate limit | Turnstile | DB write | Test | 발견 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | /api/health | Public | query 수동 | 없음 | 없음 | read/check | smoke script | live DB 미검증 |
| GET | /api/categories | Public | 없음 | 없음 | 없음 | 없음/read | contract/smoke | 없음 |
| GET | /api/config/public | Public | 없음 | 없음 | 없음 | 없음 | smoke | config drift 확인 필요 |
| GET | /api/places/map | Public | finite 숫자만 | 없음 | 없음 | read | map E2E/perf | ALT-PERF-001, ALT-MAP-001 |
| GET | /api/places/:id | Public | id string | 없음 | 없음 | read | detail E2E | actor viewer unsigned |
| POST | /api/places | Guest write | Zod | persistent actor | 예/bypass | 예 | submission E2E | ALT-SEC-001/002/003 |
| POST | /api/places/:id/prices | Guest write | Zod | persistent actor | 예/bypass | 예 | price E2E | ALT-COR-001 |
| POST | /api/places/:id/comments | Guest write | Zod | persistent actor | 예/bypass | 예 | comments E2E | ALT-SEC-001/002/003, ALT-UX-001 |
| DELETE | /api/places/:id/comments/:commentId | owner/admin | DB ownership | 없음 | 없음 | 예 | comments E2E | unsigned visitor |
| PUT | /api/places/:id/reaction | Guest write | Zod | persistent actor | 없음 | 예 | partial | actor abuse |
| POST | /api/reports | Guest write | Zod | persistent actor | 예/bypass | 예 | report E2E path | duplicate/body cap |
| GET | /api/bookmarks | Authenticated | session | 없음 | 없음 | 실제 mock | bookmarks E2E mock | ALT-ARCH-001 |
| PUT | /api/bookmarks/:id | Authenticated | Zod | 없음 | 없음 | mock | bookmarks E2E mock | ALT-ARCH-001 |
| POST | /api/telemetry/visit | Public | Zod | 없음 | 없음 | 예 | smoke/E2E | actor spoof |
| POST | /api/auth/callback/credentials | Public auth | ad hoc fields | 없음 | CSRF not checked | session | login E2E | brute-force, ALT-AUTH-001 |
| POST | /api/auth/signup | Public auth | Zod | 없음 | 없음 | 예 | signup E2E | enumeration/abuse |
| GET | /api/auth/signin/:provider | Public auth | provider allowlist | 없음 | state cookie | 없음 | redirect smoke | actual callback 미검증 |
| GET | /api/auth/callback/:provider | Provider callback | signed state | 없음 | N/A | 예 | redirect only | replay/PKCE gap |
| GET | /api/auth/csrf | Public auth | 없음 | 없음 | N/A | cookie | local smoke | credential route unused |
| GET | /api/auth/session | Public auth | signed cookie | 없음 | N/A | 없음 | login/smoke | stale role/fallback |
| POST | /api/auth/signout | Authenticated-ish | callback normalize | 없음 | 없음 | cookie only | remote smoke | no revocation |
| GET | /api/auth/providers | Public auth | provider config | 없음 | N/A | 없음 | remote smoke | config only |
| GET | /api/admin/places | Admin | session role | 없음 | N/A | read | E2E/smoke | stale role/no pagination |
| GET | /api/admin/places/:id | Admin | path | 없음 | N/A | read | partial | reads all pending |
| PATCH | /api/admin/places/:id | Admin | Zod | 없음 | N/A | 예/transaction | submission E2E | ALT-COR-002/003 |
| GET | /api/admin/prices | Admin | 없음 | 없음 | N/A | read | E2E/smoke | no pagination |
| PATCH | /api/admin/prices/:id | Admin | Zod | 없음 | N/A | 예/transaction | price E2E | distinct actor gap |
| GET | /api/admin/prices/places/:id | Admin | path | 없음 | N/A | read | smoke | no pagination |
| PATCH | /api/admin/price-items/:id | Admin | Zod | 없음 | N/A | 예 | UI smoke only | invariant gap |
| GET | /api/admin/reports | Admin | 없음 | 없음 | N/A | read | E2E/smoke | no pagination |
| PATCH | /api/admin/reports/:id | Admin | Zod | 없음 | N/A | 예/transaction | report E2E | ALT-COR-003 |
| GET | /robots.txt | Public | 없음 | 없음 | N/A | 없음 | remote smoke | 없음 |
| GET | /manifest.webmanifest | Public | 없음 | 없음 | N/A | 없음 | direct coverage 없음 | P3 |
| GET | /sitemap.xml | Public | 없음 | 없음 | N/A | read | remote smoke | size/DB live check |

## 8. DB 정합성·transaction·index 감사

좋은 점: FK cascade/set-null, unique slug/email/price label/bookmark/reaction, price approval transaction/advisory lock, rate-limit/visit bucket unique, map status/lat/lng index가 있다.

우선 개선:

1. price_reports에 anonymous actor/source/idempotency가 없어 verification trust를 재구성할 수 없다.
2. place approval이 price item/report/summary lifecycle과 분리되어 상태가 어긋난다.
3. place/report admin mutation은 CAS가 없다.
4. 좌표·금액·count·대표 item invariant를 DB가 막지 않는다.
5. import source/external id/batch가 없어 재수집과 사용자 제보 merge를 추적할 수 없다. 후속 조치에서 provenance columns와 read-only duplicate analyzer를 추가했다.
6. global text search는 %term% ILIKE이며 FTS/trigram과 결과 cap이 없다.
7. admin pending queue read가 페이지네이션 없이 전체 row를 읽는다: admin-places-repository.ts:127-191, admin-price-read-repository.ts:24-103, admin-reports-repository.ts:70-127.

## 9. 테스트와 운영 검증 결과

### 실행한 검증

| 명령 | 결과 |
| --- | --- |
| npm run lint | 통과 |
| npm run typecheck | 통과 |
| npm run test:unit | 통과, 19 tests |
| npm run build | 통과. exact Node 20.19.1 preflight 적용 |
| npm run csp:inventory | 통과. source/public findings 0, unsafe-inline은 유지 |
| npm run hygiene:dead-code | 통과 |
| npm run deploy:check | 통과. 현재 local env 기준 required env와 USE_MOCK_DATA=false 확인 |
| npm run db:generate | 통과. schema drift 없음 |

### 실행하지 않은 검증

- verify는 lint/typecheck/unit 조합이므로 중복 실행하지 않았다.
- verify:quality의 npm audit은 실행했으며 React Router 최신 공개 버전의 RSC-only upstream advisory 1건이 남았다.
- disposable migration/seed/check와 local DB full E2E는 실행했다.
- actual OAuth credential login/provider callback 성공, screen reader·실기기 검증, production DB migration은 미실행.

### 테스트 coverage gap

credentials brute-force와 enumeration, 실제 provider OAuth code replay/PKCE, spoofed forwarded header, import remote re-fetch idempotency, production migration 실행은 운영 검증 범위다. OAuth state/token malformed, visitor rotation, distinct price actor, admin CAS, DB bookmark persistence, malformed bbox/body, DB constraints, migration replay는 자동 검증했다.

## 10. 리팩터링 후보

1. auth/session fail-closed와 session revocation/version.
2. signed visitor actor와 IP trust boundary.
3. Turnstile policy/local test adapter와 body cap middleware.
4. 공통 admin moderation claim/CAS/audit service.
5. price report provenance/idempotency/verification domain model.
6. map search/viewport adapter와 FTS/bounds validation.
7. DB-backed bookmark repository와 mock adapter 분리.
8. import/seed external source upsert와 destructive guard.
9. moderation suggestion version/lifecycle service.
10. UI form accessibility/status/focus primitives.

## 11. 기능 아이디어

### 1) 서로 다른 확인 가격 신뢰 배지
- 해결할 문제: 반복 actor 제보로 verified가 과대평가될 수 있다.
- 현재 코드·데이터 근거: price_reports, verifiedReportCount, admin approval.
- MVP 범위: actor/source-aware count와 “서로 다른 확인” 설명.
- 주요 변경: provenance/actor/idempotency fields, verification query, admin warning.
- 보안·운영 위험: collusion, cookie rotation, privacy retention.
- 난이도: 높음. 기대 효과: 허위 검증 감소.
- 성공 지표: verified 가격 신고율, independent confirmation rate. 우선순위 A.

### 2) 공공데이터·사용자 제보 provenance timeline
- 해결할 문제: 기준일과 최신 확인을 구분하기 어렵다.
- 현재 코드·데이터 근거: import manifest와 price history.
- MVP 범위: source/기준일/사용자 확인일/운영 승인일.
- 주요 변경: source/import batch fields, detail/admin UI.
- 보안·운영 위험: stale source 오인.
- 난이도: 중간. 기대 효과: 최신성 판단 향상.
- 성공 지표: detail→price report CTR, stale 신고율. 우선순위 B.

### 3) 가격 제보 중복 합류 inbox
- 해결할 문제: 동일 price queue와 운영 클릭 수.
- 현재 코드·데이터 근거: normalizedLabel, price item unique, admin price queue.
- MVP 범위: pending 동일 key 묶기와 bulk decision.
- 주요 변경: group key/index, actor/source display.
- 보안·운영 위험: group poisoning, independent actor 필요.
- 난이도: 중간. 기대 효과: 검수 시간 감소.
- 성공 지표: report당 처리시간, grouped queue 비율. 우선순위 A.

### 4) 지역별 데이터 밀도 기반 제보 CTA
- 해결할 문제: low-density 지역에서 무엇을 제보할지 모른다.
- 현재 코드·데이터 근거: places 좌표/category, map count/bounds, visit_activity.
- MVP 범위: stale/verified weighted density와 “이 지역 가격 추가”.
- 주요 변경: density query/cache, empty state, telemetry.
- 보안·운영 위험: spam 데이터가 density를 부풀림.
- 난이도: 중간. 기대 효과: 지역 coverage·제보 전환 상승.
- 성공 지표: low-density submit CTR, 신규 active place/주. 우선순위 B.

### 5) 1인 운영 workload dashboard
- 해결할 문제: queue 우선순위를 수동으로 파악한다.
- 현재 코드·데이터 근거: admin queue, admin_actions, suggestions, visit_activity.
- MVP 범위: pending age, duplicate cluster, high-risk flag.
- 주요 변경: aggregation/index, filters, suggestion lifecycle.
- 보안·운영 위험: queue flooding.
- 난이도: 중간. 기대 효과: 검수 비용 감소.
- 성공 지표: median pending age, admin 처리량. 우선순위 B.

### 6) bookmark 가격 freshness prompt
- 해결할 문제: 오래된 가격으로 재방문 결정한다.
- 현재 코드·데이터 근거: bookmarks schema, lastPriceUpdatedAt, visit_activity.
- MVP 범위: stale badge와 in-app update prompt.
- 주요 변경: DB bookmark, freshness query/UI.
- 보안·운영 위험: false update spam.
- 난이도: 중간. 기대 효과: 재방문·최신성 상승.
- 성공 지표: bookmark revisit, stale→new report. 우선순위 C.

### 7) 공유용 결정 카드
- 해결할 문제: 공유 유입이 가격 신뢰를 즉시 이해하지 못한다.
- 현재 코드·데이터 근거: share source telemetry와 detail route.
- MVP 범위: 가격·검증·업데이트·주소 compact card/preview.
- 주요 변경: share payload/OG/cache.
- 보안·운영 위험: stale cache/내부 moderation 노출.
- 난이도: 중간. 기대 효과: 공유→bookmark/report 전환.
- 성공 지표: source별 CTR. 우선순위 D.

### 8) 공공 가격과 현장 제보 충돌 view
- 해결할 문제: source와 current price가 다를 때 운영자가 비교하기 어렵다.
- 현재 코드·데이터 근거: imported data, price history, admin queue.
- MVP 범위: 동일 label/단위 side-by-side와 차이율.
- 주요 변경: provenance, admin comparison query.
- 보안·운영 위험: 오래된 source를 정답으로 오인.
- 난이도: 중간. 기대 효과: 승인 속도·품질 개선.
- 성공 지표: approval median time, correction rate. 우선순위 A.

### 9) target-aware 신고·댓글 abuse queue
- 해결할 문제: actor별 limit만으로 특정 장소를 폭탄 처리할 수 있다.
- 현재 코드·데이터 근거: content_reports, comments, rate limit, admin reports.
- MVP 범위: target cap, same-reason dedupe, burst flag, bulk dismiss.
- 주요 변경: target bucket/index, admin filter.
- 보안·운영 위험: 정상 다수 신고 억제.
- 난이도: 중간. 기대 효과: queue 고갈 감소.
- 성공 지표: duplicate dismissal, queue age. 우선순위 A.

### 10) 장소 merge assistant와 보존 preview
- 해결할 문제: 공공/사용자 중복 장소와 문서상 미구현 merge.
- 현재 코드·데이터 근거: name/address/coordinate, comments, prices, bookmarks, reports.
- MVP 범위: candidate pair, price/comment/report/bookmark 보존 preview, admin confirm.
- 주요 변경: reversible merge transaction, alias/redirect, provenance, audit.
- 보안·운영 위험: 잘못된 merge로 history 손실.
- 난이도: 높음. 기대 효과: 검색 성공률·density·운영 비용 개선.
- 성공 지표: duplicate rate, zero-result rate, rollback rate. 우선순위 C.

## 12. 우선순위 로드맵

### A: 즉시 처리할 보안·데이터 문제

ALT-AUTH-001, ALT-SEC-001, ALT-SEC-002, ALT-COR-001, ALT-COR-002, ALT-SEC-003, ALT-COR-004, ALT-DATA-001.

### B: 작은 변경으로 효과가 큰 개선

ALT-COR-003, ALT-PERF-001, ALT-UX-001, target-aware dedupe/queue cap, admin pagination, exact Node/migration replay gate.

### C: 구조적 리팩터링

ALT-ARCH-001, Hyperdrive trigger 기반 전환, provenance/merge model, moderation lifecycle, FTS/PostGIS query abstraction.

### D: 제품 실험

verified evidence badge, provenance timeline, density CTA, conflict view, share card, freshness prompt, workload dashboard, merge assistant.

## 13. 독립 PR 단위 추천 실행 순서

1. security/session-fail-closed — fallback 제거, runtime/deploy gate, forged-cookie tests.
2. security/visitor-actor-integrity — signed visitor token, IP policy, rotation/ownership tests.
3. security/turnstile-and-body-guards — local-only bypass, 413 cap, write abuse tests.
4. data/price-verification-provenance — actor/source/idempotency, distinct verification, migration.
5. data/place-approval-reconciliation — initial report/item/summary parity.
6. admin/optimistic-moderation-claims — place/report CAS와 stale 409.
7. db/invariant-constraints — coordinates/amount/count/representative checks.
8. perf/map-query-bounds — global cap, bbox validation, FTS/benchmark.
9. feature/bookmarks-database — DB persistence와 E2E.
10. ops/migration-and-runtime-gates — exact Node, fresh migration, workerd smoke.
11. data/goodprice-provenance — source/external id/import batch/upsert.
12. ux/a11y-form-status — labels, aria-live, focus/sheet keyboard.
13. product/provenance-and-density — freshness/source/density UX와 metrics.
14. product/merge-assistant — reversible merge와 preservation preview.

## 14. 분석 커버리지와 추가 확인 사항

31개 Worker API route를 access/validation/rate/Turnstile/DB write/test 상태로 매트릭스화했다. auth/session/cookie/OAuth, public write actor/support, admin routes/repositories, map read, schema 7개와 migrations 13개, import/seed/production scripts, CI/workflows, E2E/unit tests, product/deploy/project docs, UI form/sheet/fallback을 확인했다.

배포 전 추가 확인:

1. Cloudflare runtime binding이 AUTH_SECRET, TURNSTILE_SECRET_KEY, USE_MOCK_DATA=false인지 read-only 확인.
2. production DB에 migrations 0000~0012가 적용됐는지 schema/migration read-only 확인.
3. disposable Postgres fresh migration replay 후 full E2E와 price concurrency 실행.
4. OAuth sandbox에서 state mismatch/expiry/code replay/provider malformed profile 검증.
5. visitor cookie rotation과 두 admin session 동시 결정 재현.
6. 10k/100k synthetic places로 global query/wide bbox p95, rows read, memory 측정.
7. Naver SDK 장애, Turnstile 장애, geolocation 거부, 모바일 keyboard/screen reader 검증.

위 항목이 완료되기 전까지 production 보안·데이터 정합성·확장성을 통과로 표시하지 않는다.

## 15. 후속 조치 및 재검증 상태

기준 감사의 P1/P2 실행 항목은 다음과 같이 반영했다.

- 세션 secret fail-closed, local-only Turnstile bypass, signed visitor actor, mutation body stream cap을 구현했다.
- 가격 제보 actor/source provenance, idempotency, distinct verification, 좌표·금액 DB check constraint를 추가했다.
- 승인 CAS와 가격 summary transaction, DB bookmark persistence, map bounds/global row cap을 반영했다.
- production migration은 기존 invalid price row를 감지하면 migration 전에 중단하며, destructive cleanup은 자동 실행하지 않는다.
- seed/import의 0 이하 가격 유입을 차단하고, CI local migration은 `db:push` 대신 migration replay를 사용한다.

재검증 결과:

| 검증 | 결과 |
| --- | --- |
| lint, typecheck, unit 19개 | 통과 |
| build, CSP inventory, dead-code hygiene, design detect | 통과 |
| disposable DB fresh migration/seed/production check | 통과 |
| DB 모드 full/mobile/performance/accessibility E2E | 24개 통과 |
| provenance schema, moderation lifecycle checks, duplicate analyzer | 통과 |
| Cloudflare deploy check 및 remote read-only smoke | 통과 |
| `npm audit --omit=dev --audit-level=moderate` | React Router 최신 공개 버전의 RSC-only upstream advisory 1건은 남음 |

남은 항목은 결함 통과로 표시하지 않는다. React Router advisory는 현재 client-only `BrowserRouter` 사용 코드에서 RSC/Server Action 경로가 호출되지 않지만, upstream fix가 공개되면 즉시 재평가한다. 실제 OAuth credential login, 외부 provider callback 성공, 실기기 접근성·저사양 성능 측정, production DB migration 실행은 운영자 수동 승인 범위다.
