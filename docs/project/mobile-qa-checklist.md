# Mobile QA Checklist

기준일: 2026-04-27

## 목적
- Phase B 실기기 QA를 iPhone Safari 1대, Android Chrome 1대 기준으로 빠르게 반복할 수 있게 한다.
- 기능 파손 여부만 확인하고, 디자인 polish 평가는 범위에서 제외한다.

## 대상 URL
- public: `https://altteulmap.altteul-lab.workers.dev`
- admin: `https://altteulmap-admin.altteul-lab.workers.dev`

## 기록 규칙
- 각 항목은 `pass`, `fail`, `skip` 중 하나로 기록한다.
- `fail`이면 재현 조건과 화면/로그를 같이 남긴다.
- 같은 이슈가 public/admin에 같이 보이면 한 번만 적고 영향 범위를 명시한다.

## Device Matrix

| Device | Browser | OS | Status | Notes |
| --- | --- | --- | --- | --- |
| iPhone | Safari | 미기록 | pass | 사용자 실기기 QA 결과 문제 없음 |
| Android | Chrome | 미기록 | pass | 사용자 실기기 QA 결과 문제 없음 |

## Public Flow

### 1. 첫 진입
- 홈 진입 후 지도 패널이 바로 보인다
- 첫 화면에서 `현재 위치`, `이 지역 검색`, `목록 보기`가 보인다
- 첫 진입 시 페이지 멈춤이나 흰 화면이 없다

### 2. 현재 위치
- `현재 위치` 탭 시 권한 요청이 정상 노출된다
- 권한 허용 후 지도가 현재 위치 근처로 이동한다
- 권한 거부 후에도 앱이 깨지지 않고 안내가 유지된다

### 3. 지도 재조회
- 지도를 손으로 이동한 뒤 `이 지역 검색`을 탭하면 새 영역 기준으로 결과가 다시 보인다
- 클러스터와 개별 마커가 둘 다 노출된다
- 확대/축소 후 지도 반응이 멈추지 않는다

### 4. 목록/상세 시트
- `목록 보기` 탭 시 목록 시트가 열린다
- 목록 시트를 드래그로 올리고 내릴 수 있다
- 목록에서 장소 탭 시 상세 시트가 열린다
- 상세 시트를 드래그로 닫을 수 있다

### 5. 공개 쓰기 핵심
- 익명 장소 등록 1회
- 익명 가격 제보 1회
- 익명 신고 1회
- 각 제출 후 성공/실패 메시지가 명확하다

## Admin Flow

### 1. 로그인
- `/login` 진입이 정상 동작한다
- 운영자 계정 로그인 후 `/admin` 또는 `/admin/reports`로 이동한다
- 로그인 후 로그아웃 버튼이 보인다

### 2. 관리자 큐
- `/admin/places` 진입
- `/admin/prices` 진입
- `/admin/reports` 진입
- 세 화면 모두 멈춤 없이 열린다

### 3. AI 패널
- 장소 등록 카드에 `AI 1차 검수` 패널이 보인다
- 가격 제보 카드에 `AI 1차 검수` 패널이 보인다
- 신고 카드에 `AI 1차 검수` 패널이 보인다

## Latest Result

```text
Date: 2026-04-27
Build: live workers.dev
Tester: user

Device: iPhone / Safari / iOS version not recorded
- First load: pass
- Current location allow: pass
- Current location deny: pass
- Map refresh: pass
- Cluster zoom: pass
- List sheet drag: pass
- Detail sheet drag: pass
- Anonymous submit: pass
- Anonymous price report: pass
- Anonymous report: pass
- Admin login: pass
- Admin queues: pass
- AI panels: pass
- Notes: 사용자 실기기 QA 결과 문제 없음.

Device: Android / Chrome / Android version not recorded
- First load: pass
- Current location allow: pass
- Current location deny: pass
- Map refresh: pass
- Cluster zoom: pass
- List sheet drag: pass
- Detail sheet drag: pass
- Anonymous submit: pass
- Anonymous price report: pass
- Anonymous report: pass
- Admin login: pass
- Admin queues: pass
- AI panels: pass
- Notes: 사용자 실기기 QA 결과 문제 없음.
```

## Result Template

```text
Date:
Build:
Tester:

Device: iPhone / Safari / iOS version
- First load: pass/fail/skip
- Current location allow: pass/fail/skip
- Current location deny: pass/fail/skip
- Map refresh: pass/fail/skip
- Cluster zoom: pass/fail/skip
- List sheet drag: pass/fail/skip
- Detail sheet drag: pass/fail/skip
- Anonymous submit: pass/fail/skip
- Anonymous price report: pass/fail/skip
- Anonymous report: pass/fail/skip
- Admin login: pass/fail/skip
- Admin queues: pass/fail/skip
- AI panels: pass/fail/skip
- Notes:

Device: Android / Chrome / Android version
- First load: pass/fail/skip
- Current location allow: pass/fail/skip
- Current location deny: pass/fail/skip
- Map refresh: pass/fail/skip
- Cluster zoom: pass/fail/skip
- List sheet drag: pass/fail/skip
- Detail sheet drag: pass/fail/skip
- Anonymous submit: pass/fail/skip
- Anonymous price report: pass/fail/skip
- Anonymous report: pass/fail/skip
- Admin login: pass/fail/skip
- Admin queues: pass/fail/skip
- AI panels: pass/fail/skip
- Notes:
```
