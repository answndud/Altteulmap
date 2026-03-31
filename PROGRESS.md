# PROGRESS.md

기준일: 2026-03-31

## 진행 현황 요약
- Cycle 0: 프로젝트 로컬 기반, DB 경로, 지도 탐색, 장소 상세, 등록, 신고, 북마크, 관리자 검토, 로컬 인증, 네이버 지도 연동 완료
- Cycle 1: 현재 위치 버튼, viewport 재조회, 모바일 목록 바텀시트, 모바일 상세 시트 기초 정리 완료
- Cycle 2: `PLAN.md`/`PROGRESS.md` 운영 문서 형식 정비, 지역/전역 검색, 검색 URL 상태 반영 완료
- 다음 우선순위: 댓글 작성/삭제, 기존 장소 가격 추가 제보, 관리자 가격 검토 흐름

## 실행 로그

### 2026-03-31: Cycle 2 완료 (문서 체계 정비와 지도 검색/URL 상태 반영)
- 완료 내용
  - `/Users/alex/project/townpet/PLAN.md`와 `/Users/alex/project/townpet/PROGRESS.md` 형식을 참고해 현재 문서를 `기준일 -> 운영 규칙/요약 -> Active Plan/실행 로그` 구조로 재작성했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에 검색 UI를 추가해 `q`, `scope(viewport/global)` 상태를 URL에 반영하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`는 지역 검색일 때만 viewport bbox를 API에 보내고, 전체 검색일 때는 bounds 없이 검색 결과를 유지하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`에 텍스트 검색 조건을 추가해 mock/DB 양쪽에서 이름, 주소, 지역, 대표 가격 라벨 등으로 검색 가능하게 만들었다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`는 전체 검색 결과가 들어왔을 때 해당 결과 중심으로 한 번 이동할 수 있게 조정했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/queries.ts`
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`
- 검증 결과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `curl -s --max-time 10 'http://localhost:3001/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=global'` 응답 확인
  - `curl -s --max-time 10 'http://localhost:3001/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=viewport&minLat=37.58&maxLat=37.60&minLng=127.00&maxLng=127.03'` 응답 확인
  - `curl -I -s --max-time 10 'http://localhost:3001/map?q=%EA%B9%80%EB%B0%A5&scope=global'` 응답 확인
- 메모
  - 사용자가 이미 띄워 둔 `next dev` 인스턴스는 `localhost:3000`에서 별도로 돌고 있었고, 전역 검색 런타임 검증은 충돌을 피하기 위해 production server `localhost:3001`에서 수행했다.

### 2026-03-31: Cycle 1 완료 (지도 viewport 조회와 모바일 바텀시트 정리)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`에 bbox 조회 파라미터를 추가했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`에 viewport bounds 필터를 추가했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 현재 위치 버튼과 지도 idle 기준 viewport 보고 구조를 넣었다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 모바일 목록 바텀시트를 추가했고, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 모바일 하단 시트 형태로 조정했다.
- 검증 결과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `curl 'http://localhost:3000/api/places/map?minLat=37.58&maxLat=37.60&minLng=127.00&maxLng=127.03'`로 bbox 조회 응답 확인
- 메모
  - 상세 시트는 현재도 usable 상태지만 모바일 스냅/제스처 감각은 추가 polish가 필요하다.

### 2026-03-31: Cycle 0 완료 (로컬 기반과 핵심 MVP 흐름 구축)
- 완료 내용
  - Next.js, OpenNext/Cloudflare 대비 구조, Docker Postgres, Drizzle 스키마, seed 경로를 정리했다.
  - 지도 탐색, 장소 상세, 등록, 신고, 북마크, 관리자 장소 승인/신고 검토 흐름을 연결했다.
  - Auth.js credentials 로그인과 네이버 지도 SDK 연동을 붙였다.
  - 첫 화면을 지도 중심으로 재정리하고, 개발용 안내 문구를 걷어냈다.
- 검증 결과
  - 각 단계에서 `npm run lint`, `npm run build`, `npm run db:push`, `npm run db:seed`를 반복 검증했다.
  - 로컬 DB에서 장소 제보, 신고 생성, 관리자 승인/상태 변경, 북마크 저장/해제까지 확인했다.
- 메모
  - 현재 로컬 `.env`, Docker Postgres, 네이버 지도 키가 이미 준비돼 있어 다음 cycle은 기능 확장에 바로 들어갈 수 있다.

## 다음 작업
1. 장소 상세 시트에 댓글 작성/삭제 추가
2. 기존 장소 가격 추가 제보 UI와 API 추가
3. 관리자 가격 검토/반영 흐름 설계
4. 쓰기 API rate limit 초안 추가
