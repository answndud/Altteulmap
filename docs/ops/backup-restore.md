# PostgreSQL 백업·복구 런북

## 목적

알뜰맵의 장소, 가격 이력, 댓글, 신고, 관리자 감사 기록을 복구 가능한 상태로 운영한다. 애플리케이션 rollback은 데이터 rollback을 의미하지 않으므로, 데이터 복구는 별도 승인 절차로 수행한다.

## 운영 기준

- 목표 RPO: 24시간 이내. Supabase 프로젝트의 PITR 사용 시 공급자 계약의 실제 보존 기간을 별도로 기록한다.
- 목표 RTO: 4시간 이내. 복구 리허설에서 복구 시작부터 읽기 전용 smoke 통과까지 측정한다.
- production DB는 애플리케이션 계정과 분리된 백업 권한으로 백업한다.
- 백업 파일과 복구 자격 증명은 저장소·CI 로그·개발자 노트북에 저장하지 않는다.

## 배포 전 확인

1. `npm run db:check:production`으로 연결 대상, migration history, invalid data를 읽기 전용 확인한다.
2. 최근 백업/PITR 시점과 보존 기간을 공급자 콘솔에서 확인한다.
3. `PRODUCTION_DATABASE_URL`이 production 대상인지 두 명이 검토한다.
4. 스키마 변경은 `scripts/migrate-production.mjs`의 preflight와 호환 가능한 expand-then-contract 순서를 따른다.

## 복구 리허설

1. production이 아닌 별도 PostgreSQL 대상에 최근 백업 또는 PITR 시점을 복구한다.
2. `ALLOW_LOCAL_MIGRATION=1 npm run db:migrate`는 disposable 대상에서만 실행한다.
3. `npm run db:check:production`으로 migration history와 핵심 테이블을 확인한다.
4. `SMOKE_PUBLIC_URL`과 관리자 계정으로 `SMOKE_REQUIRE_ADMIN=true npm run smoke:remote`를 실행한다.
5. 복구 시간, 누락 데이터, smoke 결과, 로그의 `requestId`를 기록한다.

## 배포 중단·롤백

- Worker 배포가 중단되면 이전 호환 버전으로 코드만 rollback하고, 이미 적용된 migration은 역방향으로 되돌리지 않는다.
- migration 실패 시 트래픽을 유지하지 말고 `npm run db:check:production`으로 history와 핵심 불변조건을 재확인한다.
- 데이터 변경이 필요하면 forward-fix migration을 별도로 만들고, destructive SQL은 백업 복구 승인 없이 실행하지 않는다.
- 복구 후 `GET /api/health?deep=1`, `SMOKE_REQUIRE_ADMIN=true npm run smoke:remote`, 핵심 읽기·관리자 권한 검증을 순서대로 통과시킨다.

## 사고 시 데이터 변경

- 실수로 인한 삭제·오염은 즉시 쓰기 경로를 차단하고 마지막 정상 시점과 영향 범위를 보존한다.
- 복구 대상과 시점은 운영자 승인 후 결정한다. 원본 production DB에 직접 덮어쓰지 말고 복구 DB에서 검증한다.
- 애플리케이션 버전과 migration hash를 함께 기록하고, 복구 후 읽기 smoke와 관리자 권한 smoke를 통과시킨 뒤 트래픽을 전환한다.

## 완료 기록

리허설 날짜, 백업/PITR 시점, 복구 DB, RPO/RTO, 검증 명령, 결과, 담당자, 다음 조치를 운영 변경 기록에 남긴다.
