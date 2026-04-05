# 알뜰맵

알뜰맵은 내 주변의 저렴한 식당과 생활 서비스 정보를 지도에서 찾는 웹 서비스입니다.

현재 프로젝트는 로컬 개발 우선으로 초기 세팅되어 있습니다.
- 앱 개발: 일반 Next.js 개발 서버 사용
- Cloudflare 대응: OpenNext/Wrangler 설정 포함
- 실제 배포: Cloudflare 계정 준비 후 진행

## 로컬 개발

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

로컬 개발 서버는 `webpack` 기반으로 실행되고 산출물을 `.next-dev`에 저장합니다. 반대로 `build`, `start`, Playwright E2E, Cloudflare 빌드는 계속 `.next` 또는 `.open-next`를 사용하므로, dev 서버를 띄운 채 빌드/검증을 돌려도 예전처럼 같은 `.next`를 공유하며 깨지지 않습니다.

페이지 전환이 멈추거나 dev cache가 이상하면 실행 중인 dev 서버를 먼저 내린 뒤, dev 산출물만 비우고 다시 올리면 됩니다.

```bash
npm run dev:clean
npm run dev
```

## 주요 스크립트

```bash
npm run dev
npm run lint
npm run build
npm run verify
npm run test:e2e:smoke
npm run test:e2e
npm run smoke:local
npm run smoke:remote
npm run deploy:check
npm run deploy:check:public
npm run deploy:check:admin
npm run admin:build
npm run cf:build:admin
npm run hooks:install
npm run db:up
npm run db:generate
npm run db:push
npm run db:seed
npm run data:goodprice
npm run db:down
npm run preview
```

- `dev`: Next.js 로컬 개발 서버 (`webpack`, `.next-dev`)
- `dev:clean`: 로컬 dev 산출물 `.next-dev`만 수동 정리
- `lint`: ESLint 검사
- `build`: Next.js 프로덕션 빌드 (`.next`)
- `verify`: 현재 프로젝트 기준 전체 기본 검증(`lint + build`)
- `test:e2e:smoke`: `main` 푸시 기준의 빠른 Playwright smoke 세트
- `test:e2e`: Playwright E2E 실행
- `smoke:local`: 실행 중인 로컬 서버에 대해 홈 canonical, `robots`, `sitemap`, sample place canonical, map/detail API, 로그인 화면 렌더를 읽기 전용으로 점검
- `smoke:remote`: 운영 public/admin URL에 대해 `robots`, `sitemap`, canonical, public `/admin` redirect, admin `/login`을 읽기 전용으로 점검
- `deploy:check`: Cloudflare 배포 전 필수 환경 변수와 URL 설정 점검
- `deploy:check:public`: public-only worker 기준으로 `ADMIN_APP_URL`까지 포함해 점검
- `deploy:check:admin`: standalone admin worker 기준으로 `SITE_URL`까지 포함해 점검
- `admin:sync`: public 앱의 관리자 route entrypoint를 `embedded` 또는 `external` 구현으로 동기화
- `admin:sync:embedded`: public 앱 관리자 route를 내장 구현으로 강제 동기화
- `admin:sync:external`: public 앱 관리자 route를 외부 관리자 앱 redirect/API stub 구현으로 강제 동기화
- `admin:build`: 별도 `apps/admin` 관리자 앱 빌드
- `cf:build:admin`: 별도 `apps/admin` 관리자 Worker용 OpenNext build
- `hooks:install`: 이 저장소 전용 git hook 활성화
- `db:up`: 로컬 Postgres 컨테이너 시작
- `db:generate`: Drizzle 마이그레이션 SQL 생성
- `db:push`: 로컬/개발 DB에 스키마 반영
- `db:seed`: 로컬 DB에 시드 데이터 입력 (`imported-goodprice.json`이 있으면 실제 착한가격업소 1000건을 우선 사용)
- `data:goodprice`: 행정안전부 `착한가격업소` 사이트에서 `대표 가격 8천원 미만` 실제 업소를 수집해 `src/features/places/imported-goodprice.json`과 `data/goodprice/import-meta.json` 생성. 기본 quota는 `서울 500 + 비서울 500`, `음식점 70%`다
- `db:down`: 로컬 Postgres 컨테이너 중지
- `cf:clean`: Cloudflare 빌드 전 `.next`, `.open-next` 정리
- `cf:build`: Cloudflare 배포용 clean build
- `preview`: OpenNext로 Cloudflare Workers 런타임 미리보기
- `preview:public`: public 앱을 외부 관리자 앱 redirect/API stub 모드로 preview
- `preview:admin`: 별도 관리자 앱 preview
- `deploy:public`: public 앱을 외부 관리자 앱 redirect/API stub 모드로 배포
- `deploy:admin`: 별도 관리자 앱 배포

