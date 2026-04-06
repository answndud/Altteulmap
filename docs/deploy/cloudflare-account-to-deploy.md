# Cloudflare 계정 생성부터 첫 배포까지

기준일: 2026-04-01

## 이 문서의 목적
- Cloudflare 계정이 아직 없는 상태에서 시작해 알뜰맵을 첫 배포하는 전체 순서를 한 번에 정리한다.
- 현재 저장소 기준 배포 방식인 `Next.js + OpenNext + Cloudflare Workers + Wrangler` 흐름을 기준으로 설명한다.
- 첫 배포는 `workers.dev` 주소로, 그 다음은 커스텀 도메인으로 전환하는 순서를 권장한다.

## 이 저장소 기준 전제
- 현재 저장소는 이미 Cloudflare Workers 배포 설정이 들어 있다.
  - `/Users/alex/project/altteulmap/wrangler.jsonc`
  - `/Users/alex/project/altteulmap/open-next.config.ts`
  - `/Users/alex/project/altteulmap/package.json`
- 배포 명령은 이미 준비되어 있다.
  - `npm run preview`
  - `npm run deploy`
  - 필요 시 `npm run deploy:public`, `npm run deploy:admin`
- 현재 앱은 Cloudflare D1이 아니라 외부 PostgreSQL 연결 문자열 `DATABASE_URL`을 사용한다.
- 현재 앱은 Hyperdrive binding을 쓰지 않는다.
  - 첫 배포는 `DATABASE_URL` 직접 연결로 진행하고, Hyperdrive는 나중에 별도 작업으로 붙이는 편이 안전하다.

## 권장 배포 전략
1. Cloudflare 계정 생성
2. Wrangler 로그인
3. 로컬에서 배포 전 검증
4. `workers.dev`로 첫 배포
5. Cloudflare 대시보드에 런타임 변수/시크릿 등록
6. 카카오/네이버 OAuth callback을 실제 배포 URL로 수정
7. 재배포
8. 커스텀 도메인 연결
9. `NEXTAUTH_URL`과 OAuth callback을 커스텀 도메인 기준으로 다시 수정 후 최종 배포

