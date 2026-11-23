# 0004. Worker는 요청마다 DB 연결 1개를 열고 닫는다

상태: 채택 · 관련 코드: `src/worker/db.ts` · 관련 문서: [ADR 0006](0006-vps-postgres-via-tunnel-and-hyperdrive.md), [운영 지연 측정](../06-성능/결과/2026-11-24-한국-측정.md)

## 맥락
Workers는 요청 사이에 연결을 안전하게 공유할 수 없고 isolate가 수시로 만들어지고 사라진다. 전역 풀을 두면 닫히지 않은 소켓과 DB `max_connections` 고갈 위험이 생긴다.

## 결정
- `AsyncLocalStorage`로 요청 컨텍스트를 만들고 그 안에서 `postgres.js` 클라이언트(`max: 1`, `prepare: false`)를 지연 생성한다. 요청이 끝나면 `finally`에서 닫는다. 이미 컨텍스트가 있으면 재사용한다.
- 세션 단위로 `statement_timeout` 4.5초, `lock_timeout` 2초, `idle_in_transaction_session_timeout` 5초, 연결 타임아웃 5초를 둔다.
- 연결 오류가 나면 60초 동안 "일시 사용 불가"로 표시해 즉시 503을 반환한다(circuit breaker). 이 구간에 mock이나 폴백 인증으로 넘어가지 않는다.
- `HYPERDRIVE` binding이 있으면 우선 쓰고, 없으면 `DATABASE_URL`을 쓴다.

## 대안과 버린 이유
- **전역 풀**: isolate 수명과 맞지 않아 연결 누수 위험이 크다.
- **Hyperdrive 없이 직접 연결**: 처음에는 이렇게 운영했지만, DB를 공개 포트 없는 VPS로 옮기면서 Hyperdrive(+ Workers VPC)가 유일한 경로가 됐다([ADR 0006](0006-vps-postgres-via-tunnel-and-hyperdrive.md)).

## 결과와 한계
- 요청마다 연결 수립 비용이 든다(Hyperdrive가 연결 풀을 맡지만 Worker↔VPS 왕복 지연은 남는다). 한 요청에서 서비스가 따로 연결을 열면 연결이 늘 수 있어, 세션 조회는 컨텍스트가 있으면 재사용하도록 했다.

## 측정에서 얻은 결론
- 먼 DB에서는 쿼리 1개 왕복이 약 0.35~0.4초이고, Hyperdrive 경유에서 한 연결의 쿼리는 사실상 순차로 처리된다. `max: 1`을 유지한 채 병렬화해도 빨라지지 않으므로, 요청당 쿼리 **수**를 줄이는 것이 이 구조의 성능 규칙이다(상세 5 → 1개, 지도 2 → 1개).
- 수치와 전후 비교는 [운영 지연 측정](../06-성능/결과/2026-11-24-한국-측정.md)에 있다.
