# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 백엔드 신입 채용 리뷰에서 지적될 보안·설계·저장소 위생 결함을 제거한다.

Observable finish state:
- 운영 데모가 실제 데이터로 동작하고, 정기 smoke가 실패하면 알 수 있다.
- 관리자 대시보드와 화면에 가짜 지표·빈 화면이 없고, UI가 `.impeccable.md` 기준과 일치한다.
- 운영 인증 경로에 하드코딩 계정·mock 분기가 없고, 세션은 DB에서 폐기 가능하다.
- 익명 rate limit은 쿠키 없이 우회되지 않는다.
- route → service → repository 계층과 도메인 에러 타입이 있고, 도메인 규칙은 DB 없이 unit test된다.
- `npm run verify`, `npm run test:integration`, `npm run test:e2e:full`, `npm audit --omit=dev --audit-level=high`가 통과한다.

공통 integration 실행 명령(이하 `INTEGRATION`): `npm run test:integration:local`

## Active

No active work

## Backlog

- CI의 `csp:inventory`가 runner에 `rg`가 없어 항상 통과함(`scripts/check-csp-inline-style-inventory.mjs`의 `runRipgrep`이 오류를 빈 결과로 삼킴). `rg` 없으면 실패하도록 바꾸거나 Node 기반 검색으로 교체하고, 로컬에서 걸리는 `src/features/map/naver-map-preview-parts.tsx:113`의 inline style 정리
- 한국 기준 지도 첫 화면 캐시 미스 p95(약 1.2초)를 더 줄이려면 목록 건수(100) 축소 또는 가까운 리전 Postgres로 Hyperdrive 대상 교체(`deploy/vps/README.md` §5)
- 백업·운영 증적: 2026-11-24 04:17 UTC 이후 VPS 일 1회 백업 cron이 새 덤프를 만들었는지 확인, 맥 밖 원격 스토리지(예: R2) 보관, 새 서버 복구 리허설(role·Hyperdrive 포함, RTO 측정), staging OAuth 성공 callback, Cloudflare 알림 수신
- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
