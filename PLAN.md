# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 백엔드 신입 채용 리뷰에서 지적될 보안·설계·저장소 위생 결함을 제거한다.

Observable finish state:
- 운영 데모가 실제 데이터로 동작하고, 정기 smoke가 실패하면 알 수 있다.
- 관리자 대시보드와 화면에 가짜 지표·빈 화면이 없고, UI가 `.impeccable.md` 기준과 일치한다.
- 운영 인증 경로에 하드코딩 계정·mock 분기가 없고, 세션은 DB에서 폐기 가능하다.
- 익명 rate limit은 쿠키 없이 우회되지 않는다.
- route → service → repository 계층과 도메인 에러 타입이 있고, 도메인 규칙은 DB 없이 unit test된다.
- `docs/`는 기준 문서 1벌 + ADR 중심이며, Next.js 잔재와 마이그레이션 drift가 없다.
- `npm run verify`, `npm run test:integration`, `npm run test:e2e:full`, `npm audit --omit=dev --audit-level=high`가 통과한다.

공통 integration 실행 명령(이하 `INTEGRATION`): `npm run test:integration:local`

## Active

### Phase 1. 데모 복구와 인증·남용 방지 결함 제거

#### 1-0. 운영 데모 복구 (수동 blocker만 남음)
- Current blocker: 운영 `/api/health?deep=1`이 `database: fail`, `/api/places/map`이 503이다(2026-11-23 확인, Supabase 비활성 일시정지 추정). GitHub secret `SMOKE_PUBLIC_URL`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`가 없다. 둘 다 사용자가 직접 처리해야 한다.
- Next action: 사용자가 Supabase 프로젝트를 복구하고 secret 3개를 등록한 뒤 `gh workflow run keep-alive.yml && gh workflow run ci.yml`로 확인한다.
- Verify: `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`
- Done: 운영 첫 화면에 장소 목록과 마커가 보이고, `Keep Alive`와 수동 실행한 CI의 `Remote Smoke`, `E2E Full`이 성공한다.

### Phase 3. 저장소 위생·화면 정직성·문서 정리

#### 3-6. 디자인 토큰 일치와 상세 페이지 정리
- Likely files: `src/client/styles.css`, `.impeccable.md`, `src/client/routes/PlaceDetailRoute.tsx`, `src/client/features/map/PlaceDetailSheet.tsx`
- Changes:
  - `.impeccable.md`는 따뜻한 톤(배경 `#f4f1ec`, 강조색 `#b55a2b`)을 기준으로 하는데 실제 화면은 파랑(`oklch(0.48 0.17 255)`)이다. 문서 기준으로 맞출지, 문서를 고칠지 정해 한쪽으로 통일한다.
  - 글자 크기를 11px, 11.52px, 12px처럼 비슷한 값이 섞인 상태에서 5단계 이하로 줄인다.
  - 상세 시트와 상세 페이지의 카드 안의 카드를 제거한다.
  - 상세 페이지에 위치를 보여 주는 작은 지도를 추가한다. "메모"에 그대로 노출되는 `출처/수집일/전화` 원본 문자열은 각각 정리된 항목으로 보여 준다(import 정규화 또는 mapper에서 분리).
- Verify: `npm run verify && npm run test:e2e:full && npm run design:detect && npm run readme:screenshots`
- Done: 화면 색상과 `.impeccable.md` 토큰이 같고, 상세 페이지에 지도·출처·전화가 각각 따로 보이며, README 스크린샷이 갱신된다.

#### 3-7. 문서 단일화와 ADR 작성
- Likely files: `docs/문서-안내.md`, `docs/adr/*.md`(신규), `README.md`, `docs/product/*`
- Changes:
  - PRD/TRD는 `docs/product`만 남기고 `docs/01-기준` 중복을 제거한다. 운영 문서는 `docs/09-운영-가이드`로 합치고 `docs/ops`를 제거한다.
  - `docs/audits/*`, `docs/blog/*` 초안, `docs/resume/*`, `docs/08-면접-복기/*`는 저장소 밖(개인 비공개 저장소)으로 옮긴다. 삭제 전 사용자 확인을 받고, Git history 잔존 여부는 사용자에게 알린다.
  - ADR 5개: DB 세션 vs 서명 쿠키, rate limit 저장소(Postgres vs KV/Durable Object), advisory lock vs row lock, 요청당 연결·Hyperdrive, offset vs cursor pagination.
  - README에 백엔드 관점 요약(아키텍처 그림, 핵심 트레이드오프 3개, integration 실행법)을 넣고 수치·테스트 개수를 실제 값으로 맞춘다.
- Verify: `npm run verify && git diff --check`
- Done: `docs/` md 파일 수 30개 이하, README의 모든 링크가 존재하는 파일을 가리킨다.

## Backlog

- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
