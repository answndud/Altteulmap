---
name: verification-loop
description: altteulmap의 로컬 검증 루프
origin: altteulmap
---

# Verification Loop

큰 변경 뒤에는 코드 작성과 별개로 검증 루프를 한 번 더 돈다.

## 언제 실행할지
- feature 단위 구현이 끝났을 때
- 커밋 직전
- push 직전
- DB schema, auth, map, admin flow를 건드렸을 때

## 기본 명령
```bash
npm run verify:quick
npm run verify
```

## 프로젝트 기준 절차
1. `npm run verify:quick`
2. `npm run verify`
3. 변경 도메인 수동 확인
   - 지도: `/map`, 검색, 상세 시트
   - 인증: `/login`, 보호 페이지 진입
   - 등록/신고: 제출 후 관리자 큐 반영
   - DB 변경: `db:push`, 필요 시 `db:seed`
4. `PROGRESS.md`에 검증 명령과 결과 기록

## 수동 확인 예시
```bash
curl -s 'http://localhost:3000/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=global'
curl -s 'http://localhost:3000/api/bookmarks'
curl -s 'http://localhost:3000/api/admin/reports'
```

## 실패 시 규칙
- `lint` 실패면 코드부터 수정한다.
- `build` 실패면 타입/서버 컴포넌트/route contract를 먼저 본다.
- 수동 검증 실패면 원인과 미해결 상태를 `PROGRESS.md`에 남긴다.
