# 알뜰맵 (Altteulmap)

> A map-first service for finding, contributing, and moderating affordable local places in Korea.

![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)
![Status](https://img.shields.io/badge/Status-Live-success)

- Demo: [altteulmap.altteul-lab.workers.dev](https://altteulmap.altteul-lab.workers.dev)
- Admin: [altteulmap.altteul-lab.workers.dev/admin](https://altteulmap.altteul-lab.workers.dev/admin)
- Docs: [한국어 문서 안내](docs/문서-안내.md) · [Cloudflare deploy guide](docs/deploy/deploy-cloudflare.md)

최근 유행했던 `거지맵` 서비스에서 아이디어를 얻었습니다. 다만 음식점에만 머무르지 않고, 생활 서비스까지 포함한 더 넓은 절약 지도 형태로 확장하고 싶었습니다. 여기에 공공데이터를 적극적으로 활용해 실제 운영 가능한 데이터 기반 서비스를 만들고 싶었고, 고물가와 취업난이 겹친 지금의 시대감에도 잘 맞는 주제라고 판단해 개발했습니다.

![Altteulmap home](docs/readme/hero-home.png)

## At a Glance

- 실제 공공 데이터 1,000건을 정제해 지도 탐색 경험에 투입했습니다.
- 장소 등록, 가격 제보, 신고는 공개 참여로 받고 관리자 화면에서 검수 제안 데이터가 있으면 참고하되, 최종 확정은 운영자가 합니다. 현재 저장소에는 외부 AI provider가 제안을 생성하는 pipeline은 없습니다.
- 공개 앱, 관리자 화면, API를 단일 Cloudflare Worker로 통합해 운영 표면적을 줄였습니다.
- Playwright E2E, smoke, live deploy check까지 포함해 “보여주는 데모”보다 “운영 가능한 MVP”에 가깝게 만들었습니다.

## Highlights

- `Map-first UX`: 첫 화면이 바로 지도이고 목록과 상세 시트가 같은 맥락에서 이어집니다.
- `Real data import`: 행정안전부 `착한가격업소` 데이터를 직접 수집·정규화·적재했습니다.
- `Open contribution loop`: 익명 제보를 허용하되 actor/rate limit/Turnstile과 관리자 승인으로 데이터 반영 경계를 둡니다. moderation suggestion은 운영자 보조 계약이며 자동 승인 기능이 아닙니다.
- `Unified Worker`: public/admin/API를 하나의 Vite React SPA와 Worker API로 통합했습니다.
- `Verified delivery`: lint, build, Playwright E2E, local/remote smoke, live Cloudflare deploy까지 닫았습니다.

## Screenshots

| Home | Detail Sheet |
| --- | --- |
| ![Home](docs/readme/hero-home.png) | ![Detail Sheet](docs/readme/place-detail.png) |

| Mobile | Submission |
| --- | --- |
| ![Mobile Map Sheet](docs/readme/mobile-map-sheet.png) | ![Submission Form](docs/readme/submit-form.png) |

| Admin |
| --- |
| ![Admin Console](docs/readme/admin-console.png) |

## How It Works

1. 지도에서 현재 위치와 검색어 기준으로 저렴한 장소를 찾습니다.
2. 상세 시트에서 가격, 반응, 공유, 북마크를 확인합니다.
3. 비회원도 장소 등록, 댓글, 가격 제보, 신고를 남길 수 있습니다.
4. 장소 등록, 가격 제보, 신고는 관리자 앱에서 검수 제안 패널과 함께 확인할 수 있고 운영자가 최종 확정합니다. 제안 생성 provider 연결은 현재 미완료입니다.

## Why This Repo Is Worth Opening

- `서비스 관점`: 탐색, 참여, 관리자 검수, 운영 반영까지의 핵심 cycle이 닫혀 있습니다. moderation suggestion은 저장 schema와 표시/검증 경계까지이며 외부 AI 자동 생성은 별도 backlog입니다.
- `엔지니어링 관점`: Next/OpenNext에서 Vite + Worker API로 이관하며 번들 경량화, runtime smoke, production cutover를 직접 정리했습니다.
- `데이터 관점`: mock이 아니라 실데이터 import와 운영용 moderation 흐름이 같이 있습니다.
- `작업 방식 관점`: AI를 구현 보조로만 쓰지 않고 계획, 검증, 문서화, 운영 검수 초안까지 연결했습니다.

## AI-Native Workflow

- 루트 `PLAN.md` 하나에 현재와 미래의 실행 작업만 유지하고, 완료된 작업은 즉시 제거합니다.
- 관리자 큐는 moderation suggestion이 존재할 경우 권장 액션과 근거를 표시합니다. 현재 코드에서 provider가 새 suggestion을 생성하는 실행 경로는 확인되지 않습니다.
- 구현 후에는 `lint`, `build`, `Playwright E2E`, `smoke`를 기준으로 종료했습니다.
- repo-local hooks와 검증 스크립트로 품질 기준을 저장소 안에 고정했습니다.

## Current Status

- `Live data`: Supabase PostgreSQL 운영 DB에 migration과 초기 seed를 적용했고, public/admin worker가 DB source로 동작합니다.
- `Moderation boundary`: 관리자 큐는 moderation_suggestions의 구조화된 제안을 Zod로 검증해 표시하지만, 외부 AI 자동 생성·비용·재시도 pipeline은 아직 없습니다.
- `Operational QA`: iPhone Safari와 Android Chrome 실기기 QA에서 blocker 없이 통과했습니다.
- `Launch URL`: 현재 운영 URL은 `https://altteulmap.altteul-lab.workers.dev`이며, admin은 같은 Worker의 `/admin` route로 통합했습니다. custom domain은 별도 후속 작업입니다.
- `Share checklist`: 공개 공유 전 점검 항목은 [public share checklist](docs/project/public-share-checklist.md)에 정리했습니다.

## Verification

```bash
npm run verify
npm run test:e2e
npm run smoke:local
npm run smoke:remote
```

- GitHub Actions: `Verify`, `E2E Full`, `Deploy Config Check`
- Cloudflare: unified Vite Worker deploy + live `workers.dev` smoke

## Stack

- Vite 8, React 19, Tailwind CSS 4
- Cloudflare Workers, Hono, Wrangler
- PostgreSQL, Drizzle ORM
- NAVER Maps JavaScript API
- Worker credentials + Kakao/Naver OAuth callback
- Playwright, ESLint

## Run Locally

```bash
npm run db:local:setup
npm run dev
```

- `db:local:setup`은 Docker PostgreSQL을 기동하고 readiness 확인, Drizzle migration, local seed를 순서대로 실행합니다.
- 앱 기본 DB는 `postgresql://postgres:postgres@127.0.0.1:5432/altteulmap`입니다. PostgreSQL 없이 UI만 확인하려면 `USE_MOCK_DATA=true npm run dev`를 사용합니다.
- 실제 DB E2E는 `npm run test:e2e:all`, DB 독립적인 접근성·모바일 E2E는 `npm run test:e2e:mock`으로 실행합니다. 두 모드를 섞어 실행하지 않습니다.
- 데이터베이스를 중지하려면 `npm run db:local:down`을 사용합니다. volume까지 삭제하는 초기화는 `CONFIRM_RESET=1 npm run db:local:reset`이 필요합니다.
- App: `http://localhost:5173`
- Admin: `http://localhost:5173/admin`
- README screenshots: `npm run readme:screenshots`

## Next

- custom domain 연결 여부 결정
- OAuth 실제 provider callback 운영 등록
- 이메일 발송이 필요해지는 시점에 Resend 설정 마감
