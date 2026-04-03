# PLAN.md

기준일: 2026-04-01  
목표: Altteulmap를 `지도 기반 절약 장소 탐색 + 가격 제보` 서비스 기준에서 MVP 완성도와 출시 준비 수준까지 끌어올린다.

## 운영 규칙
- 세션 시작: `PLAN.md` -> `PROGRESS.md` -> `prd.md` -> `trd.md` 순서로 먼저 확인
- 작업 시작: 대상 cycle 또는 작업 상태를 `in_progress`로 바꾼 뒤 구현 시작
- 작업 종료: `PROGRESS.md`에 결과/검증/블로커 기록 후 `PLAN.md` 상태 갱신
- cycle 내 모든 작업이 끝나면 제목에 `(완료)` 표시
- 블로커 발생 시 두 문서를 즉시 같이 수정
  - `PLAN.md`: 계획/우선순위/의존성 수정
  - `PROGRESS.md`: 실제 이슈와 우회 경로 기록

## 범위 원칙
- 우선순위: `지도 Read MVP -> 쓰기 데이터 축적 -> 운영 품질 -> 인증/출시 -> 확장 기능`
- MVP 원칙: 지도 탐색과 가격 데이터 축적이 흔들리면 확장 기능은 뒤로 미룬다
- 현재 정책: `비회원 읽기, 비회원 반응, 비회원/회원 공개 쓰기(장소 등록/댓글/신고/가격 제보), 회원 전용 북마크`를 기본값으로 유지한다
- 별도 정책 결정 전 보류:
  - 커뮤니티 `bang`
  - 핫딜 `deal`
  - 좋아요 랭킹

## 현재 우선순위
1. 운영 도메인 기준 출시 준비: credentials 로그인/회원가입 경로, 반복 가능한 검증 절차, canonical/robots/sitemap, Cloudflare 배포 체크리스트
2. 운영 품질 후속 정리: rate limit 수치 조정, 관리자 UX polish, 캐시/재검증 보강
3. 공개 UI polish: 헤더 간소화, 개발 문구 제거, 버튼/칩 줄바꿈 방지, 지도/상세 밀도 정리
4. 확장 기능 1차: 플레이스 좋아요/싫어요 반응 모델과 UI 우선 도입
5. 확장 기능 2차: 공유/사진 업로드 범위와 우선순위 재결정
6. repo-local 개발 워크플로우 유지: `.agents` skills/reviewers, `.githooks`, `verify` 스크립트

## 현재 제품 상태

### 구현 완료
- `/` 진입 시 지도 첫 화면 제공
- 네이버 지도 연동과 preview fallback
- 현재 위치 버튼
- viewport 기반 장소 재조회
- 카테고리 필터
- 지역/전역 검색
- 장소 상세 시트와 개별 상세 페이지
- 북마크
- 장소 등록/신고
- 관리자 장소 승인/반려
- 관리자 신고 검토
- 댓글 작성/삭제
- 기존 장소 가격 제보
- 관리자 가격 제보 검토 큐
- 관리자 가격 직접 수정/대표 지정/숨김
- 관리자 visit/activity telemetry와 방문 지표 overview
- 플레이스 좋아요/싫어요 반응
- 비로그인 visitor cookie 기반 좋아요/싫어요
- 지도 목록 좋아요 노출
- 대표 가격 재계산과 동일 가격 2회 검증 처리
- 쓰기 API 최소 rate limit
- 로컬 Auth.js credentials 로그인
- Docker + Drizzle + PostgreSQL 로컬 개발 경로
- sitemap/robots/canonical/기본 metadata

### 부분 구현
- 모바일 바텀시트 UX
  - 모바일 목록/상세는 inset drawer와 접기 패널 기준으로 재정리했다. 다만 제스처 스냅 감각과 더 미세한 모션 polish는 추가 여지가 있다
- 검색 URL 상태
  - 검색어/검색 범위는 반영되지만 지도 중심/줌 상태까지는 아직 URL에 싣지 않음
