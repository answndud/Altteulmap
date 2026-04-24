# Cloudflare 배포 가이드

기준일: 2026-04-21

## 목적
- Cloudflare 계정 준비, Workers Builds 설정, 운영 배포, 수동 fallback 배포까지 한 문서에서 끝나게 정리한다.
- 현재 저장소의 실제 운영 기준을 문서 하나로 고정한다.
- 배포 전에 `npm run deploy:check*`와 smoke 명령으로 위험한 설정 누락을 먼저 잡는다.

## 현재 운영 기준
- 현재 운영 URL은 custom domain이 아니라 `workers.dev` split이다.
- public: `https://altteulmap.altteul-lab.workers.dev`
- admin: `https://altteulmap-admin.altteul-lab.workers.dev`
- `NEXTAUTH_URL`, `SITE_URL`, `ADMIN_APP_URL`, canonical, robots, sitemap, admin redirect는 위 두 주소를 기준으로 유지한다.
- 평소 배포는 GitHub `main` push 뒤 Cloudflare Workers Builds가 맡는다.
- GitHub Actions는 `pull_request`와 `workflow_dispatch`에서만 CI를 수행한다.
- 로컬 터미널 배포(`deploy`, `deploy:public`, `deploy:admin`)는 fallback 경로다.
- custom domain은 DNS, callback, canonical을 다시 묶어 처리할 별도 후속 작업이다.

## 빠른 요약
1. 처음 한 번만 Cloudflare 계정, Wrangler 로그인, Workers Builds, 대시보드 변수/시크릿, OAuth callback을 맞춘다.
2. 평소에는 `main`에 push만 하면 Cloudflare가 public/admin worker를 자동 배포한다.
3. 성공/실패는 GitHub `Checks`에서 빠르게 보고, 실패 원인은 Cloudflare Dashboard `Builds`에서 확인한다.
4. Workers Builds가 깨졌거나 긴급 재배포가 필요할 때만 로컬에서 `npm run deploy:*`를 쓴다.

## 1. 이 저장소 기준 전제
- Cloudflare 배포 설정은 이미 저장소에 들어 있다.
  - [wrangler.jsonc](/Users/alex/project/altteulmap/wrangler.jsonc)
  - [wrangler.admin.jsonc](/Users/alex/project/altteulmap/wrangler.admin.jsonc)
  - [open-next.config.ts](/Users/alex/project/altteulmap/open-next.config.ts)
  - [package.json](/Users/alex/project/altteulmap/package.json)
- 현재 앱은 Cloudflare D1이 아니라 외부 PostgreSQL `DATABASE_URL`을 쓴다.
- 현재 앱은 Hyperdrive binding을 쓰지 않는다.
- Cloudflare account ID는 `wrangler*.jsonc`에 직접 넣어 두었으므로 GitHub variable로 별도 관리하지 않는다.
- public/admin은 split 배포지만, 설치와 shared 코드는 repo root lockfile 기준으로 동작한다.

## 2. 처음 한 번만 하는 준비

