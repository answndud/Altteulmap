# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 실제 운영 증거와 대규모 PostgreSQL 성능을 확보해 `READY WITH RISKS`를 근거 기반 승인에 가깝게 만든다.

## Active

### P2 - 대규모 성능 증거 마감

1. P2.1 - 100만 staging dataset 성능 예산을 측정한다.
   - 파일: `scripts/measure-search-benchmark.mjs`, `scripts/measure-map-api.mjs`, `scripts/analyze-global-search-query.mjs`, `docs/09-운영-가이드/성능-예산.md`
   - 변경: production 데이터를 복제하지 않고 저장소 여유가 확보된 별도 staging PostgreSQL에 100만 synthetic fixture를 생성한다. 지도 bbox·global search·category·admin queue의 p50/p95/p99, DB plan·rows-read·payload·timeout·connection 사용량을 기록한다.
   - 검증: `BENCHMARK_DATABASE_URL="$STAGING_DATABASE_URL" BENCHMARK_ITERATIONS=20 npm run search:benchmark`, `MAP_MEASURE_URL="$STAGING_URL" npm run map:measure`, `SEARCH_ANALYZE_EXECUTE=1 npm run search:analyze`
   - 완료: 100만 규모 artifact가 생성되고 p95/p99·rows-read·payload 예산을 통과하거나, 초과 원인에 맞는 bounded query·index·alert 조치가 반영된다.
   - 주의: 로컬 Docker 내부 저장소 부족으로 실행하지 않는다. production DB나 다른 프로젝트의 Docker volume을 삭제하지 않는다.

## Backlog

- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 이메일 provider sandbox의 bounce·재전송 멱등성 검증
- 장소 merge 대량 데이터 이전·중단 복구 정책
- 24시간 soak test와 다중 Worker 장애 주입
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
