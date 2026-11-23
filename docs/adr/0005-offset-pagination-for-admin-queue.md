# 0005. 관리자 큐는 offset 페이지네이션을 쓴다

상태: 채택(재평가 조건 있음) · 관련 코드: `src/worker/routes/admin-support.ts`, `src/worker/admin/*`

## 맥락
관리자 큐(승인 대기 장소·가격·신고)는 운영자 소수가 조회하고, 정렬 기준이 생성 시각 하나이며 항목 수가 수백 개 이하다. 지도 조회는 별도로 bbox와 결과 상한(2,000)으로 제한한다.

## 결정
- `page`/`limit` offset 방식을 쓰고 `page`는 최대 1,000, `limit`은 서버 상한으로 자른다.
- 응답에 `count`, `returnedCount`, `truncated`를 넣어 잘림 여부를 알린다.

## 대안과 버린 이유
- **cursor(keyset)**: 깊은 페이지에서 `OFFSET`이 느려지는 문제가 없지만 정렬 키 조합마다 cursor 설계와 UI 변경이 필요하다. 지금 큐 크기에서는 얻는 것이 없다.

## 재평가 조건
- 큐가 수만 건 이상이 되거나 깊은 페이지(수백 번째) 조회가 느려지면 `(created_at, id)` keyset으로 바꾼다. 쓰기와 동시에 읽을 때 offset은 중복·누락이 생길 수 있다는 점도 한계다.
