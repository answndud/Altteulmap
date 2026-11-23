# 0001. 로그인 세션을 DB에 둔다

상태: 채택 · 관련 코드: `src/worker/auth/session.ts`, `auth_sessions` 테이블

## 맥락
기존 세션은 `AUTH_SECRET`으로 서명한 JSON 쿠키(role·이메일 포함, 만료 30일)였다. 서버에 상태가 없어 로그아웃해도 탈취된 쿠키가 만료까지 유효했고, 관리자 강등도 쿠키 안의 role에는 반영되지 않았다.

## 결정
- 로그인 시 256bit 랜덤 토큰을 `altteulmap.session` 쿠키(HttpOnly, SameSite=Lax)로 내리고, DB에는 SHA-256 해시만 저장한다.
- 요청마다 `auth_sessions`와 `users`를 조인해 role·이메일을 최신으로 읽는다.
- 만료는 7일 고정이며 연장하지 않는다. 로그아웃은 행 삭제, 전체 폐기는 `revokeUserSessions`다.
- DB가 없는 mock 모드(`USE_MOCK_DATA=true`)에서만 서명 쿠키를 쓴다.

## 대안과 버린 이유
- **서명 쿠키 유지(stateless)**: DB 조회가 없어 빠르지만 폐기·강등 즉시 반영이 불가능하다. 이 서비스는 관리자 기능이 있어 즉시 폐기가 더 중요하다.
- **Workers KV 세션**: 읽기는 빠르지만 최종 일관성이라 로그아웃 직후에도 짧게 유효할 수 있고, 이미 쓰는 Postgres 하나로 충분하다.
- **sliding 만료**: 편하지만 탈취 토큰의 수명이 늘어난다. 7일 후 재로그인을 택했다.

## 결과와 한계
- 요청마다 인덱스 조회 1회가 추가된다(PK 조회 + users 조인). 현재 트래픽에서는 무시할 수 있다.
- 토큰 해시만 저장하므로 DB가 유출돼도 쿠키를 만들 수 없다.
- 만료된 행은 cron(`scheduled`)이 정리한다.