### 2-1. Cloudflare 계정 만들기
1. [Create account](https://developers.cloudflare.com/fundamentals/account/create-account/) 또는 [Sign up](https://dash.cloudflare.com/sign-up)으로 계정을 만든다.
2. 이메일 인증을 끝낸다.
3. Cloudflare Dashboard에 로그인한다.

실무 메모:
- 가능하면 이메일/비밀번호 방식 계정을 쓰는 편이 낫다.
- 실제 서비스용이면 개인 메일보다 운영용 alias를 쓰는 편이 안전하다.

### 2-2. `workers.dev` 개념 확인
- Cloudflare 계정마다 고유한 `workers.dev` 서브도메인을 쓸 수 있다.
- 형식은 보통 `<worker-name>.<account-subdomain>.workers.dev`다.
- 알뜰맵의 현재 운영 기준은 아래 두 주소다.
  - public: `https://altteulmap.altteul-lab.workers.dev`
  - admin: `https://altteulmap-admin.altteul-lab.workers.dev`
- 관련 문서: [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

### 2-3. Wrangler 로그인
프로젝트 루트에서 실행:

```bash
npx wrangler login
```

메모:
- 로컬 브라우저가 열리면 Cloudflare 계정으로 로그인해 권한을 허용한다.
- 현재 운영 기본값은 Workers Builds지만, 로컬 수동 배포와 `wrangler tail`을 위해 로그인은 해두는 편이 낫다.
- 관련 문서: [Wrangler login](https://developers.cloudflare.com/workers/wrangler/commands/general/)

### 2-4. Workers Builds 연결
Cloudflare Dashboard에서 public/admin worker를 각각 Git 연결된 Workers Builds로 구성한다.

현재 저장소 기준 권장값:

`altteulmap`
- Root directory: `/`
- Install command: `npm ci`
- Build command: `npm run cf:build:public`
- Deploy command: `npx opennextjs-cloudflare deploy -c wrangler.jsonc`

`altteulmap-admin`
- Root directory: `/`
- Install command: `npm ci`
- Build command: `npm run cf:build:admin`
- Deploy command: `npx opennextjs-cloudflare deploy -c wrangler.admin.jsonc`

중요:
- `altteulmap-admin`의 Root directory를 `apps/admin`으로 두면 안 된다.
- 현재 저장소는 루트 `package-lock.json`과 shared 코드 기준으로 설치되므로, `apps/admin`을 root로 두면 Cloudflare 기본 `npm ci` 단계가 깨진다.
- build watch paths를 별도로 줄 수는 있지만 shared 의존 범위가 넓다. 처음에는 비워 두거나 넓게 잡는 편이 안전하다.

## 3. 환경 변수와 시크릿

### 3-1. 로컬 build 변수와 Cloudflare runtime 변수의 차이
- 로컬 수동 배포 시에는 내 컴퓨터의 shell env와 `.env*`가 build 입력값이 된다.
- Cloudflare Workers Builds와 실제 런타임은 Dashboard의 변수/시크릿이 source of truth다.
- 이 저장소의 배포 스크립트는 쉘에서 주입한 env를 로컬 `.env*`보다 우선 사용한다.

### 3-2. 필수값
- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `ADMIN_APP_URL`
- `SITE_URL`
- `NEXT_PUBLIC_NAVER_MAP_KEY_ID`
- `AUTH_KAKAO_CLIENT_ID`
- `AUTH_KAKAO_CLIENT_SECRET`
- `AUTH_NAVER_CLIENT_ID`
- `AUTH_NAVER_CLIENT_SECRET`

설명:
- `ADMIN_APP_URL`은 public worker가 외부 admin 앱으로 `/admin`, `/api/admin`을 넘길 때 필요하다.
- `SITE_URL`은 admin worker의 홈 복귀 링크와 public 기준 URL에 필요하다.
- `CLOUDFLARE_API_TOKEN`은 Workers Builds 자동 배포에는 필요 없고, 로컬 `wrangler` 수동 deploy에만 필요하다.

### 3-3. 권장 추가값
- `AUTH_DEMO_PASSWORD`
- `AUTH_ADMIN_PASSWORD`
- `EMAIL_FROM`
- `RESEND_API_KEY`

### 3-4. 무엇을 시크릿으로 둘지
시크릿으로 관리:
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_KAKAO_CLIENT_SECRET`
- `AUTH_NAVER_CLIENT_SECRET`
- `RESEND_API_KEY`

대시보드 변수로 관리해도 되는 값:
- `NEXT_PUBLIC_NAVER_MAP_KEY_ID`
- `AUTH_KAKAO_CLIENT_ID`
- `AUTH_NAVER_CLIENT_ID`
- `SITE_URL`
- `NEXTAUTH_URL`
- `ADMIN_APP_URL`

## 4. OAuth와 외부 콘솔 설정

### 4-1. OAuth callback URL
- 카카오: `<NEXTAUTH_URL>/api/auth/callback/kakao`
- 네이버: `<NEXTAUTH_URL>/api/auth/callback/naver`

예시:

```text
https://altteulmap.altteul-lab.workers.dev/api/auth/callback/kakao
https://altteulmap.altteul-lab.workers.dev/api/auth/callback/naver
```

### 4-2. 네이버 지도 허용 도메인
- `NEXT_PUBLIC_NAVER_MAP_KEY_ID`만 맞다고 끝나지 않는다.
- NAVER Cloud Platform 지도 애플리케이션의 웹 서비스 URL 또는 허용 도메인에 실제 배포 주소도 등록해야 한다.
- 현재 운영 기준이면 public/admin `workers.dev` 주소를 모두 확인한다.

## 5. 배포 전 점검
권장 순서:

```bash
npm run verify
npm run db:check:production
npm run smoke:local
npm run deploy:check
```

운영 URL 기준 read-only smoke:

```bash
SMOKE_PUBLIC_URL=https://altteulmap.<subdomain>.workers.dev \
SMOKE_ADMIN_URL=https://altteulmap-admin.<subdomain>.workers.dev \
npm run smoke:remote
```

추가 메모:
- `db:check:production`은 실제 `DATABASE_URL` 연결, moderation schema, drizzle migration table 유무를 확인한다.
- `npm run deploy:check -- --preview`를 쓰면 preview 기준 URL 허용 상태만 빠르게 볼 수 있다.
- manual split deploy를 돌릴 예정이면 `npm run deploy:check:public`, `npm run deploy:check:admin`까지 같이 본다.

## 5-1. 운영 DB 초기 bootstrap seed
운영 DB가 완전히 비어 있는 최초 1회에만 아래 명령으로 초기 카테고리, 운영자/데모 계정, 착한가격업소 기반 장소/가격 데이터를 적재한다.

```bash
npm run db:seed:production
```

주의:
- `db:seed:production`은 production `DATABASE_URL`을 사용하되, 주요 앱 테이블이 모두 비어 있을 때만 기존 seed를 실행한다.
- 하나라도 데이터가 있으면 destructive seed를 거부한다.
- 일반 `npm run db:seed`는 기존 데이터를 삭제하고 다시 채우는 개발용 명령이므로 운영 DB에 직접 사용하지 않는다.
- 운영 데이터가 생긴 뒤 추가 데이터가 필요하면 별도 upsert/import 스크립트를 만들어야 한다.

## 6. 평소 운영 배포

### 6-1. 실제 배포 흐름
1. 로컬 작업을 마치고 `main`에 반영한다.
2. Cloudflare Workers Builds가 public/admin worker를 자동 배포한다.
3. 필요하면 live URL smoke만 다시 확인한다.

즉 평소에는:
- GitHub에 `main` push만 하면 된다.
- 터미널에서 매번 `npm run deploy:public`, `npm run deploy:admin`을 칠 필요는 없다.
- GitHub Actions는 배포를 수행하지 않는다.

### 6-2. GitHub Actions가 하는 일
- `pull_request`: `Verify`, `E2E Full`
- `workflow_dispatch`: `Verify`, `E2E Full`
- `main` push: 아무 것도 하지 않음

따라서 `main` push 뒤 GitHub Actions 탭에 새 run이 안 보여도 정상이다.

### 6-3. 성공/실패 확인 위치
빠른 상태 확인:
- GitHub 커밋 또는 PR의 `Checks`
- `Workers Builds: altteulmap`
- `Workers Builds: altteulmap-admin`

상세 로그 확인:
- Cloudflare Dashboard
- `Workers & Pages` -> 서비스 선택 -> `Builds`

정리:
- GitHub `Checks`: 성공, 실패, 진행중 상태 확인
- Cloudflare `Builds`: 실패 원인과 상세 로그 확인

## 7. 수동 fallback 배포

### 7-1. 언제 쓰나
- Cloudflare Workers Builds가 실패했을 때
- 긴급 재배포가 필요할 때
- public/admin 중 하나만 선택적으로 다시 배포하고 싶을 때

### 7-2. 사용 명령
```bash
npm run deploy
npm run deploy:check:public
npm run deploy:public
npm run deploy:check:admin
npm run deploy:admin
```

역할:
- `deploy`: 현재 앱 전체 배포
- `deploy:public`: public 앱만 external admin stub 모드로 배포
- `deploy:admin`: `apps/admin` 별도 관리자 앱 배포

### 7-3. split 배포 권장 순서
1. `npm run deploy:check:admin`
2. `npm run deploy:admin`
3. admin worker에 `NEXTAUTH_URL=https://altteulmap-admin.<subdomain>.workers.dev`, `SITE_URL=https://altteulmap.<subdomain>.workers.dev` 확인
4. `npm run deploy:check:public`
5. public worker에 `ADMIN_APP_URL=https://altteulmap-admin.<subdomain>.workers.dev` 확인
6. `npm run deploy:public`

메모:
- `deploy:public`은 `ADMIN_APP_URL` 없이 실행하면 실패한다.
- `deploy:admin`에서 `SITE_URL`이 빠지면 관리자 헤더의 홈 링크가 admin 앱 자신을 가리킬 수 있다.
- 수동 deploy에서는 `CLOUDFLARE_API_TOKEN`과 Wrangler 로그인 상태를 같이 확인한다.

## 8. 처음 `workers.dev` 배포를 수동으로 찍어볼 때
기본 운영은 Workers Builds지만, 첫 연결 확인이나 fallback 연습용으로 로컬 deploy를 해볼 수 있다.

기본 앱 전체:

```bash
npm run deploy
```

public/admin split:

```bash
npm run deploy:admin
npm run deploy:public
```

첫 배포 후 확인:
- `/`
- `/login`
- `/robots.txt`
- `/sitemap.xml`
- public `/admin` redirect
- public `/api/admin/places` 안내 JSON
- admin `/login`

실시간 로그:

```bash
npx wrangler tail
```

관련 문서: [Workers real-time logs](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)

## 9. custom domain은 나중에
- 현재 출시 범위에는 포함하지 않는다.
- DNS 제어권, OAuth callback, canonical, sitemap, robots를 같이 다시 맞출 수 있을 때만 진행한다.
- 관련 문서: [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

custom domain으로 전환하면 같이 바꿀 것:
- `NEXTAUTH_URL`
- `SITE_URL`
- `ADMIN_APP_URL`
- 카카오 callback URL
- 네이버 callback URL
- NAVER Maps 허용 도메인
- canonical과 sitemap 확인

## 10. 자주 막히는 포인트
- `NEXTAUTH_URL`이 `localhost`로 남아 있으면 OAuth callback, canonical, sitemap이 함께 꼬인다.
- 로컬 build 변수와 Cloudflare runtime 변수를 혼동하면 로그인이나 지도만 부분적으로 깨질 수 있다.
- `NEXT_PUBLIC_NAVER_MAP_KEY_ID`를 runtime에만 넣고 build 입력에는 안 넣으면 클라이언트 번들이 비어 있을 수 있다.
- `altteulmap-admin` Root directory를 `apps/admin`으로 두면 `npm ci`가 실패한다.
- 카카오/네이버 callback URL이 실제 도메인과 다르면 로그인만 실패하는 상태가 생긴다.
- DB 문자열은 맞는데 Cloudflare에서 외부 DB 접속이 막히면 DB 방화벽, SSL, Supabase 연결 정책을 같이 확인해야 한다.
- custom domain 전환 후에는 domain binding만 보지 말고 `NEXTAUTH_URL`, callback URL, canonical까지 같이 다시 확인해야 한다.

## 참고 공식 문서
- [Cloudflare account creation](https://developers.cloudflare.com/fundamentals/account/create-account/)
- [Cloudflare login](https://developers.cloudflare.com/fundamentals/user-profiles/login/)
- [Install/Update Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Wrangler login command](https://developers.cloudflare.com/workers/wrangler/commands/general/)
- [Cloudflare Workers Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext get started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext env vars](https://opennext.js.org/cloudflare/howtos/env-vars)
- [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers real-time logs](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)