`deploy`, `deploy:public`, `deploy:admin`, `upload`는 Cloudflare 계정과 Wrangler 인증이 준비된 뒤 사용하면 됩니다.

현재 산출물 경로는 `dev -> .next-dev`, `build/start/e2e -> .next`, `Cloudflare preview/deploy -> .open-next`로 분리돼 있습니다. Cloudflare 무료 플랜 기준 경량화는 `next build --webpack` + `cf:clean` 경로를 전제로 맞춰져 있습니다.

관리자 분리 1차가 들어가 있어서, 현재 배포 경로는 두 가지입니다.
- 기본 `deploy`: 관리자 구현을 포함한 현재 앱 전체 배포
- `deploy:public`: public 앱은 유지하되 `/admin`, `/api/admin`을 외부 관리자 앱 redirect/API stub로 전환하는 경로
- `deploy:admin`: `apps/admin`을 `altteulmap-admin` 같은 별도 Worker로 배포하는 경로

`deploy:public`은 `ADMIN_APP_URL`이 반드시 있어야 합니다. public 앱에서 관리자 링크를 별도 관리자 앱으로 보낼 때 쓰는 값이기 때문입니다.

분리 배포에서는 admin 앱에도 `SITE_URL`을 같이 넣는 편이 안전합니다. 권장값은 아래와 같습니다.
- public 앱: `NEXTAUTH_URL=https://altteulmap.<subdomain>.workers.dev`
- public 앱: `ADMIN_APP_URL=https://altteulmap-admin.<subdomain>.workers.dev`
- admin 앱: `NEXTAUTH_URL=https://altteulmap-admin.<subdomain>.workers.dev`
- admin 앱: `SITE_URL=https://altteulmap.<subdomain>.workers.dev`

배포/점검 스크립트는 이제 쉘이나 CI에서 주입한 env를 로컬 `.env*`보다 우선 사용합니다. 따라서 운영 배포 시에는 워크플로우나 셸에서 넘긴 `NEXTAUTH_URL`, `ADMIN_APP_URL`, `SITE_URL`이 로컬 파일 값에 덮이지 않습니다.

별도 관리자 앱은 `apps/admin`에서 관리하며, 로컬 검증은 `npm run admin:build`, Worker 번들 검증은 `npm run cf:build:admin`으로 먼저 확인합니다.

## DB 시작

DB 없이도 앱은 바로 실행됩니다. `.env`가 없거나 `USE_MOCK_DATA=true`면 자동으로 목업 데이터를 사용합니다.

```bash
npm run db:up
cp .env.example .env
```

그 다음 `.env`에서 `USE_MOCK_DATA=false`로 바꾸고 아래 순서로 진행하면 됩니다.

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

로그인과 운영자 화면까지 확인하려면 시드 데이터가 필요합니다. 기본 로컬 계정은 아래 환경 변수 조합을 사용합니다.

- 일반 사용자: `demo@altteulmap.local` / `AUTH_DEMO_PASSWORD`
- 운영자: `admin@altteulmap.local` / `AUTH_ADMIN_PASSWORD`

DB가 연결된 상태에서는 `/signup`에서 새 이메일 계정을 직접 만들 수 있습니다. 가입이 끝나면 같은 이메일/비밀번호로 바로 로그인됩니다.

