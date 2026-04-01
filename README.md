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

## 주요 스크립트

```bash
npm run dev
npm run lint
npm run build
npm run verify
npm run test:e2e
npm run smoke:local
npm run deploy:check
npm run hooks:install
npm run db:up
npm run db:generate
npm run db:push
npm run db:seed
npm run db:down
npm run preview
```

- `dev`: Next.js 로컬 개발 서버
- `lint`: ESLint 검사
- `build`: Next.js 프로덕션 빌드
- `verify`: 현재 프로젝트 기준 전체 기본 검증(`lint + build`)
- `test:e2e`: Playwright E2E 실행
- `smoke:local`: 실행 중인 로컬 서버에 대해 SEO/API/credentials 로그인 기본 스모크 체크
- `deploy:check`: Cloudflare 배포 전 필수 환경 변수와 URL 설정 점검
- `hooks:install`: 이 저장소 전용 git hook 활성화
- `db:up`: 로컬 Postgres 컨테이너 시작
- `db:generate`: Drizzle 마이그레이션 SQL 생성
- `db:push`: 로컬/개발 DB에 스키마 반영
- `db:seed`: 로컬 DB에 목업 시드 데이터 입력
- `db:down`: 로컬 Postgres 컨테이너 중지
- `preview`: OpenNext로 Cloudflare Workers 런타임 미리보기

`deploy`, `upload`는 Cloudflare 계정과 Wrangler 인증이 준비된 뒤 사용하면 됩니다.

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

기본 예시는 `.env.example`에 들어 있고, 로컬 `.env`도 같은 값으로 맞춰두었습니다.

`/map`에서 실제 네이버 지도를 보려면 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`를 설정하면 됩니다. 아직 키가 없으면 같은 화면에서 자동으로 임시 프리뷰 지도로 fallback됩니다. 기존 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 값도 함께 지원합니다.

`NEXTAUTH_URL`은 로그인 callback뿐 아니라 `robots.txt`, `sitemap.xml`, canonical metadata의 기준 URL로도 사용합니다. 배포 시에는 반드시 실제 도메인으로 바꿔야 합니다.

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

기본 대상은 `http://localhost:3000`이고, 다른 포트에서 확인하려면 `SMOKE_BASE_URL=http://localhost:3102 npm run smoke:local`처럼 실행하면 됩니다.

Playwright E2E는 아래 명령으로 실행합니다.

```bash
npm run playwright:install
npm run test:e2e
```

현재 `npm run test:e2e`는 로컬 안정성을 위해 빌드 후 세 그룹으로 나눠 실행합니다.
- `bookmarks`, `map`
- `map.mobile` (`mobile-chromium`, `USE_MOCK_DATA=true`)
- `price-review`, `report-admin`, `submission-admin`

현재 기본 E2E는 아래 흐름을 검증합니다.
- 지도 첫 진입
- 검색과 상세 시트 열기/닫기
- 모바일 목록 시트 열기/닫기
- 모바일 목록 -> 상세 시트 -> 지도 복귀
- 비회원 좋아요/취소
- 좋아요순 정렬
- 공유 버튼 fallback
- credentials 로그인
- 장소 등록
- 관리자 장소 승인
- 북마크 저장/해제
- 신고 제출과 관리자 상태 변경
- 가격 제보와 관리자 반려
- 관리자 승인 후 홈 검색 반영

Cloudflare 배포 전 점검은 아래 문서를 기준으로 합니다.

- [docs/deploy-cloudflare.md](/Users/alex/project/altteulmap/docs/deploy-cloudflare.md)

작업을 마치고 로컬 DB를 내리려면:

```bash
npm run db:down
```

## Cloudflare 관련 파일

- `wrangler.jsonc`: Workers 설정 파일
- `open-next.config.ts`: OpenNext 설정 파일
- `.dev.vars`: 로컬 Cloudflare 개발용 변수
- `public/_headers`: 정적 자산 캐시 헤더

## 문서

- `prd.md`
- `trd.md`
