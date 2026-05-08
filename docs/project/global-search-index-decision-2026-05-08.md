# Global Search Index 도입 기준 리포트

기준일: 2026-05-08

## 결론
- 현재는 global search index를 즉시 추가하지 않는다.
- 이유는 운영 API p95가 1k seed 목표 안에 있고, DB `EXPLAIN ANALYZE`도 현재 데이터 규모에서는 10ms대 이하로 끝나기 때문이다.
- 다만 현재 query plan은 index-friendly하지 않다. 데이터가 10k 이상으로 늘면 `ILIKE '%query%'`가 병목이 될 가능성이 높으므로, `pg_trgm` 기반 expression index와 query rewrite를 다음 단계 전략으로 둔다.

## 현재 검색 구조
API:

```text
GET /api/places/map?scope=global&query=<keyword>
```

현재 Worker query:
- `places.status = active`
- `latitude/longitude is not null`
- 다음 7개 컬럼에 `ILIKE '%query%'` OR 조건:
  - `name`
  - `business_name`
  - `road_address`
  - `district`
  - `representative_price_label`
  - `description`
  - `note`

현재 인덱스:
- viewport/category 검색용 btree 인덱스는 있음
- global keyword search 전용 trigram/full-text 인덱스는 없음
- 운영 DB의 `pg_trgm` extension은 아직 설치되어 있지 않음

## 운영 측정
명령:

```bash
MAP_MEASURE_URL=https://altteulmap.altteul-lab.workers.dev npm run map:measure
```

결과:

| Scenario | Count | Returned | Marker mode | Avg | P95 | Max |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| `seoul-viewport-z11` | 500 | 120 | cluster | 30ms | 43ms | 43ms |
| `seoul-category-food-z13` | 140 | 120 | cluster | 38ms | 64ms | 64ms |
| `global-query-kimbap` | 55 | 55 | place | 143ms | 213ms | 213ms |

목표:
- 1k places: p95 <= 300ms
- 10k places: p95 <= 500ms
- 100k places: p95 <= 800ms

판단:
- 현재 global query p95 `213ms`는 1k 목표 `300ms` 안에 있다.
- viewport query보다 global query가 훨씬 느리므로, 데이터 증가 시 우선 병목 후보는 global search다.

## DB Query Plan
명령:

```bash
SEARCH_ANALYZE_QUERY=김밥 SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze
```

결과 요약:
- `pg_trgm` 설치 여부: false
- `김밥` count: 55
- current OR query:
  - plan: `Index Scan` on `places_representative_price_idx` + filter
  - execution: `13.417ms`
- proposed expression query:
  - plan: `Seq Scan`
  - execution: `7.327ms`

추가 확인:

```bash
SEARCH_ANALYZE_QUERY=서울 SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze
SEARCH_ANALYZE_QUERY=분식 SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze
```

결과:
- `서울`: count 502, current scale에서 약 7-8ms대
- `분식`: count 27, current scale에서 약 7-8ms대

판단:
- 1k seed에서는 sequential scan 또는 기존 가격 정렬 index scan으로도 충분히 빠르다.
- 하지만 검색 조건 자체는 `%query%` 포함 검색이므로 btree가 근본 해결책이 아니다.
- `places_representative_price_idx`를 타는 current OR query도 검색 인덱스가 아니라 정렬 인덱스를 먼저 타고 필터링하는 형태라 데이터가 커지면 예측 가능성이 낮다.

## pg_trgm vs Full-text
### pg_trgm 권장
이 프로젝트에는 `pg_trgm`이 더 적합하다.

이유:
- 현재 검색은 자연어 랭킹보다 부분 문자열 탐색이다.
- 장소명, 주소, 지역, 대표 가격 라벨 같은 짧은 필드가 중심이다.
- 한국어 기본 full-text tokenizer 품질을 별도로 설계하지 않아도 된다.
- PostgreSQL 공식 문서상 `pg_trgm`은 trigram 기반 similarity와 `LIKE`/`ILIKE` 검색을 돕는 GiST/GIN index operator class를 제공한다.

