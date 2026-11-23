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

### Phase 1. 데모 복구와 인증·남용 방지 결함 제거

#### 1-0. 운영 DB 이전 마무리 (사용자 입력 필요)
- Done: VPS 전용 Postgres(TLS)·cloudflared·백업 cron, Tunnel → Workers VPC → Hyperdrive 연결, `wrangler.jsonc` binding과 배포. 운영 `/api/health?deep=1`의 `database`가 `ok`(hyperdrive, 14ms)이고 지도 API가 운영 데이터를 반환한다. seed 계정의 알려진 비밀번호는 제거했다.
- Current blocker: `TURNSTILE_SITE_KEY`를 Worker에 넣지 못해 `public-config` 체크가 실패하고(공개 쓰기 불가) deep health가 503이다. 값은 Cloudflare 대시보드 Turnstile 위젯에 있고 공개 키다(코드가 읽는 새 이름 `TURNSTILE_SITE_KEY`, 이전 이름 `NEXT_PUBLIC_TURNSTILE_SITE_KEY`는 읽지 않는다).
- Next action:
  1. `printf '%s' '<site key>' | npx wrangler secret put TURNSTILE_SITE_KEY`
  2. GitHub secret 등록(비밀번호가 들어가므로 직접): `gh secret set SMOKE_PUBLIC_URL`(`https://altteulmap.altteul-lab.workers.dev`), `SMOKE_ADMIN_EMAIL`(`admin@altteulmap.local`), `SMOKE_ADMIN_PASSWORD`(`~/.config/altteulmap/vps.env`의 `ADMIN_PASSWORD`).
  3. 정리: Worker의 옛 secret 삭제(`DATABASE_URL` Supabase, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, 필요 시 `AUTH_DEMO_PASSWORD`·`AUTH_ADMIN_PASSWORD`), 로컬 `.env.production.local`의 Supabase `DATABASE_URL` 제거, Supabase 프로젝트 종료.
  4. `gh workflow run keep-alive.yml && gh workflow run ci.yml`로 확인.
  5. 한국 사용자 기준 지연이 목표(p95 1초)를 못 맞추면 공개 GET 엣지 캐시를 추가하거나 가까운 리전 Postgres로 Hyperdrive 대상을 교체한다(`deploy/vps/README.md` §5).
- Verify: `SMOKE_PUBLIC_URL=... SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... npm run smoke:remote`
- Done: deep health가 `ok`, `Keep Alive`와 CI의 `Remote Smoke`가 성공한다.

## Backlog

- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
