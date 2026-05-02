# PROGRESS.md

## Active 상태

Vite React 프론트 디자인 시스템 재정비의 1차 구현을 완료했다. 현재는 public 핵심 화면의 token/primitive/지도 탐색 UI를 정리했고, 남은 일은 수동 시각 QA와 admin 세부 화면 polish 여부 판단이다.

## 최근 확인
- Next.js에서 Vite + React로 이관하는 마이그레이션 작업은 사용자가 완료로 확정했다.
- 현재 active 문서가 비어 있었으므로 새 디자인 작업을 `PLAN.md`에 active로 등록했다.
- `.impeccable.md`의 system constraint를 Vite + React Router + Cloudflare Workers 기준으로 갱신했다.
- Claude Code의 캡처 기반 피드백은 그대로 코드 적용하지 않고, 다음 판단으로 재분류했다.
  - 타당함: 디자인 시스템 부재, 버튼 위계 약화, 카드 정보 위계 약화, 지도/list 관계 약화, 배지 의미 체계 부족, 검색/필터 명칭 모호함.
  - 그대로 적용 금지: Tailwind 기본 green 단순 치환, `letter-spacing` 음수 적용, 실제 metric 없는 추천 copy, admin route/test contract를 확인 없이 제거.
- 1차 구현 내용:
  - `src/client/styles.css`의 canvas/surface/text/border/primary/accent/status token을 OKLCH 기반으로 재정의했다.
  - 버튼, badge, input, panel, map overlay radius/shadow/focus 상태를 border 중심으로 정리했다.
  - 사용자 header에서 관리자 메뉴를 일반 nav에서 분리하고, admin 계정에만 운영 link를 표시한다.
  - 지도 탐색 화면의 검색 범위 문구를 `현재 지도 범위`/`전체 지역`으로 정리하고, desktop list rail을 side panel처럼 분리했다.
  - 장소 카드, 모바일 sheet, 빠른 비교 카드에서 `대표가 -> 가격 -> 장소명 -> 위치/검증/갱신` 순서가 먼저 읽히도록 바꿨다.
  - Naver map fallback/overlay/marker/cluster visual을 새 primary와 orange accent 기준으로 조정했다.
  - 장소 상세, 북마크, 제보, 신고 화면도 같은 token과 panel/card 체계로 맞췄다.
  - E2E strict locator 충돌을 피하도록 북마크 설명문에서 사용자 nickname 반복을 제거했다.
  - 로컬 screenshot 확인 중 primary button 텍스트 색이 variant cascade에 의해 어둡게 보이는 문제를 발견하고, primary button variant에 흰색 텍스트를 명시했다.
  - 사용자 피드백에 따라 초록 primary를 제거하고, 흰 배경을 유지하는 블루 primary 체계로 바꿨다.
  - 지도 화면은 max width, desktop map/list column 비율, map panel 높이를 조정해 이전보다 훨씬 큰 지도 중심 레이아웃으로 변경했다.

## 현재 디자인 기준
- 제품 톤: 생활형 가격 탐색 도구, 실속 있고 신뢰 가능한 로컬 지도.
- 방향: 브라운/초록 감성 UI를 줄이고, 흰 배경 위에 블루 primary와 발견/주의용 오렌지 accent를 제한적으로 사용한다.
- 원칙:
  - map first
  - price first
  - trust before charm
  - one surface depth at a time
  - mobile bottom sheet는 desktop card layout을 압축하지 않는다.

## 다음 액션
- 로컬 브라우저에서 `/`, `/place/:id`, `/submit`, `/report`, `/bookmarks`, `/login`, `/admin`의 실제 화면을 확인한다.
- 사용자가 1차 방향에 동의하면 admin 세부 route와 로그인/회원가입 화면까지 같은 token 밀도로 polish한다.
- 배포 전에는 `npm run smoke:vite:local` 또는 사용자가 요청한 배포 flow를 추가로 실행한다.

## Blocker
- 없음.

## 최근 검증
- `npm run design:detect:json` -> `[]`
- `git diff --check` -> 통과
- `npm run verify` -> 통과
- `npm run build` -> 통과
- `npm run test:e2e:smoke` -> 최초 실행 9 passed / 1 failed. 실패 원인은 북마크 화면에서 nickname이 session badge와 설명문에 중복 노출되어 Playwright strict locator가 2개를 찾은 것.
- `npm run test:e2e:smoke` 재실행 -> 10 passed
- `npx playwright screenshot --viewport-size=1440,1000 http://127.0.0.1:5173/ /tmp/altteulmap-home-after.png` -> 홈 화면 렌더 확인, primary button 텍스트 색 보정 확인
- 최종 `npm run design:detect:json` -> `[]`
- 최종 `npm run build` -> 통과
- 최종 `npm run verify` -> 통과
- 사용자 피드백 반영 후 `npx playwright screenshot --viewport-size=1440,1000 http://127.0.0.1:5173/ /tmp/altteulmap-home-blue-maplarge-2.png` -> 흰 배경, 블루 primary, 확대된 지도 레이아웃 확인
- 사용자 피드백 반영 후 `npm run verify` -> 통과
- 사용자 피드백 반영 후 `npm run build` -> 통과
- 사용자 피드백 반영 후 `npm run design:detect:json` -> `[]`
- 사용자 피드백 반영 후 `git diff --check` -> 통과
- 플레이스 클릭 시 지도 옆 floating rail이 지도 높이만큼 늘어나며 비어 보이는 문제를 수정했다. 오른쪽 목록/상세 rail을 지도 위 absolute panel로 바꾸고, 콘텐츠 높이만 사용하도록 `max-height`만 제한해 남는 영역은 지도가 보이게 했다.
- floating rail 수정 후 `npx playwright screenshot --viewport-size=1440,1000 http://127.0.0.1:5173/ /tmp/altteulmap-floating-rail-content-height.png` -> 패널 아래 영역이 지도 grid로 채워지는 것 확인
- floating rail 수정 후 `npm run verify` -> 통과
- floating rail 수정 후 `npm run design:detect:json` -> `[]`
- floating rail 수정 후 `git diff --check` -> 통과
- floating rail 수정 후 `npm run build` -> 통과