- 출시 준비
  - robots, sitemap, canonical, `smoke:local`, `deploy:check`, Playwright E2E 기본 흐름, credentials 로그인/가입/북마크/신고/관리자 승인/관리자 가격 검토 E2E, GitHub Actions CI, Cloudflare Builds 기준 배포 체크 문서는 정리 중이고, 현재 E2E는 세 그룹 실행 기준으로 반복 가능하다. Cloudflare 무료 플랜 기준 번들 경량화와 실제 `workers.dev` 배포까지는 통과했다. shell/CI env 우선 배포 체크와 split worker 빌드도 정리됐고, 남은 일은 live 운영 도메인 값으로 실제 배포를 끝내는 마지막 적용 단계다
- 관리자 분리
  - 관리자 실제 구현은 `src/features/admin/pages`, `src/features/admin/api`에 있고, public 앱의 `/admin`, `/api/admin`은 `entrypoints`를 통해 embedded/external 모드를 바꿀 수 있다. `cf:build:public`은 이제 관리자 route를 제거하지 않고 external redirect/API stub 모드로 빌드되며, `apps/admin` 별도 Next/OpenNext 빌드와 `deploy:check:public`, `deploy:check:admin` 경로도 정리됐다. 남은 일은 실제 `workers.dev` 또는 custom domain에 운영 적용하는 마지막 배포 단계다
- 인증
  - 로그인/회원가입 진입면과 로컬 credentials는 운영 가능한 수준으로 정리됐고, 현재는 credentials 회원가입까지 동작한다. 카카오/네이버 OAuth scaffolding은 선택적으로 남겨 두되, 제품 필수 인증 경로와 검증은 credentials 기준으로 유지한다
- 반응 기능
  - 상세/상세 시트/지도 마커/지도 목록 반영까지 들어갔다. 별도 랭킹 화면은 아직 없다
- 공유 기능
  - 상세 페이지와 상세 시트에서 링크 공유는 가능하지만, 목록 단위 공유나 공유 유입 추적은 아직 없다

### 미구현 핵심
- 좋아요 랭킹
- 사진 업로드
- 테스트 체계
  - 지도/상세/비회원 좋아요/공유, 모바일 목록 시트/상세 시트, credentials 로그인/회원가입, 익명 댓글, 익명 장소 등록, 북마크, 익명 신고 제출/관리자 상태 변경, 익명 가격 제보/관리자 반려, 관리자 장소 승인 기준 Playwright E2E는 들어갔다. 현재는 DB 기반 `signup/bookmarks/map`, mock runtime의 `map.mobile`, DB 기반 `comments/price-review/report-admin/submission-admin` 세 그룹으로 반복 실행한다. 운영 도메인 기준 smoke와 더 깊은 모바일 제스처 검증은 더 필요하다
- 커뮤니티 `bang`
- 핫딜 `deal`

## Active Plan

### Cycle 9: 외부 착한가격업소 데이터 적재 (완료)
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 행정안전부 `착한가격업소` 사이트의 목록/엑셀/상세 구조를 분석해 1차 수집 경로와 필터 기준을 확정한다 | Codex | P1 | `done` | `/bssh/bsshList.do`, `/bssh/bsshPageExcel.do`, `/bssh/bsshInfo.json`의 역할, 좌표/상세/가격 데이터 차이, robots/rate limit 고려사항, `1만원 이하 1천건` 선별 기준과 적재 전략이 `PROGRESS.md`에 정리된다 | `PLAN.md`, `PROGRESS.md`, 외부 사이트 구조 |
| `착한가격업소` 실제 데이터를 더미 데이터 대신 넣을 수 있도록 수집 스크립트, 정규화 매핑, 좌표 확보 전략, import seed 경로를 구현한다 | Codex | P1 | `done` | 공식 다운로드 또는 페이지 수집으로 원천 데이터가 로컬 파일/테이블에 저장되고, `1만원 이하` 기준과 업종/지역 매핑이 정규화되며, 좌표는 목록 페이지 좌표 또는 별도 geocoding으로 채워지고, 최소 1천건이 앱에서 조회 가능하며, 검증 로그가 `PROGRESS.md`에 남는다 | 수집 설계 확정, `src/db/**`, import script, geocoding 경로, 검증 |
| importer의 선별 quota를 `서울 500 + 비서울 500`, `음식점 70%` 기준으로 재조정한다 | Codex | P1 | `done` | 기본 `data:goodprice` 실행 결과가 `대표 가격 1만원 이하`, `서울 500`, `비서울 500`, `음식점 700`, `비음식 300`을 동시에 만족하고, bucket 집계와 검증 결과가 `PROGRESS.md`/`README.md`에 남는다 | `scripts/import-goodprice.ts`, `src/features/places/imported-goodprice.json`, `data/goodprice/import-meta.json`, 문서 |

