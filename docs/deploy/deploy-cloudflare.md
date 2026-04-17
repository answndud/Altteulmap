# Cloudflare 배포 체크리스트

기준일: 2026-03-31

## 목적
- Cloudflare Workers + OpenNext 기준으로 알뜰맵을 배포할 때 빠뜨리기 쉬운 설정을 한 문서에 모은다.
- 실제 배포 전 `npm run deploy:check`로 환경 변수를 먼저 점검한다.
- 계정 생성부터 첫 배포까지의 전체 절차는 아래 문서를 함께 본다.
  - `cloudflare-account-to-deploy.md`

## 현재 운영 기준
- 현재 운영 URL은 custom domain이 아니라 `workers.dev` split이다.
- public: `https://altteulmap.altteul-lab.workers.dev`
- admin: `https://altteulmap-admin.altteul-lab.workers.dev`
- `NEXTAUTH_URL`, `SITE_URL`, `ADMIN_APP_URL`, canonical, robots, sitemap, admin redirect는 위 두 주소를 기준으로 유지한다.
- GitHub Actions 기준으로는 `main` push 시 public worker만 자동 배포한다. admin worker는 여전히 수동 `deploy:admin` 경로로 유지한다.
- custom domain은 별도 cycle에서 DNS, callback, canonical을 다시 묶어 처리할 후속 작업이다.

## 1. 배포 전 필수 확인
1. `npm run verify`
2. `npm run db:check:production`
3. `npm run smoke:local`
4. `npm run smoke:remote`
5. `USE_MOCK_DATA=false`
6. 운영 DB 연결 문자열 준비
7. `NEXTAUTH_URL`을 실제 배포 도메인으로 변경
8. 관리자 앱을 분리할 경우 public 앱 `ADMIN_APP_URL`, admin 앱 `SITE_URL`까지 준비
9. 네이버 지도 키와 OAuth callback URL을 운영 도메인 기준으로 등록

## 2. 필수 환경 변수
- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `ADMIN_APP_URL` (`deploy:public` 또는 외부 관리자 앱 분리 시)
- `SITE_URL` (`deploy:admin`으로 별도 관리자 앱을 둘 때 권장, public 홈 링크 기준)
- `NEXT_PUBLIC_NAVER_MAP_KEY_ID`
- `AUTH_KAKAO_CLIENT_ID`
- `AUTH_KAKAO_CLIENT_SECRET`
- `AUTH_NAVER_CLIENT_ID`
- `AUTH_NAVER_CLIENT_SECRET`
- `CLOUDFLARE_API_TOKEN` (`main` push 자동 public deploy 또는 로컬 wrangler deploy 시)

현재 코드 기준으로는 위 값들이 없으면 배포 후 로그인 또는 지도 기능이 깨질 수 있다.
Cloudflare account ID는 현재 [wrangler.jsonc](/Users/alex/project/altteulmap/wrangler.jsonc), [wrangler.admin.jsonc](/Users/alex/project/altteulmap/wrangler.admin.jsonc)에 직접 넣어 두었으므로 GitHub variable로 따로 줄 필요는 없다.

## 3. 권장 추가 환경 변수
- `EMAIL_FROM`
- `RESEND_API_KEY`

현재 앱에서 이메일 로그인은 아직 구현 전이므로 즉시 필수는 아니다.

## 4. OAuth callback URL
- 카카오: `<NEXTAUTH_URL>/api/auth/callback/kakao`
- 네이버: `<NEXTAUTH_URL>/api/auth/callback/naver`

예시:
- production: `https://altteulmap.example.com/api/auth/callback/kakao`
- production: `https://altteulmap.example.com/api/auth/callback/naver`

## 5. Cloudflare 쪽 준비
1. Cloudflare 계정 생성
2. Wrangler 로그인
3. Workers 서비스 이름 확인
4. 필요 시 Hyperdrive 생성
5. Workers 환경 변수 또는 secret 등록

## 5-1. Workers Builds 권장 설정

현재 저장소는 `apps/admin`이 별도 앱처럼 보이지만, 의존성 설치는 루트 `package-lock.json`과 루트 `node_modules`를 기준으로 동작한다.
그래서 `altteulmap-admin`의 Root directory를 `apps/admin`으로 두면 Cloudflare 기본 설치 단계(`npm ci`)가 `apps/admin/package-lock.json`을 찾다가 실패한다.

자동 배포 기준으로는 public/admin 모두 repo root(`/`)를 쓰는 구성이 안전하다.

### public worker: `altteulmap`
- Root directory: `/`
- Install command: `npm ci`
- Build command: `npm run cf:build:public`
- Deploy command: `npx opennextjs-cloudflare deploy -c wrangler.jsonc`

### admin worker: `altteulmap-admin`
- Root directory: `/`
- Install command: `npm ci`
- Build command: `npm run cf:build:admin`
- Deploy command: `npx opennextjs-cloudflare deploy -c wrangler.admin.jsonc`

주의:
- `altteulmap-admin`의 Root directory를 `apps/admin`으로 두지 않는다.
- admin 앱은 shared 코드와 루트 lockfile을 같이 쓰므로, Root directory를 하위 폴더로 제한하면 설치 단계에서 깨지기 쉽다.
- build watch paths를 따로 줄 수는 있지만 shared 의존 범위가 넓으므로, 처음에는 비워 두는 편이 안전하다.

