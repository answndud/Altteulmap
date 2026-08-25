# Production Reliability Audit — 2026-08-25

## Scope and method

요청 진입부터 Worker route, DB transaction, 외부 API, HTTP 응답, React 상태와 사용자 메시지까지 실패 생명주기를 추적했다. 자동 retry는 추가하지 않았고, 반복 가능한 쓰기에는 기존 idempotency/unique constraint가 있는지 먼저 확인했다. 동시성은 특히 denormalized summary와 moderation claim을 실제 SQL 순서로 검토했다.

## Findings and remediation

### REL-001 — 반응 집계가 동시 요청에서 stale count를 저장할 수 있음

- Severity: High
- Confidence: High
- Status: Fixed
- Path: `setDatabasePlaceReaction`가 reaction row 변경과 별도로 count를 읽고 `places.like_count/dislike_count`를 갱신했다.
- Failure: 동시에 한 요청이 반응을 추가하고 다른 요청이 삭제하면 각 요청이 서로 다른 snapshot을 집계한 뒤 마지막 update가 실제 row 상태와 다른 count를 저장할 수 있었다.
- Impact: 사용자에게 잘못된 좋아요/싫어요 수가 지속 노출되고 후속 정렬·지도 요약이 오염된다.
- Remediation: place row를 `FOR UPDATE`로 잠그고 reaction mutation 및 summary refresh를 하나의 DB transaction으로 묶었다. 두 요청은 같은 장소에서 직렬화된다.

### REL-002 — OAuth/Turnstile 외부 호출에 상한 시간이 없음

- Severity: High
- Confidence: High
- Status: Fixed
- Path: OAuth token/profile fetch와 Turnstile siteverify fetch가 네트워크 응답을 무기한 기다릴 수 있었다.
- Failure: 외부 provider 지연·연결 정체 시 Worker request와 DB transaction 전 단계가 오래 점유된다.
- Impact: 사용자 요청 hang, Worker concurrency 고갈, 로그인/공개 쓰기 장애 전파.
- Remediation: 공통 `fetchWithTimeout`으로 OAuth는 8초, Turnstile은 5초 deadline을 적용했다. retry는 하지 않으며 timeout은 기존 generic error lifecycle로 전달된다.

### REL-003 — 네트워크 단절/비JSON 응답이 공개 폼에서 사용자 상태로 전파되지 않음

- Severity: Medium
- Confidence: High
- Status: Fixed
- Path: 장소 등록, 가격 제보, 코멘트, 신고 폼이 `fetch`와 `response.json()`을 await하면서 예외를 catch하지 않았다.
- Failure: 네트워크 중단 또는 proxy의 HTML/빈 응답에서 transition callback이 reject되어 사용자에게 결과가 보이지 않고, retry 방법도 없었다.
- Impact: 사용자는 저장 여부를 알 수 없어 중복 재제출할 수 있고 입력 상태·신뢰성을 잃는다.
- Remediation: fetch와 JSON parse를 catch/finally로 감싸고, HTTP 오류·malformed response·network failure에 명확한 실패 메시지를 표시한다. 실패 시 입력은 유지하고 성공 때만 초기화한다.

### REL-004 — 장소 신규 등록은 클라이언트 재전송에 완전한 idempotency가 없음

- Severity: Medium
- Confidence: High
- Status: Open / documented
- Path: `POST /api/places`는 하나의 transaction으로 원자적이지만, 같은 요청이 다시 오면 새로운 slug/place/price report를 만든다. 현재 `submissionKey` idempotency는 가격 제보 endpoint에만 적용된다.
- Attacker/user prerequisite: 응답 유실, 모바일 재전송, 브라우저 중복 요청 또는 네트워크 retry가 필요하다.
- Impact: pending place 중복과 운영 moderation queue 중복이 발생한다. slug collision은 unique constraint 경합 시 500으로 끝날 수 있다.
- Safe next step: public API에 `Idempotency-Key`를 도입하고 별도 request-result 저장/unique constraint를 migration으로 추가해야 한다. 의미가 다른 동일 내용 제보를 임의 deduplicate하는 방식은 적용하지 않았다.

## Positive reliability controls

- Read DB operations have a 5-second application timeout plus PostgreSQL statement/lock/idle transaction timeouts.
- Public price reports use an actor/content-derived unique `submissionKey`, and bookmarks/reactions use database conflict-safe writes.
- Place submission uses a DB transaction, so place/category/price/report partial writes roll back together.
- Admin moderation uses transaction claim predicates and advisory locks for report/group verification races.
- Global Worker error handling returns a bounded generic 500 response with `requestId`; structured logs retain method/path/error name for operators without returning stack traces.
- Read fetches abort on component cleanup and map requests use sequence checks, limiting stale response overwrites.

## Remaining risks and observations

- Map edge cache is intentionally short-lived (12 seconds); mutation invalidation is process-local, so another Worker isolate can serve bounded stale map data until TTL expiry. This is a consistency tradeoff, not a correctness-critical write loss.
- Public write rate-limit persistence failing can turn a request into a generic 500 rather than silently accepting an unbounded operation; this is fail-closed but needs an operator-visible dependency error metric.
- No background jobs, email delivery, Redis, file upload, or deployment-time migration runner are present in the inspected runtime, so those failure classes are not applicable to current code.
- Frontend admin mutations surface backend messages through `fetchJson`; public forms now use stable status-aware fallback messages rather than requiring exact backend wording.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run verify`
- `git diff --check`

Remote provider outage, production Worker isolate behavior, and live database failover still require staging credentials and deployment access; they were not simulated by local mock tests.