### Cycle 10: 관리자 앱 분리 1차 (완료)
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 관리자 페이지/API의 실제 구현을 공유 모듈로 고정하고, public 앱과 별도 `apps/admin` 앱이 같은 구현을 재사용하도록 정리한다 | Codex | P1 | `done` | `src/features/admin/pages`, `src/features/admin/api`가 관리자 실제 구현의 기준이 되고, public 앱의 `/admin`, `/api/admin`은 `entrypoints`를 통해 embedded/external 모드를 스위치할 수 있으며, `apps/admin`이 별도 Next 앱으로 빌드되고, `ADMIN_APP_URL` 기준 외부 관리자 앱 전환 경로와 검증 결과가 문서에 남는다 | `src/app/admin/**`, `src/app/api/admin/**`, `src/features/admin/**`, `src/lib/admin-app.ts`, `apps/admin/**`, `package.json`, Cloudflare 배포 문서 |

### Cycle 7: repo-local AI workflow setup (완료)
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| ECC에서 필요한 부분만 가져와 altteulmap 저장소 하위에 repo-local skills, reviewer guides, verify script, git hooks를 구성하고 전역 설정 없이 활성화한다 | Codex | P2 | `done` | `.agents/skills`, `.agents/reviewers`, `.githooks`, `scripts/git-hooks`가 추가되고, `npm run hooks:install`, `npm run verify`가 동작하며, `AGENTS.md`/`README.md`/`PLAN.md`/`PROGRESS.md`에 사용 규칙과 검증 결과가 반영된다 | `AGENTS.md`, `README.md`, `package.json`, `.githooks/**`, `scripts/git-hooks/**` |

### Cycle 8: 로컬 개발/검증 안정화 (완료)
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 로컬 `next dev`가 build/start/e2e와 `.next`를 공유하며 깨지는 문제를 막고, 재기동 없이 페이지 전환이 계속 가능한 상태로 정리한다 | Codex | P1 | `done` | dev 서버는 production build/start/e2e 산출물과 캐시를 분리해 사용하고, Turbopack `.sst/.meta` 손상이나 `Another write batch or compaction is already active` 오류가 재발하지 않도록 기본 스크립트/설정이 조정되며, 복구 명령과 검증 결과가 `README.md`와 `PROGRESS.md`에 남는다 | `package.json`, `next.config.ts`, `.gitignore`, `README.md`, `PROGRESS.md` |

### Cycle 2: 문서 체계 정비와 지도 검색/URL 상태 반영 (완료)
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| `townpet`의 문서 형식을 참고해 `PLAN.md`/`PROGRESS.md`를 운영 문서 형태로 재정리하고, `/map`에 지역/전역 검색과 URL 상태 반영을 추가한다 | Codex | P1 | `done` | 문서는 `운영 규칙/현재 우선순위/Active Plan/실행 로그` 구조를 갖고, 지도는 `q/scope` 기반 검색을 지원하며, `/api/places/map`가 지역/전역 검색을 모두 처리하고, lint/build/runtime 검증 결과가 `PROGRESS.md`에 남는다 | `PLAN.md`, `PROGRESS.md`, `prd.md`, `trd.md`, `src/app/map/page.tsx`, `src/features/places/map-explorer.tsx`, `src/features/places/repository.ts`, `src/app/api/places/map/route.ts` |

