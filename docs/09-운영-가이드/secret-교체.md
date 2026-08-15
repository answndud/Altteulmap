# Secret 교체

## 현재 관리 경계

운영 secret과 공개 var는 Cloudflare Worker binding으로 관리한다. 저장소, 문서, 로그에 실제 값을 기록하지 않는다. 주요 키는 DATABASE_URL, AUTH_SECRET, OAuth client secret, TURNSTILE_SECRET_KEY, admin/demo password이며, 공개 map key와 Turnstile site key는 secret과 구분한다.

## 교체 절차 초안

1. 새 값을 Cloudflare secret으로 준비한다.
2. dual-read 또는 동시 유효 기간이 필요한지 확인한다.
3. AUTH_SECRET 교체 시 기존 session 전부가 만료될 수 있음을 공지한다.
4. provider callback redirect와 Turnstile 검증을 read-only/허용된 테스트로 확인한다.
5. 이전 값을 폐기하고 로그·CI secret의 잔존을 확인한다.

실제 운영 secret 교체와 provider 회전은 이 저장소에서 실행하지 않았다. secret 값 자체를 출력하는 명령은 사용하지 않는다.
