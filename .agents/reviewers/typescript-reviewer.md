# TypeScript Reviewer

Next.js + React + TypeScript 변경을 검토할 때 아래 항목을 우선 본다.

## 우선 체크
- client/server 경계가 섞이지 않았는가
- effect 안에서 불필요한 `setState`를 하고 있지 않은가
- URL 상태와 클라이언트 상태가 충돌하지 않는가
- route handler 응답 타입이 화면 기대치와 맞는가
- `any`, 과한 `as`, 무리한 non-null assertion이 없는가
- 인증/권한 분기가 page와 API 모두에 있는가

## React/Next.js 체크
- derived state를 effect로 중복 저장하지 않는가
- 브라우저 전용 API를 서버 컴포넌트에서 쓰지 않는가
- `cache: "no-store"`가 필요한 fetch에 빠지지 않았는가
- 목록 key가 index가 아닌 안정적인 ID인가
- loading/empty/error 상태가 모두 있는가

## 품질 체크
- `npm run lint`
- `npm run build`
- 변경 도메인 수동 확인

## 코멘트 기준
- 회귀 가능성이 높은 것부터 적는다.
- 스타일 취향보다 동작/권한/상태 정합성을 우선한다.
