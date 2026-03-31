---
name: database-migrations
description: altteulmap의 Drizzle/PostgreSQL 마이그레이션 규칙
origin: altteulmap
---

# Database Migrations

Altteulmap는 `Drizzle + PostgreSQL`을 사용한다. schema 변경은 항상 migration과 함께 다룬다.

## 언제 확인할지
- `src/db/schema.ts`를 수정할 때
- `drizzle/*.sql`이 새로 생길 때
- 데이터 backfill이 필요한 기능을 추가할 때
- 운영자 기능 때문에 기존 컬럼/인덱스를 바꿀 때

## 프로젝트 규칙
- 프로덕션 기준으로는 migration이 진실의 원본이다.
- `db:push`는 로컬 개발 편의용이다. 배포 전에는 생성된 SQL을 읽고 검토한다.
- schema 변경과 대량 data backfill은 한 migration에 섞지 않는다.
- 이미 커밋된 migration SQL은 재작성하지 않는다. 새 migration으로 보정한다.
- nullable -> backfill -> constraint 강화 순서를 기본으로 한다.

## 기본 절차
1. `src/db/schema.ts` 수정
2. `npm run db:generate`
3. 생성된 `drizzle/*.sql` 검토
4. 로컬 DB 반영: `npm run db:push`
5. 필요 시 시드 재적용: `npm run db:seed`
6. 결과를 `PROGRESS.md`에 기록

## 점검 체크리스트
- 새 foreign key/조회 조건에 필요한 인덱스가 있는가
- `NOT NULL` 추가가 기존 데이터와 충돌하지 않는가
- 대표 가격/검증 상태 같은 파생값을 한 번에 강제하지 않는가
- 댓글/가격 제보처럼 쓰기량이 늘어날 테이블에 조회 기준 인덱스가 있는가
- 운영자 검토 흐름에서 필요한 상태 컬럼이 충분한가

## 금지
- 운영 DB를 수동 SQL로만 수정하기
- 배포된 migration을 덮어쓰기
- 큰 테이블에 즉시 `NOT NULL` 강제하기
- 앱 코드보다 먼저 기존 컬럼을 제거하기
