# PLAN.md

## Active 작업

로컬 개발 서버에서도 지도 화면이 실제 지도처럼 보이게 한다.

## 배경
- 운영 배포 URL에서는 Naver Maps JavaScript SDK 인증이 통과해 실제 지도가 보인다.
- 로컬 Vite dev 서버에서는 Naver Maps auth endpoint가 `http://127.0.0.1:5173/`, `http://localhost:5173/` origin에 대해 `401`을 반환한다.
- 로컬 origin을 Naver 콘솔에 허용하지 않으면 SDK 인증 자체는 코드로 우회할 수 없으므로, 개발 서버에서도 지도 UX를 확인할 수 있는 fallback이 필요하다.

## 작업
- `/api/config/public`이 로컬 dev에서도 build-time public env fallback을 반환하도록 보강한다.
- Naver SDK가 auth failure 또는 missing key로 ready 상태가 되지 않아도, 로컬 개발 서버에서는 흰 배경 grid 대신 지도 타일 fallback을 표시한다.
- production에서는 기존 Naver map 우선 동작을 유지한다.

## 완료 기준
- 로컬 `http://127.0.0.1:5173/`에서 지도 영역이 실제 지도 타일 기반으로 보인다.
- 운영 배포 흐름과 Naver SDK loading contract를 깨지 않는다.
- `npm run verify`, `npm run build`, `npm run design:detect:json`, `git diff --check`가 통과한다.
