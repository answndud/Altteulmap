# 0002. 공개 쓰기 rate limit을 Postgres에 둔다

상태: 채택 · 관련 코드: `src/worker/abuse/rate-limit-repository.ts`, `src/lib/rate-limit.ts`

## 맥락
공개 쓰기(장소 등록·댓글·가격 제보·신고·반응)와 로그인·가입은 익명으로 열려 있다. Workers는 isolate가 여러 개라 메모리 `Map`으로 센 카운터는 isolate마다 따로여서 사실상 제한이 되지 않는다.

## 결정
- 카운터는 `public_write_rate_limits`에 `INSERT ... ON CONFLICT DO UPDATE count + 1` 한 문장으로 올린다(원자적). 키는 `(scope, actor_key, bucket_started_at)`.
- 익명 요청은 쿠키를 버리고 새 visitor로 위장할 수 있으므로 `CF-Connecting-IP` 버킷(개인 한도의 3배)을 함께 소비한다. 공용 IP(학교·회사)를 고려한 배수다.
- 로그인은 IP를 분산해도 한 계정을 계속 시도할 수 없도록 계정 단위 버킷(3배)을 더한다.
- `x-forwarded-for`는 위조할 수 있어 키로 쓰지 않는다. 로컬처럼 `CF-Connecting-IP`가 없으면 IP 버킷을 건너뛴다(Cloudflare 엣지가 덮어쓰므로 운영에서는 항상 있다).
- 만료 행 삭제는 요청 경로가 아니라 cron에서만 한다.

## 대안과 버린 이유
- **Cloudflare Rate Limiting 규칙/Workers binding**: 정확하지만 별도 설정·과금이 필요하고, 행위자(회원/visitor) 단위 정책을 코드에서 표현하기 어렵다. 필요해지면 앞단에 추가한다.
- **KV**: 증가 연산이 원자적이지 않아 경계에서 새는 값이 생긴다.
- **Durable Object**: 가장 정확하지만 새 런타임 개념과 배포 단위가 늘어난다. 지금 규모에는 과하다.

## 결과와 한계
- 고정 윈도우라 윈도우 경계에서 최대 2배 burst가 가능하다.
- 쓰기 요청마다 DB 왕복이 1~2회 늘어난다. DB가 없을 때의 isolate 메모리 폴백은 효과가 제한적이며 mock 용도로만 의미가 있다.
