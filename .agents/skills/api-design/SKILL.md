---
name: api-design
description: altteulmap의 Next.js route handler API 설계 규칙
origin: altteulmap
---

# API Design

Altteulmap의 API는 `Next.js Route Handler + zod + session helper` 기준으로 설계한다.

## 언제 확인할지
- `src/app/api/**` 경로를 새로 만들 때
- 댓글, 북마크, 가격 제보, 관리자 검토 같은 쓰기 API를 추가할 때
- 검색/필터 query parameter를 늘릴 때

## 프로젝트 규칙
- 읽기/쓰기 성공 응답은 지금 저장소의 기존 shape를 최대한 유지한다.
- 인증 없음은 `401`, 권한 부족은 `403`, 대상 없음은 `404`, 검증 오류는 `400` 또는 `422`를 쓴다.
- 서버 내부 에러 메시지나 stack trace는 응답에 노출하지 않는다.
- 입력은 route 진입 후 바로 검증한다.
- 관리자 전용 API는 page 보호와 route 보호를 둘 다 둔다.

## 응답 원칙
- list API
  - `items`, `count`, `source`, `filters`처럼 화면에서 바로 쓰는 필드를 유지
- action API
  - `ok`, `message`, 필요 시 `item` 또는 `preview`
- 인증 API
  - 현재 사용자나 role이 분명히 드러나야 한다

## query parameter 규칙
- 검색어는 `q` 또는 route 내부 `query`로 받아도 한쪽으로 정규화한다.
- 범위 검색은 `scope=viewport|global`처럼 값 집합을 제한한다.
- bbox처럼 숫자 query는 finite number 검증을 거친다.

## 점검 체크리스트
- zod 또는 동등한 검증이 있는가
- 401/403/404가 분리되어 있는가
- 관리자 기능이 일반 사용자에게 노출되지 않는가
- 클라이언트가 필요한 최소 필드만 반환하는가
- `cache: "no-store"`가 필요한 API에 빠지지 않았는가
- 같은 도메인 API끼리 응답 필드 이름이 일관적인가