### Cycle 3: 댓글과 기존 장소 가격 추가 제보
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 장소 상세 시트 안에서 댓글 작성/삭제와 기존 장소 가격 추가 제보 흐름을 구현하고, 관리자 검토와 연결한다 | Codex | P1 | `done` | 로그인 사용자가 상세 시트에서 댓글을 작성/삭제할 수 있고, 기존 장소에 새 가격 항목을 제보할 수 있으며, 관리자 화면에서 새 가격 제보를 검토할 수 있고, 기본 검증 결과가 `PROGRESS.md`에 기록된다 | `src/app/place/[id]/page.tsx`, `src/features/places/place-detail-sheet.tsx`, `src/features/places/repository.ts`, `src/features/submission/**`, `src/app/admin/**`, DB schema |

### Cycle 4: 운영 품질과 관리자 가격 관리
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 가격 검증/대표 가격 산정과 관리자 가격 수정 흐름을 정리하고, 쓰기 API에 최소 rate limit을 추가한다 | Codex | P1 | `done` | 가격 대표값 산정 규칙이 코드와 화면에서 일치하고, 운영자가 가격 항목을 수정/비활성화할 수 있으며, 장소 등록/신고/댓글/가격 제보 API에 최소 rate limit이 들어가고, 관련 검증이 `PROGRESS.md`에 남는다 | `trd.md`, `src/features/places/repository.ts`, `src/app/api/places/**`, `src/app/api/reports/**`, 관리자 페이지, DB schema |

