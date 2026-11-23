# Architecture Decision Records

코드에서 읽히는 선택과 그 이유, 버린 대안, 감수한 한계를 짧게 기록한다. 새 결정은 번호를 이어 추가하고, 바뀌면 기존 문서를 지우지 않고 상태를 `대체됨`으로 바꾼다.

| 번호 | 결정 | 상태 |
| --- | --- | --- |
| [0001](0001-database-sessions.md) | 로그인 세션을 서명 쿠키가 아니라 DB에 둔다 | 채택 |
| [0002](0002-rate-limit-in-postgres.md) | 공개 쓰기 rate limit을 Postgres에 두고 IP·계정 버킷을 더한다 | 채택 |
| [0003](0003-price-moderation-locking.md) | 가격 검수는 advisory lock과 조건부 UPDATE로 직렬화한다 | 채택 |
| [0004](0004-request-scoped-db-connection.md) | Worker는 요청마다 연결 1개를 열고 닫는다 | 채택 |
| [0005](0005-offset-pagination-for-admin-queue.md) | 관리자 큐는 offset 페이지네이션을 쓴다 | 채택(재평가 조건 있음) |
