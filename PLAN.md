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

#### 3-7. 개인 구직·감사 문서를 저장소 밖으로 이동 (사용자 결정 대기)
- Done in 이전 작업: ADR 5개(`docs/adr`), README 백엔드 설계 요약, 운영 런북 병합(`docs/ops` 삭제).
- Current blocker: 아래 문서는 삭제·이동이 되돌리기 어렵고 Git history에는 남으므로 사용자가 이동 여부와 history 재작성 여부를 먼저 정해야 한다. 대상: `docs/resume/*`, `docs/08-면접-복기/*`, `docs/audits/*`, `docs/blog/*`(시리즈 초안), `docs/migration-next-to-vite-react.md`.
- Next action: 사용자가 대상을 확정하면 개인 비공개 저장소로 복사한 뒤 `git rm`하고 `docs/문서-안내.md`의 링크와 README 링크를 정리한다(링크 검사: `grep -rn "docs/resume\|08-면접" README.md docs`).
- Verify: `npm run verify && git diff --check`, README·문서-안내의 모든 상대 링크가 존재하는 파일을 가리키는지 확인.
- Done: 공개 저장소에 구직 개인 자료와 날짜별 자기 감사 문서가 없고, 남은 문서는 기준 문서·설계·운영·ADR 중심이다.

## Backlog

- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
- Hyperdrive 도입 여부를 connection latency·동시 연결 지표로 재평가
