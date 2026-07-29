# 제출 체크리스트

## 제출 전 채워야 할 개인정보/링크
- [ ] 이름
- [ ] 이메일
- [ ] 전화번호 또는 연락 가능한 메신저
- [ ] GitHub URL
- [ ] 운영 서비스 URL: `https://altteulmap.altteul-lab.workers.dev`
- [ ] 포트폴리오 대표 저장소 URL
- [ ] 개인 블로그 또는 회고 글 URL, 있으면 추가
- [ ] 관리자 화면을 보여줄 방식 결정
  - [ ] credential 공개 없이 캡처/README/E2E로 설명
  - [ ] 면접 중 화면 공유에서만 로그인
  - [ ] 데모 전용 admin credential 별도 생성
- [ ] 제출서에 첨부할 주요 문서 링크 3개만 선별
  - 추천 1: `README.md`
  - 추천 2: `docs/migration-next-to-vite-react.md`
  - 추천 3: `docs/project/production-hardening-report-2026-05-08.md`

## 금지 표현과 대체 표현

| 금지 표현 | 문제 | 대체 표현 |
| --- | --- | --- |
| “AI로 대부분 만들었습니다.” | 책임을 AI에 넘기는 인상이다. | “AI를 요구사항 구조화와 구현 가속에 사용했고, 최종 품질은 테스트와 smoke로 검증했습니다.” |
| “열심히 했습니다.” | 평가 기준과 연결되지 않는다. | “공개 제출에서 관리자 승인 후 검색 노출까지 E2E로 확인했습니다.” |
| “풀스택을 다 할 수 있습니다.” | 추상적이다. | “Vite React SPA, Worker API, PostgreSQL schema, 관리자 화면, Cloudflare 배포까지 한 저장소에서 연결했습니다.” |
| “운영 경험이 있습니다.” | 어느 수준인지 불명확하다. | “운영 URL, Supabase DB, Worker deploy, remote smoke, DB timeout, health check, security headers를 적용했습니다.” |
| “AI 검수를 구현했습니다.” | 자동 판단으로 오해될 수 있다. | “AI 1차 검수는 운영자 판단을 돕는 suggestion layer이며, 최종 승인/반려는 관리자가 합니다.” |
| “대규모 서비스에도 대응 가능합니다.” | 과장으로 들린다. | “대규모 트래픽 경험은 없지만, map API 측정, bbox index, DB timeout, Hyperdrive trigger를 준비했습니다.” |
| “최신 기술을 사용했습니다.” | 기술 나열로 보인다. | “운영 표면적을 줄이기 위해 Vite React SPA와 Cloudflare Worker API를 단일 runtime으로 통합했습니다.” |

## 제출 본문 최종 점검
- [ ] 첫 문단에 “문제 해결력, 실행력, AI-native 작업 방식, 검증 책임”이 드러난다.
- [ ] 프로젝트를 “지도 앱”이 아니라 “가격 정보 신뢰성과 운영 반영 문제를 해결한 서비스”로 설명했다.
- [ ] AI 활용 경험이 자동완성 사용기가 아니라 계획, 구현, 검증, 운영 문서화까지 연결되어 있다.
- [ ] 실제 증거 링크가 3개 이상 있다.
- [ ] 운영 URL이 열리는지 확인했다.
- [ ] GitHub 저장소가 public이거나 접근 가능한 상태인지 확인했다.
- [ ] README의 스크린샷이 현재 UI와 크게 어긋나지 않는다.
- [ ] 관리자 credential, `.env`, secret, 운영 DB URL 같은 민감 정보가 제출서에 들어가지 않는다.
- [ ] 학력/자격증 중심 설명을 넣지 않았다.
- [ ] “제가 다 만들었습니다”보다 “무엇을 어떻게 구조화하고 검증했는지” 중심으로 썼다.
- [ ] 약점을 숨기지 않고 방어 가능한 문장으로 바꿨다.
- [ ] 문장이 과장되어 있지 않다.

## 면접 전 최종 점검
- [ ] 운영 서비스 첫 화면 접속 확인
- [ ] 지도 marker, 목록, 상세 시트 확인
- [ ] 제출 form 접속 확인
- [ ] 관리자 화면 데모 방식 확인
- [ ] `README.md`, `docs/migration-next-to-vite-react.md`, `docs/project/production-hardening-report-2026-05-08.md`를 브라우저 탭으로 열어 둔다.
- [ ] `tests/e2e/submission-admin.spec.ts`와 `tests/e2e/price-review.spec.ts`를 열어 둔다.
- [ ] 공격 질문에 대한 답변을 1분 이내로 말할 수 있게 연습한다.
- [ ] “AI 한계와 검증 방식” 답변을 외우지 말고, 실제 검증 스크립트 이름과 연결해서 말한다.

## 제출 직전 문장 점검
아래 문장 중 하나를 자기소개/지원 이유 마지막에 넣으면 좋다.

- “저는 AI를 더 빨리 만드는 도구로 쓰지만, 더 쉽게 책임을 회피하는 도구로 쓰지는 않습니다.”
- “알뜰맵에서 제가 증명하고 싶은 것은 특정 프레임워크 지식보다, 모호한 문제를 구조화하고 실제 작동 결과로 닫는 방식입니다.”
- “Fellowship에서도 같은 방식으로 고객 요구를 기술 문제로 번역하고, AI와 함께 속도를 올리되 검증 책임은 끝까지 가져가겠습니다.”
