# Hyperdrive 도입 판단 리포트

기준일: 2026-05-08

## 결론
- 현재는 Hyperdrive를 즉시 도입하지 않고 보류한다.
- 이유는 운영 map API p95가 현재 목표를 충분히 만족하고, remote smoke에서 DB 연결 장애가 재현되지 않았기 때문이다.
- 대신 Worker DB layer는 `HYPERDRIVE.connectionString`을 우선 사용하도록 준비해 두었다. Cloudflare Dashboard/Wrangler에서 binding만 추가하면 기존 `DATABASE_URL` fallback을 유지한 채 전환할 수 있다.

## 현재 구조
- 런타임: Cloudflare Worker
- DB: Supabase PostgreSQL
- 현재 운영 연결: `DATABASE_URL` 직접 연결
- 적용된 timeout baseline:
  - `connect_timeout=5s`
  - `statement_timeout=4500ms`
  - `lock_timeout=2000ms`
  - `idle_in_transaction_session_timeout=5000ms`
  - Worker read timeout `5000ms`
  - DB unavailable TTL `60000ms`
- 코드 변경:
  - `src/worker/db.ts`가 `env.HYPERDRIVE.connectionString`을 먼저 사용한다.
  - Hyperdrive binding이 없으면 기존 `DATABASE_URL`을 그대로 사용한다.
  - `/api/health`의 database check는 source를 `hyperdrive`, `database-url`, `mock`, `missing`으로 구분한다.

## 운영 측정
측정 명령:

```bash
MAP_MEASURE_URL=https://altteulmap.altteul-lab.workers.dev npm run map:measure
```

결과:

| Scenario | Count | Returned | Marker mode | Avg | P95 | Max |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| `seoul-viewport-z11` | 500 | 120 | cluster | 31ms | 37ms | 37ms |
| `seoul-category-food-z13` | 140 | 120 | cluster | 31ms | 36ms | 36ms |
| `global-query-kimbap` | 55 | 55 | place | 146ms | 224ms | 224ms |

목표:
- 1k places: p95 <= 300ms
- 10k places: p95 <= 500ms
- 100k places: p95 <= 800ms

판단:
- 현재 1k seed 수준에서는 세 시나리오 모두 목표 안에 있다.
- global query가 viewport보다 느리지만 아직 1k 기준 p95 300ms 안에 있다.
- 지금 병목은 Hyperdrive보다 향후 global search index가 될 가능성이 더 크다.

## Remote Smoke
측정 명령:

```bash
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote
```

결과:
- deep health 통과
- home/robots/sitemap/public config 통과
- map API database source 확인
- place API database source 확인
- login 통과
- admin route 통과
- admin API boundary 401 확인
- Kakao/Naver provider redirect 통과
- admin credentials smoke는 secret 미설정으로 skip

## 도입 Trigger
다음 조건 중 하나가 반복되면 Hyperdrive 전환 작업을 시작한다.

- `database` deep health 실패 또는 DB timeout이 하루 2회 이상 반복된다.
- map API p95가 1k seed 기준 300ms를 반복 초과한다.
- Supabase connection limit 또는 connection churn 관련 장애가 확인된다.
- 사용자 유입이 늘어 public read/write가 동시 발생하기 시작한다.

## 전환 절차
Cloudflare 공식 문서 기준으로 Hyperdrive는 Worker binding을 만들고 `env.<BINDING>.connectionString`을 Postgres driver에 넘기는 방식이다.

1. Hyperdrive 생성

```bash
npx wrangler hyperdrive create altteulmap-prod-hyperdrive \
  --connection-string="<production-supabase-connection-string>"
```

2. `wrangler.jsonc` binding 추가

```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<hyperdrive-id>"
    }
  ]
}
```

3. 배포/검증

```bash
npm run cf:build:vite
npm run deploy:check:vite
npm run deploy:vite
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote
MAP_MEASURE_URL=https://altteulmap.altteul-lab.workers.dev npm run map:measure
```

4. Rollback
- `wrangler.jsonc`에서 `hyperdrive` binding을 제거한다.
- 재배포하면 Worker는 기존 `DATABASE_URL` 직접 연결로 fallback한다.
- Hyperdrive configuration은 안정화 확인 후 삭제한다.

## 참고 문서
- Cloudflare Hyperdrive getting started: https://developers.cloudflare.com/hyperdrive/get-started/
- Cloudflare Hyperdrive PostgreSQL example: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/
