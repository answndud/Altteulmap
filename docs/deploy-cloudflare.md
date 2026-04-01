# Cloudflare 배포 체크리스트

기준일: 2026-03-31

## 목적
- Cloudflare Workers + OpenNext 기준으로 알뜰맵을 배포할 때 빠뜨리기 쉬운 설정을 한 문서에 모은다.
- 실제 배포 전 `npm run deploy:check`로 환경 변수를 먼저 점검한다.
- 계정 생성부터 첫 배포까지의 전체 절차는 아래 문서를 함께 본다.
  - `/Users/alex/project/altteulmap/docs/cloudflare-account-to-deploy.md`

## 1. 배포 전 필수 확인
1. `npm run verify`
2. `npm run smoke:local`
3. `USE_MOCK_DATA=false`
4. 운영 DB 연결 문자열 준비
5. `NEXTAUTH_URL`을 실제 배포 도메인으로 변경
6. 네이버 지도 키와 OAuth callback URL을 운영 도메인 기준으로 등록

## 2. 필수 환경 변수
- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_NAVER_MAP_KEY_ID`
- `AUTH_KAKAO_CLIENT_ID`
- `AUTH_KAKAO_CLIENT_SECRET`
- `AUTH_NAVER_CLIENT_ID`
- `AUTH_NAVER_CLIENT_SECRET`

현재 코드 기준으로는 위 값들이 없으면 배포 후 로그인 또는 지도 기능이 깨질 수 있다.

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

## 6. 로컬 사전 점검 명령
```bash
npm run verify
npm run smoke:local
npm run deploy:check
```

배포는 `npm run deploy`를 사용한다. 이 명령은 `.next`, `.open-next`를 먼저 비우고 다시 OpenNext build를 만든 뒤 업로드한다.
현재 저장소는 Cloudflare Workers Free 한도에 맞추기 위해 `webpack` build를 사용한다.

preview 기준으로 로컬 URL 허용 상태만 보려면:

```bash
npm run deploy:check -- --preview
```

## 7. 첫 배포 직후 확인
1. `/`에서 지도 렌더링
2. `/login`에서 카카오/네이버 로그인 버튼 노출
3. `/robots.txt`
4. `/sitemap.xml`
5. 장소 상세 canonical
6. 북마크/등록/신고 보호 라우트 동작

## 8. 주의사항
- production에서는 `NEXTAUTH_URL`에 `localhost`를 쓰면 안 된다.
- 네이버 지도 키와 네이버 로그인 키는 서로 다른 값이다.
- 지도용 네이버 키는 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, 로그인용은 `AUTH_NAVER_CLIENT_ID` / `AUTH_NAVER_CLIENT_SECRET`이다.
- 네이버 지도는 환경 변수만 맞춰도 끝나지 않는다. NAVER Cloud Platform 지도 애플리케이션 설정의 웹 서비스 URL 또는 허용 도메인에 실제 배포 주소(`https://<worker>.<subdomain>.workers.dev` 또는 custom domain)를 같이 등록해야 한다.
- 카카오와 네이버 developer console에 등록된 callback URL이 실제 도메인과 정확히 일치해야 한다.