## 1. Cloudflare 계정 만들기
1. Cloudflare 회원가입 페이지로 이동한다.
   - [Create account](https://developers.cloudflare.com/fundamentals/account/create-account/)
   - [Sign up](https://dash.cloudflare.com/sign-up)
2. 이메일과 비밀번호로 계정을 만든다.
3. 이메일 인증 메일을 열어 계정을 활성화한다.
4. 대시보드에 로그인한다.
   - [Log in to Cloudflare](https://developers.cloudflare.com/fundamentals/user-profiles/login/)

### 실무 권장
- 가능하면 Cloudflare 계정은 이메일/비밀번호 방식으로 만든다.
- 소셜 로그인으로 계정을 만들어도 되지만, Cloudflare 문서 기준으로 일부 작업은 비밀번호가 필요한 경우가 있다.
- 개인 계정이 아니라 실제 서비스용이면 공용 메일 alias를 쓰는 편이 낫다.

## 2. Cloudflare에서 꼭 알아둘 개념

### `workers.dev`
- Cloudflare 계정마다 고유한 `workers.dev` 서브도메인을 쓸 수 있다.
- 첫 배포를 빨리 확인하기에 가장 쉽다.
- 형식은 보통 아래와 같다.
  - `<worker-name>.<account-subdomain>.workers.dev`
- Cloudflare 문서 기준으로 `workers.dev`는 빠른 시작용이고, 운영 서비스는 커스텀 도메인이 더 권장된다.
  - [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

### Custom Domain
- 실제 운영은 `app.example.com` 같은 커스텀 도메인 연결을 권장한다.
- Custom Domain을 쓰려면 해당 도메인이 Cloudflare zone으로 활성화되어 있어야 한다.
- Cloudflare 문서 기준으로 Custom Domain은 Worker가 origin인 경우 권장된다.
  - [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## 3. 로컬 환경 준비

### 필수 준비물
- Node.js
- npm
- git
- 이 저장소 로컬 사본

Wrangler는 이 저장소에 이미 devDependency로 들어 있다. 필요하면 버전만 확인하면 된다.

```bash
npx wrangler --version
```

Wrangler 설치/업데이트 공식 문서:
- [Install/Update Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## 4. Cloudflare에 Wrangler 로그인

프로젝트 루트에서 실행:

```bash
npx wrangler login
```

로그인 흐름:
1. 브라우저가 열리면 Cloudflare 계정으로 로그인
2. Wrangler 권한 요청 화면에서 허용
3. 터미널로 돌아와 인증 완료 확인

참고:
- `wrangler login`은 OAuth 방식이다.
- 원격 서버나 컨테이너에서 실행하면 callback 포트 이슈가 있을 수 있다.
- 로컬 맥북/PC에서 실행하는 지금 상황에서는 기본값 그대로 쓰면 된다.

공식 문서:
- [Wrangler general commands / login](https://developers.cloudflare.com/workers/wrangler/commands/general/)

## 5. 이 저장소에서 배포 전에 확인할 것

현재 저장소는 `npm run deploy` 시 로컬에서 OpenNext build를 만든 뒤 Cloudflare로 업로드한다.

현재 배포 경로는 Cloudflare Workers Free 한도 기준으로 `next build --webpack`과 clean build를 전제로 맞춰져 있다.
- `npm run deploy`는 내부적으로 `cf:clean -> opennextjs-cloudflare build -> opennextjs-cloudflare deploy` 순서로 실행된다.
- 직접 배포할 때는 `.next`, `.open-next`를 남긴 채 재사용하지 않는 것이 안전하다.

즉 환경 변수는 두 군데가 모두 중요하다.

### A. 로컬 빌드 환경 변수
- `npm run deploy`를 실행하는 내 컴퓨터에 있어야 한다.
- `NEXT_PUBLIC_...` 값은 이 단계에서 클라이언트 번들에 반영된다.
- 가장 쉬운 방법은 로컬 전용 파일을 쓰는 것이다.
  - `.env.local`
  - 또는 배포용으로만 `.env.production.local`

### B. Cloudflare 런타임 변수/시크릿
- 배포된 Worker가 실제 요청을 처리할 때 필요하다.
- Cloudflare 대시보드의 Worker 설정에서 넣는다.
- OpenNext 문서도 production runtime 변수는 대시보드에서 관리하는 방식을 권장한다.

중요:
- 이 내용은 OpenNext 문서와 현재 저장소의 배포 방식을 합친 운영 가이드다.
- 현재 저장소는 `Workers Builds`가 아니라 `로컬 build -> wrangler deploy` 흐름이므로, 로컬 build 변수와 Cloudflare runtime 변수 둘 다 챙겨야 한다.
- 현재 배포/점검 스크립트는 쉘이나 CI에서 주입한 env를 로컬 `.env*`보다 우선 사용한다. 즉 워크플로우가 넘긴 운영 `NEXTAUTH_URL`, `ADMIN_APP_URL`, `SITE_URL`이 개발용 파일 값으로 다시 덮이지 않는다.

공식 문서:
- [OpenNext env vars guide](https://opennext.js.org/cloudflare/howtos/env-vars)
- [Wrangler environment variables](https://developers.cloudflare.com/workers/wrangler/configuration/)

### Workers Builds를 같이 쓸 때
- public/admin worker 모두 Cloudflare Dashboard의 Root directory는 repo root(`/`)를 권장한다.
- 이유는 현재 저장소가 루트 `package-lock.json`을 기준으로 의존성을 설치하기 때문이다.
- 특히 `altteulmap-admin`의 Root directory를 `apps/admin`으로 두면 Cloudflare 기본 설치 단계(`npm ci`)가 `apps/admin/package-lock.json`을 찾다가 실패한다.

권장 값:

```text
altteulmap
- Root directory: /
- Install command: npm ci
- Build command: npm run cf:build:public
- Deploy command: npx opennextjs-cloudflare deploy -c wrangler.jsonc

altteulmap-admin
- Root directory: /
- Install command: npm ci
- Build command: npm run cf:build:admin
- Deploy command: npx opennextjs-cloudflare deploy -c wrangler.admin.jsonc
```

## 6. 첫 배포 전에 준비할 환경 변수

이 저장소 기준 필수값:

```env
DATABASE_URL=
AUTH_SECRET=
SITE_URL=
NEXTAUTH_URL=
ADMIN_APP_URL=
NEXT_PUBLIC_NAVER_MAP_KEY_ID=
AUTH_KAKAO_CLIENT_ID=
AUTH_KAKAO_CLIENT_SECRET=
AUTH_NAVER_CLIENT_ID=
AUTH_NAVER_CLIENT_SECRET=
```

권장 추가값:

```env
AUTH_DEMO_PASSWORD=
AUTH_ADMIN_PASSWORD=
EMAIL_FROM=
RESEND_API_KEY=
```

### 어떤 값이 시크릿인가
- 시크릿으로 다뤄야 하는 값
  - `DATABASE_URL`
  - `AUTH_SECRET`
  - `AUTH_KAKAO_CLIENT_SECRET`
  - `AUTH_NAVER_CLIENT_SECRET`
  - `RESEND_API_KEY`
- 공개 변수로 둬도 되는 값
  - `NEXT_PUBLIC_NAVER_MAP_KEY_ID`
- 실무적으로는 아래도 대시보드에서 변수로 관리하는 편이 낫다.
  - `AUTH_KAKAO_CLIENT_ID`
  - `AUTH_NAVER_CLIENT_ID`
  - `SITE_URL`
  - `NEXTAUTH_URL`
  - `ADMIN_APP_URL`

## 7. `NEXTAUTH_URL`을 어떻게 잡을지

이 프로젝트는 `NEXTAUTH_URL`이 매우 중요하다.
- Auth.js callback 기준 URL
- `robots.txt`
- `sitemap.xml`
- canonical metadata

관리자 앱을 따로 배포할 때는 `SITE_URL`도 같이 중요하다.
- admin 앱 헤더의 홈 링크 기준 URL
- public 앱 복귀 링크 기준 URL

### 가장 쉬운 순서
1. 먼저 `workers.dev` 주소로 배포
2. 실제 주소를 확인
3. 그 주소로 `NEXTAUTH_URL` 설정
4. 카카오/네이버 callback 수정
5. 다시 배포

### 예시
만약 계정 subdomain이 `alexteam`, Worker 이름이 `altteulmap`이면:

```env
NEXTAUTH_URL=https://altteulmap.alexteam.workers.dev
```

관리자 앱을 따로 두면 예시는 아래처럼 나뉜다.

```env
# public worker
NEXTAUTH_URL=https://altteulmap.alexteam.workers.dev
ADMIN_APP_URL=https://altteulmap-admin.alexteam.workers.dev

# admin worker
NEXTAUTH_URL=https://altteulmap-admin.alexteam.workers.dev
SITE_URL=https://altteulmap.alexteam.workers.dev
```

참고:
- `workers.dev` 형식은 Cloudflare 공식 문서 기준으로 `<worker-name>.<subdomain>.workers.dev`다.
- 운영 서비스는 나중에 커스텀 도메인으로 바꾸는 게 좋다.

## 8. 배포 전 로컬 검증

아래 순서를 권장한다.

```bash
npm install
npm run verify
npm run test:e2e
npm run deploy:check -- --preview
npm run deploy:check:public
npm run deploy:check:admin
```

DB를 실제로 쓰는 상태면 필요 시:

```bash
npm run db:up
npm run db:push
npm run db:seed
```

이 저장소의 배포 체크 문서는 별도로 아래 파일에 있다.
- `deploy-cloudflare.md`

## 9. 첫 `workers.dev` 배포

### 9-1. Worker 이름 확인
현재 Worker 이름은 아래 파일에 들어 있다.
- `/Users/alex/project/altteulmap/wrangler.jsonc`

현재 값:
- `name: "altteulmap"`

### 9-2. 첫 배포 실행

```bash
npm run deploy
```

이 명령은 내부적으로:
1. OpenNext build
2. Cloudflare Worker deploy

를 순서대로 수행한다.

관리자 앱을 public 앱과 분리해서 운영할 계획이면 아래 순서를 쓴다.

```bash
npm run deploy:admin
# altteulmap-admin workers.dev 주소 확인
# ADMIN_APP_URL에 위 주소 반영
npm run deploy:public
```

이때 `deploy:public`은 `ADMIN_APP_URL`이 비어 있으면 실패한다. public 번들은 `/admin`, `/api/admin`을 external redirect/API stub 모드로 빌드하고, 관리자 링크를 외부 관리자 앱으로 보내기 때문이다.

공식 문서:
- [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext get started](https://opennext.js.org/cloudflare/get-started)

### 9-3. 첫 배포 후 확인
- 배포 성공 메시지에 `workers.dev` 주소가 출력되는지 확인
- 브라우저에서 열어 기본 페이지가 뜨는지 확인
- `/login`
- `/robots.txt`
- `/sitemap.xml`

## 10. Cloudflare 대시보드에서 런타임 변수 넣기

첫 배포 후:
1. Cloudflare Dashboard
2. `Workers & Pages`
3. `altteulmap` 선택
4. `Settings`
5. `Variables and Secrets`

여기서 값을 넣는다.

### 최소 권장 구성
- Environment variables
  - `NEXTAUTH_URL`
  - `NEXT_PUBLIC_NAVER_MAP_KEY_ID`
  - `AUTH_KAKAO_CLIENT_ID`
  - `AUTH_NAVER_CLIENT_ID`
- Secrets
  - `DATABASE_URL`
  - `AUTH_SECRET`
  - `AUTH_KAKAO_CLIENT_SECRET`
  - `AUTH_NAVER_CLIENT_SECRET`

주의:
- Wrangler 문서 기준으로 대시보드 변수는 다음 deploy에서 config 값에 의해 덮일 수 있다.
- 현재 저장소는 `wrangler.jsonc`에 별도 `vars`를 정의하지 않으므로, 대시보드 값을 runtime source of truth로 유지하기 쉽다.

## 11. OAuth callback URL 연결

배포 URL이 확정되면 provider console에서 아래 callback을 등록한다.

### 카카오
```text
<NEXTAUTH_URL>/api/auth/callback/kakao
```

### 네이버
```text
<NEXTAUTH_URL>/api/auth/callback/naver
```

예시:
```text
https://altteulmap.alexteam.workers.dev/api/auth/callback/kakao
https://altteulmap.alexteam.workers.dev/api/auth/callback/naver
```

## 12. 두 번째 배포

런타임 변수와 OAuth callback을 맞춘 뒤 다시 배포한다.

```bash
npm run deploy
```

대시보드 변수/시크릿을 주된 runtime source로 쓸 때는 재배포 전에 현재 대시보드 값이 유지되는지 확인한다. `keep vars` 계열 옵션을 쓰는 경우에는 사용 중인 OpenNext/Wrangler 버전의 최신 문법을 먼저 확인하는 편이 안전하다.

## 13. 커스텀 도메인 연결

실서비스 전환은 `workers.dev`보다 커스텀 도메인을 권장한다.

### 전제
- 도메인이 있어야 한다.
- 해당 도메인이 Cloudflare zone에 활성화되어 있어야 한다.

### 대시보드에서 연결
1. Cloudflare Dashboard
2. `Workers & Pages`
3. `altteulmap`
4. `Settings > Domains & Routes`
5. `Add > Custom Domain`
6. 예: `app.example.com`

Cloudflare 문서 기준으로 Custom Domain을 추가하면:
- DNS 레코드를 생성하고
- 인증서를 발급하며
- Worker를 그 도메인에 직접 연결한다

공식 문서:
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## 14. 커스텀 도메인 전환 후 해야 할 것

### 14-1. `NEXTAUTH_URL` 수정

```env
NEXTAUTH_URL=https://app.example.com
```

### 14-2. 카카오/네이버 callback 수정

```text
https://app.example.com/api/auth/callback/kakao
https://app.example.com/api/auth/callback/naver
```

### 14-3. 재배포

```bash
npm run deploy
```

## 15. 배포 직후 확인 체크리스트

### 기본 확인
- 홈(`/`)이 뜨는지
- 지도 로딩이 되는지
- `/robots.txt`
- `/sitemap.xml`
- place 상세 페이지 canonical이 도메인 기준으로 잡히는지

### 인증 확인
- `/login` 진입
- 카카오 로그인
- 네이버 로그인
- 로그인 후 북마크
- 로그인 후 장소 제보

### 관리자 확인
- 관리자 로그인
- 신고 큐
- 가격 검토 큐
- 장소 승인

### 로그 확인
배포 후 실시간 로그는 아래로 본다.

```bash
npx wrangler tail
```

공식 문서:
- [Real-time logs / wrangler tail](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)

## 16. 첫 배포에서 가장 많이 막히는 포인트

### 1. `NEXTAUTH_URL`이 localhost로 남아 있음
- OAuth callback과 canonical이 다 꼬인다.

### 2. 로컬 build 변수와 Cloudflare runtime 변수를 혼동함
- 이 저장소는 둘 다 필요하다.

### 3. `NEXT_PUBLIC_NAVER_MAP_KEY_ID`를 runtime에만 넣고 로컬 build에는 안 넣음
- 클라이언트 번들 기준 값이 비어 있을 수 있다.

### 4. 카카오/네이버 callback URL이 실제 도메인과 다름
- 로그인만 실패하고 다른 기능은 정상인 상태가 생긴다.

### 5. DB 연결 문자열은 넣었는데 Cloudflare에서 외부 DB 접속이 막힘
- DB 방화벽, SSL, Supabase 연결 정책을 확인해야 한다.

### 6. `workers.dev`로는 되는데 커스텀 도메인 전환 후 안 됨
- `NEXTAUTH_URL`, callback URL, domain binding 세 군데를 같이 다시 확인해야 한다.

## 17. 알뜰맵 기준 추천 순서

가장 안전한 실제 순서는 아래다.

1. Cloudflare 계정 생성
2. `npx wrangler login`
3. `npm run verify`
4. `npm run test:e2e`
5. `npm run deploy:check -- --preview`
6. `npm run deploy`
7. `workers.dev` URL 확인
8. Cloudflare 대시보드에 runtime 변수/secret 입력
9. 카카오/네이버 callback을 `workers.dev` URL로 등록
10. `npm run deploy` 다시 실행
11. 실제 소셜 로그인 확인
12. 커스텀 도메인 연결
13. `NEXTAUTH_URL`과 callback을 커스텀 도메인 기준으로 수정
14. 최종 재배포

## 참고 공식 문서
- [Cloudflare account creation](https://developers.cloudflare.com/fundamentals/account/create-account/)
- [Cloudflare login](https://developers.cloudflare.com/fundamentals/user-profiles/login/)
- [Cloudflare Workers Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext Cloudflare get started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext env vars](https://opennext.js.org/cloudflare/howtos/env-vars)
- [Install/Update Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Wrangler login command](https://developers.cloudflare.com/workers/wrangler/commands/general/)
- [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Workers real-time logs](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/)
