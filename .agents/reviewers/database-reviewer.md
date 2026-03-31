# Database Reviewer

Drizzle/PostgreSQL 관련 변경은 아래 기준으로 검토한다.

## 우선 체크
- 조회 조건에 맞는 인덱스가 있는가
- foreign key/상태 컬럼/createdAt 기반 관리자 조회가 느려지지 않는가
- schema 변경이 기존 데이터와 충돌하지 않는가
- 파생값 저장과 원본 제보 저장이 구분되어 있는가
- mock fallback과 DB 경로의 반환 shape가 동일한가

## altteulmap 도메인 체크
- `places`, `price_items`, `price_reports`, `comments`, `bookmarks`, `admin_actions` 간 연결이 맞는가
- 관리자 승인 전 데이터와 공개 데이터가 분리되는가
- 대표 가격과 가격 이력의 책임이 섞이지 않는가
- 댓글/가격 제보 추가 시 운영자 추적 정보가 남는가

## 명령
- `npm run db:generate`
- `npm run db:push`
- `npm run db:seed`

## 금지
- migration 없이 schema만 바꾸기
- 운영자 검토가 필요한 상태를 enum/상태값 없이 암묵적으로 처리하기