### Cycle 5: 인증 정리와 출시 준비
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 로그인 상태 액션과 운영자 대시보드를 운영 가능한 수준으로 확장한다 | Codex | P1 | `done` | 로그인 사용자는 주요 화면 상단에서 계정 라벨과 로그아웃 버튼을 볼 수 있고, 운영자 사용자는 관리자 진입 링크와 `/admin` overview에서 장소 등록/가격 제보/신고 큐, 사용자 수, 현재 세션 수 같은 즉시 계산 가능한 지표를 확인할 수 있으며, 방문 수/활성 사용자 수는 별도 방문 이벤트 적재 기준으로 정의된 2차 작업 계획이 같이 남는다 | `src/app/**`, `src/features/auth/**`, `src/features/**/repository.ts`, `src/db/schema.ts`, `PLAN.md`, `PROGRESS.md`, `prd.md`, `trd.md`, 테스트 |
| public/admin 공통 헤더에 브랜드 로고와 핵심 이동 액션을 올려 모든 페이지에서 홈 복귀와 주요 이동을 일관되게 제공한다 | Codex | P1 | `done` | public 앱과 별도 admin 앱의 공통 레이아웃에 `알뜰맵` 로고, `장소 등록하기`, `북마크`, `로그인/로그아웃`, `운영자 관리` 액션이 공통 헤더로 제공되고, 기존 페이지별 중복 액션 블록은 제거되며, 현재 경로 기준 로그인/로그아웃 callback과 admin 진입 링크가 유지되고 검증 결과가 `PROGRESS.md`에 남는다 | `src/app/layout.tsx`, `apps/admin/src/app/layout.tsx`, `src/components/**`, `src/features/map/map-page.tsx`, `src/app/**`, `src/features/admin/pages/**`, `PROGRESS.md` |
| visit/activity 이벤트 적재를 추가해 관리자 대시보드에 방문 수와 DAU/WAU를 노출한다 | Codex | P1 | `done` | 방문 이벤트가 visitor/session 기준으로 저장되고, `/admin` overview에서 오늘/7일 방문 수, 고유 방문자 수, DAU/WAU, 재방문율 같은 활동 지표를 확인할 수 있으며, dedupe/rate limit/보존 정책과 검증 로그가 문서에 남는다 | `src/db/schema.ts`, migration, `src/app/**` 또는 middleware, `src/features/admin/**`, `PLAN.md`, `PROGRESS.md`, `trd.md`, 테스트 |
| 배포/점검 스크립트가 쉘·CI env를 로컬 `.env*`보다 우선 사용해 운영 URL과 split 배포 값이 덮어쓰이지 않게 정리한다 | Codex | P1 | `done` | `deploy:check`와 public/admin build 스크립트는 `.env`, `.env.production`, `.env.local`, `.env.production.local`을 읽더라도 이미 주입된 쉘/CI env를 덮어쓰지 않고, split 배포용 `NEXTAUTH_URL`/`ADMIN_APP_URL`/`SITE_URL` 점검 결과와 문서 로그가 `PROGRESS.md`에 남는다 | `scripts/check-cloudflare-deploy.mjs`, `scripts/build-public-worker.mjs`, env loading helper, `README.md`, 배포 문서 |
| 공개 지도 가격 필터를 제거하고 지도/검색 흐름을 단순화한다 | Codex | P1 | `done` | 공개 지도에서 가격 필터 UI, `maxPrice` URL/API 계약, 관련 Playwright 회귀와 제품 문서가 함께 제거되고, 카테고리/검색 범위 기반 탐색은 유지되며, 검증과 로그가 `PROGRESS.md`에 남는다 | `src/features/map/map-page.tsx`, `src/features/places/map-explorer.tsx`, `src/app/api/places/map/route.ts`, `src/features/places/repository.ts`, `tests/e2e/**`, `PLAN.md`, `PROGRESS.md`, `prd.md`, `trd.md` |
| 공개 UI polish 후속으로 모바일 헤더를 1줄 기준으로 줄이고, 홈을 map-first 레이아웃으로 다시 정리하며, auth/등록 화면의 상단 chrome과 카드 레이어를 감량한다 | Codex | P1 | `done` | 모바일 전역 헤더는 첫 화면을 과도하게 차지하지 않고, 홈은 모바일/데스크톱 모두 지도 시작 위치가 더 앞당겨지며, 로그인/회원가입/장소 등록 화면은 중복 네비와 설명 없이 입력/액션 중심 레이아웃으로 정리되고, 관련 검증과 로그가 `PROGRESS.md`에 남는다 | `src/components/global-header.tsx`, `src/components/brand-mark.tsx`, `src/features/map/map-page.tsx`, `src/features/auth/**`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/submit/page.tsx`, `src/features/submission/place-submit-form.tsx`, `PROGRESS.md` |
| 로컬 credentials 중심 인증을 실제 로그인/회원가입 경로로 확장하고, 핵심 사용자 흐름 테스트/SEO/배포 체크리스트를 정리한다 | Codex | P2 | `in_progress` | 로컬 credentials 로그인/회원가입과 선택적 소셜 가입 진입면, 지도 탐색/모바일 시트/익명 장소 등록/북마크/신고/관리자 승인/관리자 가격 검토 E2E가 반복 가능하게 정리되고, sitemap/canonical/metadata와 Cloudflare 배포 체크리스트가 최신 상태가 된다 | `src/auth.ts`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, 테스트 코드, `README.md`, `trd.md` |
| 공개 UI polish 2차로 인증 진입면은 액션 중심으로 다시 단순화하고, 지도 필터/검색 칩은 줄바꿈 대신 가로 레일로 정리한다 | Codex | P1 | `done` | `/login`, `/signup`은 설정성 패널 없이 로그인/가입 액션에만 집중하고, 지도 화면의 모바일/데스크톱 필터 칩과 검색 범위 칩은 과도한 줄바꿈 없이 가로 스크롤 또는 compact 배치로 정리되며, 관련 검증과 문서 로그가 `PROGRESS.md`에 남는다 | `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/features/auth/**`, `src/features/map/map-page.tsx`, `src/app/globals.css`, E2E/verify |
| 모바일 공개 지도 UX와 인증 진입면을 모바일 우선 기준으로 다시 정리한다 | Codex | P1 | `done` | 모바일에서 검색 외 필터는 접기 가능하고, 목록/상세 시트가 더 위로 올라오며, 로그인/회원가입이 기능 집중형 단일 카드 구조로 정리되고 관련 검증 로그가 `PROGRESS.md`에 남는다 | `src/app/map/page.tsx`, `src/features/places/map-explorer.tsx`, `src/features/places/place-detail-sheet.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx` |
| 모바일 지도 UX 후속 정리로 전역 헤더와 시트 레이어 충돌을 없애고, 모바일 시트를 safe-area 기준 bottom sheet로 줄이며, 저줌 개요에서는 cluster/place 혼재를 줄인다 | Codex | P1 | `done` | 모바일 목록/상세 시트는 헤더 위에서 안정적으로 열리고, 닫기 액션이 항상 보이며, 시트는 화면을 과도하게 덮지 않고 safe-area를 고려하며, 모바일 개요 지도에서는 cluster와 place가 동시에 난잡하게 섞여 보이지 않도록 marker 정책 또는 스타일이 분리되고, 관련 검증과 로그가 `PROGRESS.md`에 남는다 | `src/components/global-header.tsx`, `src/features/places/map-explorer.tsx`, `src/features/places/place-detail-sheet.tsx`, `src/features/map/naver-map-panel.tsx`, `src/features/places/repository.ts`, 모바일 E2E |
| 모바일 지도에서 cluster 확대 뒤에도 개별 place marker가 다시 노출되도록 client-side suppression 회귀를 제거한다 | Codex | P1 | `done` | 모바일 viewport 탐색에서 초기 overview는 cluster가 많더라도, 지도를 확대하거나 cluster를 통해 범위를 좁힌 뒤 서버가 place marker를 반환하면 클라이언트가 이를 다시 숨기지 않아야 하며, 관련 verify/mobile 검증 로그가 `PROGRESS.md`에 남는다 | `src/features/places/map-explorer.tsx`, 모바일 검증, `PROGRESS.md` |
| 모바일 지도에서 확대 후 다시 축소하면 overview 구간에서는 place marker를 다시 cluster 중심으로 되돌린다 | Codex | P1 | `done` | 모바일 viewport 탐색에서 개별 place marker가 노출된 뒤 다시 overview zoom으로 축소하면 개별 place marker가 과도하게 남지 않고 cluster 중심 개요로 돌아와야 하며, 확대 상태에서는 이전 회귀처럼 place marker가 다시 숨겨지지 않고 관련 검증 로그가 `PROGRESS.md`에 남는다 | `src/features/places/map-explorer.tsx`, 모바일 검증, `PROGRESS.md` |
| 공개 지도의 초기 payload와 렌더 밀도를 줄여 실데이터 1000건에서도 첫 진입/이동이 버벅이지 않게 만든다 | Codex | P1 | `done` | 지도 첫 화면과 `/api/places/map`는 상세용 배열 없이 가벼운 preview payload만 사용하고, 클라이언트는 마커/목록 렌더 개수를 제한해도 전체 개수와 상세 진입 흐름은 유지하며, 관련 검증/측정 결과가 `PROGRESS.md`에 남는다 | `src/features/places/types.ts`, `src/features/places/repository.ts`, `src/features/map/map-page.tsx`, `src/app/api/places/map/route.ts`, `src/features/places/map-explorer.tsx`, `src/features/map/naver-map-panel.tsx`, `src/features/places/place-detail-sheet.tsx`, 테스트/문서 |
| 공개 지도 첫 진입에서 viewport 결과 1000건을 SSR하지 않고, 초기 bootstrap bounds만 렌더한 뒤 client fetch로 전환한다 | Codex | P1 | `done` | viewport 모드의 `/` 첫 렌더는 지도 bootstrap bounds와 빈 preview 목록만 내려주고, 실제 장소 목록은 map idle 이후 `/api/places/map`로 채워지며, 글로벌 검색 SSR과 상세 진입 흐름은 유지되고 검증 로그가 `PROGRESS.md`에 남는다 | `src/features/map/map-page.tsx`, `src/features/places/map-explorer.tsx`, `src/features/map/naver-map-panel.tsx`, `src/app/api/places/map/route.ts`, 문서/검증 |
| 공개 지도 map API와 글로벌 검색 preview 응답에 서버 cap과 total count를 도입해 네트워크 payload를 줄인다 | Codex | P1 | `done` | `listMapPlaces()`와 `/api/places/map`는 전체 매칭 수와 실제 반환 수를 분리해 전달하고, viewport/global 결과는 서버 상한 이내의 preview만 보내며, 지도/목록 UI는 전체 개수와 축약 안내를 유지하고 검증 로그가 `PROGRESS.md`에 남는다 | `src/features/places/repository.ts`, `src/app/api/places/map/route.ts`, `src/features/map/map-page.tsx`, `src/features/places/map-explorer.tsx`, 문서/검증 |
| 공개 지도 읽기에서 쓰는 카테고리/반응 요약을 `places`에 비정규화해 map query의 join과 집계를 줄인다 | Codex | P1 | `done` | `places`는 `primaryCategorySlug`, `likeCount`, `dislikeCount`를 유지하고, 지도/global preview 및 상세 읽기는 이 필드를 우선 사용하며, 카테고리/반응 쓰기 경로와 seed/migration/backfill이 함께 갱신되고 검증 로그가 `PROGRESS.md`에 남는다 | `src/db/schema.ts`, `drizzle/**`, `src/features/places/repository.ts`, `src/db/seed.ts`, 문서/검증 |
| 공개 지도의 마커 샘플링을 viewport/zoom 기반 클러스터 계층으로 바꿔 넓은 영역에서도 실제 마커 수를 낮춘다 | Codex | P1 | `done` | 지도는 서버 cap으로 받은 preview를 그대로 유지하되, 실제 렌더는 viewport/zoom 기준 cluster marker를 사용하고, 넓은 viewport에서도 초기/이동 마커 수가 크게 줄며, preview fallback과 실지도 모두 같은 클러스터 규칙을 쓰고 검증 로그가 `PROGRESS.md`에 남는다 | `src/features/places/map-explorer.tsx`, `src/features/map/naver-map-panel.tsx`, `src/features/map/naver-map-sdk.ts`, 문서/검증 |
| 공개 지도 map API를 목록용 `items`와 지도용 `mapMarkers`로 분리하고, 넓은 viewport는 서버 tile summary를 내려 네트워크 payload를 더 줄인다 | Codex | P1 | `done` | `/api/places/map`와 `listMapPlaces()`는 목록 패널에 필요한 preview와 지도 marker용 요약을 분리해 반환하고, 넓은 viewport에서는 개별 place 대신 tile/cluster summary가 내려오며, 클라이언트는 전체 개수/목록 UX를 유지한 채 marker payload를 더 적게 받고, 검증 로그가 `PROGRESS.md`에 남는다 | `src/features/places/repository.ts`, `src/app/api/places/map/route.ts`, `src/features/places/map-explorer.tsx`, `src/features/map/naver-map-panel.tsx`, 타입/문서/검증 |
| 공개 지도 viewport 무검색 경로의 cluster/tile 집계를 SQL 단계로 내려 넓은 영역 탐색 시 전체 place row 스캔과 메모리 후처리를 줄인다 | Codex | P1 | `done` | `viewport + query 없음` 경로에서 `count`, 목록용 `items`, 지도용 `mapMarkers`가 분리된 쿼리로 계산되고, 넓은 viewport에서는 SQL bucket aggregate가 cluster summary를 바로 내려주며, 기존 목록/상세 UX와 검증 로그가 유지된다 | `src/features/places/repository.ts`, `src/app/api/places/map/route.ts`, `PROGRESS.md`, 런타임 검증 |
| 공개 지도 bounds 기반 재조회에 짧은 서버 캐시를 넣고, 공개 데이터 쓰기 이후에는 즉시 비워 같은 viewport 연속 조회 비용을 줄인다 | Codex | P1 | `done` | `bounds`가 있는 `/api/places/map` 조회는 짧은 TTL 메모리 캐시를 재사용하고, 반응/가격 대표값/승인 같은 공개 지도 데이터 변경 후에는 캐시가 즉시 비워지며, 검증 로그가 `PROGRESS.md`에 남는다 | `src/features/places/repository.ts`, `src/app/api/places/map/route.ts`, 공개 쓰기 경로, `PROGRESS.md`, 런타임 검증 |
| 공개 지도의 플레이스 정렬 기능을 제거하고 검색/필터만 남긴다 | Codex | P1 | `done` | 지도 화면에서 정렬 UI와 `sort` query/API 계약이 제거되고, 공개 플레이스 목록은 고정 순서로 노출되며, 관련 테스트/문서/검증 로그가 같이 갱신된다 | `src/app/map/page.tsx`, `src/features/places/map-explorer.tsx`, `src/app/api/places/map/route.ts`, `src/features/places/**`, `tests/e2e/map.spec.ts`, 문서 |
| 공개 장소 등록을 텍스트 입력 중심으로 단순화하고, 운영자 승인 단계에서 위치를 확정한다 | Codex | P1 | `done` | 공개 등록 폼은 상호명/주소/가격 등 텍스트 입력만 받고, 공개 제출 API는 좌표 없이 접수되며, 위치/지도/링크 처리는 운영자 승인 단계에서 수행하도록 화면/API/문서/검증 로그가 같은 규칙으로 정리된다 | `src/features/submission/**`, `src/features/places/admin-place-review-form.tsx`, `src/app/api/places/route.ts`, `src/app/api/admin/places/[id]/route.ts`, `tests/e2e/submission-admin.spec.ts`, `prd.md`, `trd.md` |
| 장소 등록 진입/제출을 로그인 없이도 허용하고, 공개 CTA 문구를 `장소 등록` 기준으로 맞춘다 | Codex | P1 | `done` | 비로그인 사용자가 `/submit`에 바로 진입해 장소 등록 요청을 제출할 수 있고, 등록 API가 익명 제출을 허용하며, 공개 화면 CTA와 검증 로그가 `장소 등록` 기준으로 정리된다 | `src/app/submit/page.tsx`, `src/app/api/places/route.ts`, `src/app/map/page.tsx`, 테스트 코드 |
| 공개 쓰기 기능에서 북마크만 로그인 유지하고 댓글/신고/가격 제보는 익명 허용으로 전환하며, `비슷한 장소` UI를 제거한다 | Codex | P1 | `done` | 공개 상세/상세 시트/신고 페이지에서 댓글, 가격 제보, 신고가 로그인 없이 동작하고, 북마크만 로그인 요구를 유지하며, `비슷한 장소` 섹션과 관련 응답/문구/검증 로그가 정리된다 | `src/app/place/[id]/page.tsx`, `src/features/places/place-detail-sheet.tsx`, `src/app/report/page.tsx`, `src/app/api/places/**`, `src/app/api/reports/route.ts`, `src/features/places/repository.ts`, 테스트 코드, DB schema |

### Cycle 6: 반복 방문 기능 확장
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 플레이스별 좋아요/싫어요를 먼저 붙여 공개 카운트와 사용자 반응 저장을 제공하고, 이후 공유/사진 업로드 순서를 재판단한다 | Codex | P2 | `in_progress` | 공개 상세와 상세 시트에 좋아요/싫어요 UI가 생기고, visitor cookie 또는 로그인 사용자 기준으로 한 플레이스에 한 반응만 저장되며, 공개 읽기에는 카운트가 노출되고, route/schema/repository/DB migration/검증 결과가 `PROGRESS.md`에 남는다 | 벤치마크 분석 메모, `prd.md`, `trd.md`, `src/db/schema.ts`, `src/features/places/repository.ts`, `src/app/api/places/**` |

## 결정 메모
- 현재 계획 기준의 핵심 서비스는 여전히 `지도 + 가격 데이터`다.
- 벤치마크 사이트에서 영감을 받은 기능은 확장 후보로 유지하되, core loop를 약하게 만들 정도로 범위를 넓히지 않는다.
- 현재 익명 허용 범위는 `좋아요/싫어요`, `장소 등록`, `댓글`, `가격 제보`, `신고`까지다.
- 공개 쓰기 중 로그인 유지 기능은 현재 `북마크`만 남긴다. 운영자 기능은 기존처럼 별도 인증/권한 검사를 유지한다.
- 운영자 대시보드의 활동 지표는 `visit_activity` 테이블에 30분 bucket dedupe 기준으로 적재하고, 현재 `/admin` overview에서 오늘/7일 방문 수, 고유 방문자 수, DAU/WAU, 7일 재방문율을 노출한다.