실제 데이터를 다시 받으려면 아래 순서로 실행하면 됩니다.

```bash
npm run data:goodprice -- --delay-ms=50 --timeout-ms=10000
npm run db:seed
```

기본 수집값은 `대표 가격 8천원 미만`, `서울 500 + 비서울 500`, `음식점 70%`입니다. 다른 분포가 필요하면 `--limit`, `--seoul-limit`, `--food-ratio`, `--max-price`를 함께 넘기면 됩니다.

생성된 `src/features/places/imported-goodprice.json`은 mock fallback과 DB seed 양쪽에서 공통으로 우선 사용합니다. 수집 메타와 원본 업소 id, quota 결과, 지역/업종 분포는 `data/goodprice/import-meta.json`에 남습니다.

기본 예시는 `.env.example`에 들어 있고, 로컬 `.env`도 같은 값으로 맞춰두었습니다.

`/`에서 실제 네이버 지도를 보려면 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`를 설정하면 됩니다. 아직 키가 없으면 같은 화면에서 자동으로 임시 프리뷰 지도로 fallback됩니다. 기존 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 값도 함께 지원합니다.

`NEXTAUTH_URL`은 로그인 callback뿐 아니라 `robots.txt`, `sitemap.xml`, canonical metadata의 기준 URL로도 사용합니다. 배포 시에는 반드시 실제 도메인으로 바꿔야 합니다.

분리 배포에서는 `SITE_URL`도 같이 씁니다.
- public 앱: `SITE_URL`을 비워 두거나 `NEXTAUTH_URL`과 같은 값 사용
- admin 앱: `NEXTAUTH_URL`은 관리자 앱 주소, `SITE_URL`은 public 앱 주소 사용

관리자 앱을 분리할 때는 `ADMIN_APP_URL`도 같이 설정합니다. 예를 들면 `https://altteulmap-admin.altteul-lab.workers.dev`처럼 별도 관리자 Worker 주소를 넣고, 그 뒤 public 앱을 `deploy:public`으로 배포합니다.

소셜 로그인을 붙일 때는 지도 키와 분리해서 아래 환경 변수를 사용합니다.

- `AUTH_KAKAO_CLIENT_ID`
- `AUTH_KAKAO_CLIENT_SECRET`
- `AUTH_NAVER_CLIENT_ID`
- `AUTH_NAVER_CLIENT_SECRET`

OAuth callback URL은 기본적으로 아래 경로를 사용합니다.

- 카카오: `/api/auth/callback/kakao`
- 네이버: `/api/auth/callback/naver`

## 로컬 AI 워크플로우

이 저장소에는 전역 설정 대신 repo-local AI 워크플로우 파일이 들어 있습니다.

```bash
npm run hooks:install
npm run verify
```

- `.agents/skills/`: API, migration, 검증, E2E 기준
- `.agents/reviewers/`: TypeScript/DB 자체 리뷰 체크리스트
- `.githooks/`: 이 저장소 전용 pre-commit, commit-msg hook

hook를 설치하면 아래가 자동으로 검사됩니다.
- staged 코드의 `debugger`/secret 패턴
- `npm run verify:quick`
- conventional commit 메시지 형식
- lint/formatter 설정 파일 수정 차단

로컬 서버가 이미 떠 있다면 아래로 빠른 런타임 점검을 할 수 있습니다.

```bash
npm run smoke:local
```

기본 대상은 `http://localhost:3000`이고, 다른 포트에서 확인하려면 `SMOKE_BASE_URL=http://localhost:3102 npm run smoke:local`처럼 실행하면 됩니다. 이 스크립트는 `/sitemap.xml`에서 sample place URL을 동적으로 골라 canonical까지 확인합니다. canonical과 sitemap은 build 시점 `SITE_URL`을 따르므로, localhost smoke를 돌릴 때는 `build`와 `start` 모두에 같은 localhost `SITE_URL`/`NEXTAUTH_URL`을 넘기는 편이 안전합니다.

배포된 public/admin URL을 읽기 전용으로 확인하려면 아래를 사용합니다.

```bash
SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev \
SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev \
npm run smoke:remote
```

