# API 계약 지도

이 표는 route 등록 위치와 현재 서버 경계를 요약한 것이다. “Validation”은 route 또는 호출 helper에서 확인한 입력 경계, “Test”는 저장소에 존재하는 대표 자동 검증을 뜻한다. 외부 provider와 실제 production mutation은 이 표의 자동 테스트로 대체하지 않는다.

| Method | Route | Access | Validation/guard | Rate limit/Turnstile | DB write | Test 근거 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | /api/health | Public | query mode, health dependency | 없음 | 없음/상태 read | health smoke |
| GET | /api/categories | Public | 없음/고정 config | 없음 | 없음 | E2E map |
| GET | /api/config/public | Public | public config | 없음 | 없음 | smoke |
| GET | /api/places/map | Public | bbox, zoom, category/query | 없음 | 없음 | map E2E, map:measure |
| GET | /api/places/:id | Public | id/path, active place filter | 없음 | 없음 | detail E2E |
| GET | /api/auth/providers | Public | provider config | 없음 | 없음 | auth contract |
| GET | /api/auth/csrf | Public | cookie response | 없음 | 없음 | auth E2E |
| GET | /api/auth/session | Public | signed session parse | 없음 | 없음 | login E2E |
| POST | /api/auth/callback/credentials | Public credential write | credentials schema, password hash check | 로그인 abuse 방어 범위 별도 | users/session | login E2E |
| POST | /api/auth/signup | Public credential write | signup schema, duplicate email | rate policy 확인 필요 | users | signup E2E |
| GET | /api/auth/signin/:provider | Provider callback start | provider/callback URL, signed OAuth state | 없음 | state cookie | OAuth unit contract |
| GET | /api/auth/callback/:provider | Provider callback | code, state cookie equality, nonce/provider, profile | provider side | users/auth_accounts/session | malformed OAuth unit |
| POST | /api/auth/signout | Authenticated | session/cookie | 없음 | session cookie clear | auth E2E |
| GET | /api/bookmarks | Authenticated | signed session/user | 없음 | 없음 | bookmarks E2E |
| PUT | /api/bookmarks/:id | Authenticated | place id, session user ownership | rate policy | bookmarks | bookmarks E2E |
| POST | /api/places | Guest write | body cap, submission schema, actor | persistent rate + Turnstile | places/price_reports | submission-admin E2E |
| POST | /api/places/:id/prices | Guest write | body cap, price schema, actor | persistent rate + Turnstile | price_reports | price review E2E, concurrency smoke |
| POST | /api/places/:id/comments | Guest write | body cap, comment schema, actor | persistent rate + Turnstile | comments | comments E2E |
| DELETE | /api/places/:id/comments/:commentId | Guest owner/Auth/Admin | actor ownership or admin | rate policy | comments | comments E2E |
| POST | /api/reports | Guest write | body cap, report schema, actor | persistent rate + Turnstile | content_reports | report-admin E2E |
| PUT | /api/places/:id/reaction | Guest/Auth | reaction schema, actor key | rate policy | reactions | unit/E2E scope |
| POST | /api/telemetry/visit | Guest/Auth | visit payload, actor | dedupe/rate policy | visit_activity | admin dashboard E2E |
| GET | /api/admin/reports | Admin | requireAdminSession, query filter | 없음 | 없음 | report-admin E2E |
| PATCH | /api/admin/reports/:id | Admin | requireAdminSession, moderation schema | 없음 | content_reports/admin_actions | report-admin E2E |
| GET | /api/admin/prices | Admin | requireAdminSession | 없음 | 없음 | price review E2E |
| PATCH | /api/admin/prices/:id | Admin | requireAdminSession, moderation schema | 없음 | price/report/summary/admin_actions | price review E2E |
| GET | /api/admin/prices/places/:id | Admin | requireAdminSession, id | 없음 | 없음 | admin E2E |
| PATCH | /api/admin/price-items/:id | Admin | requireAdminSession, item schema | 없음 | price_items/admin_actions | admin E2E |
| GET | /api/admin/places | Admin | requireAdminSession, filters | 없음 | 없음 | admin places E2E |
| GET | /api/admin/places/:id | Admin | requireAdminSession, id | 없음 | 없음 | admin places E2E |
| PATCH | /api/admin/places/:id | Admin | requireAdminSession, place schema/CAS | 없음 | places/admin_actions | admin places E2E |

## route별 읽는 순서

1. src/worker/index.ts에서 middleware와 register 함수 순서를 확인한다.
2. src/worker/routes의 route handler에서 parse, session/actor, rate limit, DB branch, response status를 확인한다.
3. repository에서 실제 transaction/unique/index/조건부 update를 확인한다.
4. schema와 migration에서 DB가 강제하는 invariant를 확인한다.
5. tests에서 실제로 통과한 branch와 빠진 branch를 확인한다.

## 계약상 주의점

- mock 응답과 database 응답의 status/shape가 항상 같은 것은 아니다. 문서와 테스트는 source/mock을 구분한다.
- admin route가 존재한다는 사실은 일반 사용자가 호출할 수 있다는 뜻이 아니다. 서버 role guard가 계약의 일부다.
- route 목록은 자동 생성된 OpenAPI가 아니므로 새 route 추가 시 이 표와 관련 테스트를 함께 갱신해야 한다.
