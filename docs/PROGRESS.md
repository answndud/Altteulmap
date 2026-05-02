# PROGRESS.md

## Active 상태

로컬 개발 서버 지도 fallback 개선 작업을 완료했다. 현재는 검증 완료 후 커밋 전 상태다.

## 최근 확인
- 운영 URL에서는 Naver Maps JavaScript SDK가 정상 인증되어 실제 지도가 보인다.
- 로컬 `http://127.0.0.1:5173/`와 `http://localhost:5173/`에서는 Naver auth endpoint가 `401`을 반환한다.
- 현재 로컬 public config API는 `{"naverMapKeyId":""}`를 반환해 Worker env fallback도 보강이 필요하다.

## 다음 액션
- 사용자가 원하면 커밋/푸시/배포를 진행한다.

## Blocker
- Naver 콘솔에 로컬 origin이 등록되지 않은 상태에서는 Naver SDK 인증 자체는 로컬에서 통과시킬 수 없다. 대신 로컬 전용 fallback으로 지도 화면을 보이게 처리한다.

## 최근 검증
- `curl -s http://127.0.0.1:5173/api/config/public` -> `{"naverMapKeyId":"41jb38doiu"}`
- 로컬 Playwright 확인:
  - URL: `http://127.0.0.1:5173/`
  - screenshot: `/tmp/altteulmap-local-map-visible.png`
  - tile fallback image count: `63`
  - `window.naver?.maps`: `false`
  - Naver SDK request 없이 `tile.openstreetmap.org` tile request 발생 확인
- `npm run verify` -> 통과
- `npm run design:detect:json` -> `[]`
- `git diff --check` -> 통과
- `npm run build` -> 통과