`SMOKE_PUBLIC_URL`을 주지 않으면 `NEXTAUTH_URL`, `SMOKE_ADMIN_URL`을 주지 않으면 `ADMIN_APP_URL`을 기본으로 사용합니다.

Playwright E2E는 아래 명령으로 실행합니다.

```bash
npm run playwright:install
npm run test:e2e:smoke
npm run test:e2e
```

현재 E2E는 로컬 안정성을 위해 빌드 후 그룹별로 나뉩니다.
- `test:e2e:smoke`: `map`, `admin-dashboard`, `signup`, `submission-admin`
- `test:e2e`: smoke + `map.mobile` + `bookmarks`, `comments`, `price-review`, `report-admin`

로컬 E2E 명령은 `.env.production.local`이 있어도 `.env`와 `.env.local` 값을 우선 주입해 local DB와 local auth 기준으로 실행합니다. 이때 `NEXTAUTH_URL`은 Playwright 서버 포트에 맞춰 `http://127.0.0.1:3107`로 고정되고, DB 기반 세트는 `db:push -> db:seed`를 먼저 실행합니다. CI는 반대로 workflow env를 명시적으로 주입합니다.

현재 기본 E2E는 아래 흐름을 검증합니다.
- 지도 첫 진입
- 홈 인기 장소 추천 섹션과 상세 이동
- 검색과 상세 시트 열기/닫기
- 모바일 목록 시트 열기/닫기
- 모바일 목록 -> 상세 시트 -> 지도 복귀
- 비회원 좋아요/취소
- 목록/상세/추천 공유 버튼 fallback
- 운영자 로그인 후 관리 진입과 로그아웃
- credentials 로그인
- credentials 회원가입
- 로그인 없는 장소 등록
- 로그인 없는 코멘트 작성/삭제
- 관리자 장소 승인
- 북마크 저장/해제
- 로그인 없는 신고 제출과 관리자 상태 변경
- 로그인 없는 가격 제보와 관리자 반려
- 관리자 승인 후 홈 검색 반영

Cloudflare 배포 전 점검은 아래 문서를 기준으로 합니다.

- [docs/deploy-cloudflare.md](/Users/alex/project/altteulmap/docs/deploy-cloudflare.md)
- [docs/cloudflare-account-to-deploy.md](/Users/alex/project/altteulmap/docs/cloudflare-account-to-deploy.md)

## CI/CD

- GitHub Actions: `Verify`, `E2E Smoke`, `E2E Full`, `Deploy Config Check`
- Cloudflare Builds: `main` push 후 자동 배포

현재 권장 운영 방식은 `GitHub Actions가 검사`, `Cloudflare Builds가 배포`를 맡는 구조입니다.

- `push to main`
  - `Verify`: `npm run verify:quick`
  - `E2E Smoke`: 로컬 Postgres service container + `npm run test:e2e:smoke`
  - `Deploy Config Check`: 운영 env 기준 `npm run deploy:check`
- `pull_request`, `workflow_dispatch`
  - `Verify`: `npm run verify`
  - `E2E Full`: 로컬 Postgres service container + `npm run test:e2e`
- `Deploy Config Check`: GitHub repo `Secrets/Variables`에 저장한 운영 env로 `npm run deploy:check`

Playwright 브라우저는 GitHub Actions에서 `~/.cache/ms-playwright`를 캐시해 재실행 시간을 줄입니다.

GitHub Actions의 운영 env 이름은 `.env.production.local`과 동일하게 맞추는 것을 기준으로 합니다.

작업을 마치고 로컬 DB를 내리려면:

```bash
npm run db:down
```

## Cloudflare 관련 파일

- `wrangler.jsonc`: Workers 설정 파일
- `wrangler.admin.jsonc`: 별도 관리자 Worker 설정 파일
- `open-next.config.ts`: OpenNext 설정 파일
- `.dev.vars`: 로컬 Cloudflare 개발용 변수
- `public/_headers`: 정적 자산 캐시 헤더

## 문서

- `prd.md`
- `trd.md`
