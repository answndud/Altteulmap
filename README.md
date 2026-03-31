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
npm run db:generate
npm run db:push
npm run preview
```

- `dev`: Next.js 로컬 개발 서버
- `lint`: ESLint 검사
- `build`: Next.js 프로덕션 빌드
- `db:generate`: Drizzle 마이그레이션 SQL 생성
- `db:push`: 로컬/개발 DB에 스키마 반영
- `preview`: OpenNext로 Cloudflare Workers 런타임 미리보기

`deploy`, `upload`는 Cloudflare 계정과 Wrangler 인증이 준비된 뒤 사용하면 됩니다.

## DB 시작

```bash
cp .env.example .env
```

그 다음 `.env`에 `DATABASE_URL`을 채우고 아래 순서로 진행하면 됩니다.

```bash
npm run db:generate
npm run db:push
```

## Cloudflare 관련 파일

- `wrangler.jsonc`: Workers 설정 파일
- `open-next.config.ts`: OpenNext 설정 파일
- `.dev.vars`: 로컬 Cloudflare 개발용 변수
- `public/_headers`: 정적 자산 캐시 헤더

## 문서

- `prd.md`
- `trd.md`