## 6. 로컬 사전 점검 명령
```bash
npm run verify
npm run db:check:production
npm run smoke:local
npm run smoke:remote
npm run deploy:check
```

운영 URL smoke는 아래처럼 public/admin 주소를 명시하는 방식을 권장한다.

```bash
SMOKE_PUBLIC_URL=https://altteulmap.<subdomain>.workers.dev \
SMOKE_ADMIN_URL=https://altteulmap-admin.<subdomain>.workers.dev \
npm run smoke:remote
```

이 스크립트는 public `/`, `/robots.txt`, `/sitemap.xml`, sample place canonical, public `/admin`, public `/api/admin/places`, admin `/admin`, admin `/login`을 읽기 전용으로 확인한다.
`db:check:production`은 현재 `DATABASE_URL`로 실제 연결, moderation schema 유무, drizzle migration table 유무를 확인하고, `Tenant or user not found`가 나오면 URL encoding이 아니라 stale credential 문제라는 점까지 분리해준다.

배포는 목적에 따라 아래를 사용한다.

```bash
npm run deploy
npm run deploy:check:public
npm run deploy:public
npm run deploy:check:admin
npm run deploy:admin
```

- `deploy`: 현재 앱 전체 배포
- `deploy:public`: `/admin`, `/api/admin`을 외부 관리자 앱 redirect/API stub로 전환한 public 앱 배포
- `deploy:admin`: 별도 `apps/admin` 관리자 앱 배포

자동화 기준:
- `main` push: GitHub Actions가 `verify -> deploy:check:public -> deploy:public` 순서로 public worker를 자동 배포한다.
- 관리자 앱은 자동 배포하지 않는다. admin 변경은 `npm run deploy:admin`을 별도로 실행한다.
- 자동 배포를 쓰려면 GitHub repository `vars/secrets`에 `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, `AUTH_KAKAO_CLIENT_ID`, `AUTH_KAKAO_CLIENT_SECRET`, `AUTH_NAVER_CLIENT_ID`, `AUTH_NAVER_CLIENT_SECRET`, `CLOUDFLARE_API_TOKEN`를 채워야 한다.
- `ADMIN_APP_URL`, `SITE_URL` variable이 비어 있으면 workflow는 현재 운영 기본값(`https://altteulmap-admin.altteul-lab.workers.dev`, `https://altteulmap.altteul-lab.workers.dev`)을 자동으로 사용한다.

관리자 분리 기준 배포 순서는 아래를 권장한다.
1. `npm run deploy:admin`
2. admin Worker에 `NEXTAUTH_URL=https://altteulmap-admin.<subdomain>.workers.dev`, `SITE_URL=https://altteulmap.<subdomain>.workers.dev` 설정
3. public Worker에 `ADMIN_APP_URL=https://altteulmap-admin.<subdomain>.workers.dev` 설정
4. `npm run deploy:public`

이 명령들은 `.next`, `.open-next`를 먼저 비우고 다시 OpenNext build를 만든 뒤 업로드한다.
현재 저장소는 Cloudflare Workers Free 한도에 맞추기 위해 `webpack` build를 사용한다.
배포/점검 스크립트는 쉘이나 CI에서 주입한 env를 로컬 `.env*`보다 우선 사용하므로, 운영 워크플로우에서 넘긴 `NEXTAUTH_URL`, `ADMIN_APP_URL`, `SITE_URL`이 로컬 파일 값에 덮이지 않는다.

preview 기준으로 로컬 URL 허용 상태만 보려면:

```bash
npm run deploy:check -- --preview
```

## 7. 첫 배포 직후 확인
1. `/`에서 지도 렌더링
2. `/login`에서 카카오/네이버 로그인 버튼 노출
3. public Worker의 `/admin`이 별도 admin Worker로 이동하는지 확인
4. public Worker의 `/api/admin/places`가 `adminUrl`이 담긴 안내 JSON을 반환하는지 확인
5. `/robots.txt`
6. `/sitemap.xml`
7. 장소 상세 canonical
8. 북마크/등록/신고 보호 라우트 동작
9. 필요 시 `npm run smoke:remote` 재실행

## 8. 주의사항
- production에서는 `NEXTAUTH_URL`에 `localhost`를 쓰면 안 된다.
- `deploy:public`은 `ADMIN_APP_URL` 없이 실행하면 실패하게 해두었다. public 번들은 `/admin`, `/api/admin`을 external stub 모드로 빌드하므로 외부 관리자 앱 주소가 필요하다.
- `deploy:admin`으로 별도 관리자 앱을 둘 때 `SITE_URL`이 빠지면 관리자 헤더의 홈 링크가 admin 앱 자신을 가리킬 수 있다.
- 네이버 지도 키와 네이버 로그인 키는 서로 다른 값이다.
- 지도용 네이버 키는 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, 로그인용은 `AUTH_NAVER_CLIENT_ID` / `AUTH_NAVER_CLIENT_SECRET`이다.
- 네이버 지도는 환경 변수만 맞춰도 끝나지 않는다. NAVER Cloud Platform 지도 애플리케이션 설정의 웹 서비스 URL 또는 허용 도메인에 실제 배포 주소(`https://<worker>.<subdomain>.workers.dev` 또는 custom domain)를 같이 등록해야 한다.
- 카카오와 네이버 developer console에 등록된 callback URL이 실제 도메인과 정확히 일치해야 한다.
