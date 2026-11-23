# 0004. Worker는 요청마다 DB 연결 1개를 열고 닫는다

상태: 채택 · 관련 코드: `src/worker/db.ts` · 관련 문서: [Hyperdrive 판단](../project/hyperdrive-decision-2026-05-08.md)

## 맥락
Workers는 요청 사이에 연결을 안전하게 공유할 수 없고 isolate가 수시로 만들어지고 사라진다. 전역 풀을 두면 닫히지 않은 소켓과 DB `max_connections` 고갈 위험이 생긴다.

## 결정
- `AsyncLocalStorage`로 요청 컨텍스트를 만들고 그 안에서 `postgres.js` 클라이언트(`max: 1`, `prepare: false`)를 지연 생성한다. 요청이 끝나면 `finally`에서 닫는다. 이미 컨텍스트가 있으면 재사용한다.
- 세션 단위로 `statement_timeout` 4.5초, `lock_timeout` 2초, `idle_in_transaction_session_timeout` 5초, 연결 타임아웃 5초를 둔다.
- 연결 오류가 나면 60초 동안 "일시 사용 불가"로 표시해 즉시 503을 반환한다(circuit breaker). 이 구간에 mock이나 폴백 인증으로 넘어가지 않는다.
- `HYPERDRIVE` binding이 있으면 우선 쓰고, 없으면 `DATABASE_URL`을 쓴다.

## 대안과 버린 이유
- **전역 풀**: isolate 수명과 맞지 않아 연결 누수 위험이 크다.
- **Hyperdrive 즉시 도입**: 연결 지연이 목표 안이어서 보류했고, 코드는 binding 우선으로 준비해 두었다. 연결 지연·동시 연결 지표가 나빠지면 재평가한다.

## 결과와 한계
- 요청마다 연결 수립 비용이 든다(Hyperdrive가 연결 풀을 맡지만 Worker↔VPS 왕복 지연은 남는다). 한 요청에서 서비스가 따로 연결을 열면 연결이 늘 수 있어, 세션 조회는 컨텍스트가 있으면 재사용하도록 했다.

## 운영 DB 이전 후 측정 (2026-11-23)
- 운영 DB는 netcup VPS(오스트리아)의 전용 Postgres이고 Hyperdrive → Workers VPC → Cloudflare Tunnel로 접속한다. Worker 안에서 `select 1`은 14ms다.
- 같은 대륙 호출자 기준 지도 조회 0.43~0.63s, 대륙 간 호출자(미국 서부 경유) 기준 약 1.9s다. 목표(p95 1초)는 DB와 멀리 떨어진 호출자에게는 아직 못 맞춘다.
- Worker를 EU 리전에 고정하면 오히려 느려져(지도 약 5.6s) 고정하지 않고 smart placement만 켰다. 다음 후보는 공개 GET의 엣지 캐시와 가까운 리전의 Postgres다.

### 브라우저 실측 (Claude 인앱 브라우저, Cloudflare LAX 경유, fetch 왕복, 2026-11-23)
| 요청 | p50 | p95 |
| --- | --- | --- |
| 정적 `/` (DB 없음) | 166ms | 232ms |
| `/api/config/public` (DB 없음) | 159ms | 206ms |
| 지도 조회, 서울 zoom 15 (bbox 변경) | 925ms | 1,144ms |
| 지도 조회, 서울 전체 zoom 11 (bbox 변경) | 1,245ms | 1,727ms |
| 장소 상세 `/api/places/:id` | 1,551ms | 1,632ms |

DB를 쓰지 않는 요청이 160ms인 것을 기준으로 보면 DB 구간이 지도 약 0.8~1.1초, 상세 약 1.4초다. 상세는 순차 쿼리(장소 조회 → 가격·이력·코멘트 병렬 → 반응) 때문에 왕복이 가장 많다. 목표(지도 p95 1초)는 zoom 15에서 근접(1.14초)하고 zoom 11과 상세에서는 넘는다. 개선 후보: 상세 쿼리를 한 번의 병렬 묶음으로 줄이기, 비로그인 공개 GET(상세)의 엣지 캐시, 이미 있는 지도 엣지 캐시의 적중률 확인.
