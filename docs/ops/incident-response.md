# 프로덕션 장애 대응 런북

## 감지 신호

- `5xx` 비율, DB 연결 실패·timeout, 외부 OAuth/Turnstile timeout, 요청 제한 저장소 오류를 우선 확인한다.
- 모든 Worker 응답의 `X-Request-Id`와 구조화 로그의 `requestId`, 경로, 메서드, 오류 이름을 함께 조회한다.
- 사용자 입력·토큰·비밀번호·연결 문자열은 로그와 사건 기록에 복사하지 않는다.

## 초기 대응

1. `/api/health?deep=1`의 runtime, public-config, auth-providers, database, static-assets 상태를 확인한다.
2. 최근 배포와 migration hash를 확인하고, DB 장애인지 코드 배포인지 분리한다.
3. DB 장애면 mock 전환으로 숨기지 않고 503 상태를 유지하며 연결 고갈·공급자 상태를 확인한다.
4. 영향이 계속되면 Cloudflare에서 이전 호환 Worker 버전으로 code rollback을 검토한다. 이미 적용된 migration은 되돌리지 않는다.

## 외부 제공자 장애

- OAuth/Turnstile/Naver 호출은 제한 시간 초과를 사용자 일반 오류로 끝내고 자동 재시도하지 않는다.
- OAuth 장애 중에는 인증 쿠키를 발급하지 않으며, 공개 쓰기 장애 중에는 성공 응답을 반환하지 않는다.
- provider 복구 후 `SMOKE_REQUIRE_ADMIN=true npm run smoke:remote`와 관리자 읽기 smoke를 실행한다.

## 종료 조건

- 5xx·timeout 추세가 정상화되고 deep health와 원격 smoke가 통과한다.
- 영향받은 데이터와 관리자 감사 기록을 확인하고 필요하면 `backup-restore.md` 절차로 복구한다.
- 원인, 영향 시간, `requestId` 표본, 배포·migration 상태, 재발 방지 조치를 사건 기록에 남긴다.

## 알림 기준과 담당

- Cloudflare 로그 또는 연결된 오류 수집기에서 5분 이동 창의 `5xx >= 5%`, DB unavailable 3회 연속, read timeout 3회 연속을 운영 알림으로 설정한다.
- 알림에는 route, status, latency, `requestId`만 포함하고 요청 본문·쿠키·토큰·연결 문자열은 포함하지 않는다.
- 1차 담당자는 배포를 중지하고 health·migration 상태를 확인하며, 데이터 영향이 의심되면 백업 복구 담당자 승인 전까지 쓰기 경로를 차단한다.
