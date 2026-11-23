# 0003. 가격 검수를 advisory lock과 조건부 UPDATE로 직렬화한다

상태: 채택 · 관련 코드: `src/worker/admin/admin-price-helpers.ts`, `admin-price-review-repository.ts`, `src/worker/services/price-report-rules.ts`

## 맥락
운영자 두 명이 같은 제보를 동시에 승인·반려하거나, 같은 장소·메뉴의 서로 다른 제보를 동시에 승인하면 상태가 두 번 바뀌거나 `verified` 판정이 어긋날 수 있다.

## 결정
- 제보 단위: 트랜잭션 시작에서 `pg_advisory_xact_lock(hashtextextended(reportId, 0))`.
- 같은 장소·정규화 라벨 그룹: 승인 경로에서 `(placeId:normalizedLabel)`로 한 번 더 잠근다.
- 상태 전이는 `UPDATE ... WHERE report_status = 'pending_review' RETURNING`으로 선점한다. 선점에 실패하면 `DomainError(CONFLICT)`다.
- 검증 기준은 서로 다른 제보자 2명 이상(`VERIFICATION_REPORTER_THRESHOLD`)이며 순수 함수로 분리해 단위 테스트한다.
- 공개 제보는 `submission_key`(장소·제보자·라벨·가격·단위의 SHA-256) unique와 `ON CONFLICT DO NOTHING`으로 재전송을 멱등 처리한다.

## 대안과 버린 이유
- **`SELECT ... FOR UPDATE`**: 대상 행이 있을 때만 잠글 수 있어 "아직 없는 price_item을 만드는" 그룹 직렬화에는 맞지 않는다.
- **낙관적 락(version 컬럼)**: 충돌 시 재시도 로직이 필요하고, 두 번째 요청을 빨리 실패시키면 되는 이 흐름에는 조건부 UPDATE가 더 단순하다.
- **SERIALIZABLE**: 재시도 처리가 전 구간에 퍼진다.

## 결과와 한계
- 잠금은 트랜잭션이 끝나면 풀리며 `lock_timeout`(2초)이 대기를 제한한다.
- 동시 승인 경합은 통합 테스트(`price-lifecycle.test.ts`)로 고정했다. 해시 충돌 가능성은 64bit라 이 규모에서 무시할 수 있다.
