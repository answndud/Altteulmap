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