### Full-text 보류
Full-text search는 아래 조건이 생길 때 별도로 검토한다.

- 리뷰/댓글/설명처럼 긴 본문 검색이 핵심 기능이 된다.
- 랭킹, stemming, token dictionary, 검색어 하이라이트가 필요해진다.
- 한국어 형태소/tokenizer 전략을 별도로 선택할 준비가 된다.

## 권장 Migration 전략
바로 적용하지 않는다. Trigger가 충족되면 다음 순서로 적용한다.

### Migration 1. Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Migration 2. Expression GIN Index
Drizzle schema에 무리하게 표현하기보다 운영용 SQL migration으로 명시한다.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS places_search_text_trgm_idx
ON places
USING gin ((
  coalesce(name, '') || ' ' ||
  coalesce(business_name, '') || ' ' ||
  coalesce(road_address, '') || ' ' ||
  coalesce(district, '') || ' ' ||
  coalesce(representative_price_label, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(note, '')
) gin_trgm_ops)
WHERE status = 'active'
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;
```

주의:
- `CREATE INDEX CONCURRENTLY`는 transaction block 안에서 실행하면 안 된다.
- 일반 Drizzle migrator가 transaction 안에서 migration을 묶는지 확인해야 한다.
- transaction 제약이 있으면 이 index migration은 별도 운영 runbook으로 실행하고, 적용 이력을 문서화한다.

### Code Change
인덱스를 실제로 타려면 current OR query를 expression query로 바꿔야 한다.

현재:

```sql
name ilike '%query%'
or business_name ilike '%query%'
...
```

변경:

```sql
(
  coalesce(name, '') || ' ' ||
  coalesce(business_name, '') || ' ' ||
  coalesce(road_address, '') || ' ' ||
  coalesce(district, '') || ' ' ||
  coalesce(representative_price_label, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(note, '')
) ilike '%query%'
```

API response shape, route path, 검색 결과 의미는 유지한다.

## 도입 Trigger
아래 중 하나가 충족되면 index 작업을 시작한다.

- 운영 `global-query-kimbap` p95가 300ms를 3회 연속 초과한다.
- 장소 데이터가 10k 이상으로 증가한다.
- `SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze`에서 global query execution time이 100ms를 반복 초과한다.
- query plan에서 `Seq Scan` 또는 정렬 index scan의 scanned row가 10k 이상으로 증가한다.
- 사용자 검색 UX에서 “검색중” 대기 체감이 반복 제보된다.

## Rollback
성능이나 결과 품질 문제가 있으면 다음 순서로 되돌린다.

1. Worker query를 기존 OR `ILIKE` 조건으로 되돌린다.
2. 배포 후 `npm run smoke:remote`, `npm run map:measure`를 실행한다.
3. index가 불필요하거나 문제를 만든다면 운영 low-traffic 시간에 제거한다.

```sql
DROP INDEX CONCURRENTLY IF EXISTS places_search_text_trgm_idx;
```

`pg_trgm` extension은 다른 객체가 사용하지 않는지 확인한 뒤에만 제거한다.

## 검증 루틴
자동:

```bash
npm run typecheck
npm run lint
npm run smoke:vite:local
npm run deploy:check:vite
MAP_MEASURE_URL=https://altteulmap.altteul-lab.workers.dev npm run map:measure
SEARCH_ANALYZE_QUERY=김밥 SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze
git diff --check
```

수동:
- 검색어 `김밥`, `분식`, `서울`, 지역명/주소 일부로 검색한다.
- 지도 marker/list count가 기존 의미와 맞는지 확인한다.
- 모바일에서 검색 입력 후 지도 이동/상세 진입이 느려지지 않는지 확인한다.

## 참고 문서
- PostgreSQL `pg_trgm`: https://www.postgresql.org/docs/17/pgtrgm.html
- PostgreSQL `CREATE INDEX`: https://www.postgresql.org/docs/17/sql-createindex.html
