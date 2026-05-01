# Cloudflare 배포 가이드

기준일: 2026-05-01

## 현재 운영 기준
- 운영 URL: `https://altteulmap.altteul-lab.workers.dev`
- 관리자 URL: `https://altteulmap.altteul-lab.workers.dev/admin`
- 구조: Vite React SPA + Hono/Cloudflare Worker API 단일 Worker
- 운영 DB: Supabase PostgreSQL
- 배포 방식: 로컬 또는 CI에서 Vite 산출물을 만든 뒤 `dist/altteulmap/wrangler.json`으로 Worker 배포
- `altteulmap-admin` 별도 Worker는 legacy 링크 처리용 redirect 후보이며, 실제 admin 기능은 통합 Worker의 `/admin`이 담당한다.

## 필수 Secret/Var
Cloudflare Worker `altteulmap`에는 최소한 아래 binding이 있어야 한다.

```text
DATABASE_URL
AUTH_SECRET
NEXTAUTH_URL
SITE_URL
AUTH_DEMO_PASSWORD
AUTH_ADMIN_PASSWORD
AUTH_KAKAO_CLIENT_ID
AUTH_KAKAO_CLIENT_SECRET
AUTH_NAVER_CLIENT_ID
AUTH_NAVER_CLIENT_SECRET
NEXT_PUBLIC_NAVER_MAP_KEY_ID
USE_MOCK_DATA=false
```

운영 URL 기준:

```text
NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev
SITE_URL=https://altteulmap.altteul-lab.workers.dev
```

OAuth callback:

```text
https://altteulmap.altteul-lab.workers.dev/api/auth/callback/kakao
https://altteulmap.altteul-lab.workers.dev/api/auth/callback/naver
```

## 배포 전 검증
```bash
npm run typecheck
npm run lint
npm run build
npm run deploy:check
npm run deploy:check:vite
npm run smoke:vite:local
git diff --check
```

`npm run build`는 아래 산출물을 만든다.

```text
dist/altteulmap/wrangler.json
dist/altteulmap/index.mjs
dist/client/index.html
dist/client/assets/*
```

## 배포
Cloudflare Dashboard Builds 저장 폼이 불안정할 수 있으므로, 현재 기준 운영 배포는 Wrangler 직접 배포를 기본 경로로 둔다.

```bash
npm run deploy
```

실행되는 핵심 명령:

```bash
npm run build
wrangler deploy --config dist/altteulmap/wrangler.json
```

## 배포 후 Smoke
```bash
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote
```

수동 확인:
- `/`
- `/admin`
- `/api/health`
- `/api/categories`
- `/api/places/map?scope=global`
- `/api/auth/providers`
- `/api/admin/places` 비로그인 `401`
- `/robots.txt`
- `/sitemap.xml`
- `/manifest.webmanifest`

## Rollback
문제가 생기면 GitHub에서 직전 정상 커밋으로 되돌린 뒤 다시 배포한다.

```bash
git revert <bad-commit>
npm run deploy
```

이전 Next/OpenNext split 구조는 Phase 7 cleanup 이후 코드에서 제거되므로, rollback 기준은 Git 이력이다.
