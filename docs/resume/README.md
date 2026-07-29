# Sionic AI Native Engineer Fellowship 지원 문서 패키지

## 목적
이 폴더는 알뜰맵을 Sionic AI Native Engineer Fellowship 지원용 포트폴리오로 설명하기 위한 제출/면접 자료다. 핵심은 프로젝트를 예쁘게 포장하는 것이 아니라, 공고가 보는 기준인 문제 해결력, 실행력, AI-native 작업 방식, 검증 책임을 실제 저장소 증거와 연결하는 것이다.

## 읽는 순서
1. [`strategy.md`](strategy.md)
   - 공고가 실제로 평가하는 기준과 알뜰맵의 증거를 1:1로 매핑한다.
   - 어떤 사례를 전면에 내세우고, 어떤 약점을 어떻게 방어할지 정한다.
2. [`application-draft.md`](application-draft.md)
   - 지원서에 바로 붙여 넣을 수 있는 자기소개, 지원 이유, AI 활용 경험, 포트폴리오 설명 초안이다.
   - 제출 전 `[이름]`, `[GitHub URL]`, `[연락처]` 같은 개인 정보만 채우면 된다.
3. [`interview-playbook.md`](interview-playbook.md)
   - 30초 소개, 3분 프로젝트 설명, AI 활용 방식, 검증 방식, 공격 질문 대응을 정리한다.
   - 면접 전에 실제 운영 URL과 저장소 파일을 열어 두고 이 순서대로 데모한다.
4. [`submission-checklist.md`](submission-checklist.md)
   - 제출 전 개인정보/링크, 금지 표현, 최종 점검 항목을 확인한다.

## 핵심 포지셔닝
알뜰맵은 “지도 기반 저가 장소 탐색 서비스”이면서, Fellowship 지원 관점에서는 다음을 증명하는 포트폴리오다.

- 문제를 다시 정의했다: 저렴한 장소 정보가 SNS/커뮤니티에 흩어진 문제를 가격 중심 지도, 제보, 검수, 운영자 승인 흐름으로 재구성했다.
- 실행했다: Vite React SPA, Cloudflare Worker API, Supabase PostgreSQL, NAVER Maps, 관리자 화면, 공개 제보 흐름을 실제 배포 가능한 MVP로 만들었다.
- AI-native하게 일했다: AI를 단순 코드 생성 도구가 아니라 계획, UI critique, 마이그레이션 판단, 문서화, 검수 초안, 테스트 보강에 연결했다.
- 검증 책임을 졌다: lint/typecheck/unit/E2E/smoke/remote smoke/CI/deploy check/security header/DB migration 기준을 저장소와 운영 문서에 남겼다.

## 제출에 사용할 증거 링크
지원서에는 아래 링크를 우선 사용한다.

- 운영 서비스: [https://altteulmap.altteul-lab.workers.dev](https://altteulmap.altteul-lab.workers.dev)
- 관리자 화면: [https://altteulmap.altteul-lab.workers.dev/admin](https://altteulmap.altteul-lab.workers.dev/admin)
- 프로젝트 소개: [`../../README.md`](../../README.md)
- 제품 요구사항: [`../product/prd.md`](../product/prd.md)
- 기술 요구사항: [`../product/trd.md`](../product/trd.md)
- Next.js에서 Vite React로 이관한 기록: [`../migration-next-to-vite-react.md`](../migration-next-to-vite-react.md)
- Cloudflare 배포 가이드: [`../deploy/deploy-cloudflare.md`](../deploy/deploy-cloudflare.md)
- 운영 하드닝 결과: [`../project/production-hardening-report-2026-05-08.md`](../project/production-hardening-report-2026-05-08.md)
- CI 파이프라인: [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- 원격 smoke 스크립트: [`../../scripts/smoke-remote.mjs`](../../scripts/smoke-remote.mjs)
- 공개 제출에서 관리자 승인까지 닫힌 E2E: [`../../tests/e2e/submission-admin.spec.ts`](../../tests/e2e/submission-admin.spec.ts)
- 가격 제보 검수 E2E: [`../../tests/e2e/price-review.spec.ts`](../../tests/e2e/price-review.spec.ts)

## 제출 시 한 줄 포지션
저는 알뜰맵을 통해 흩어진 생활비 절약 정보를 실제 운영 가능한 지도 서비스로 구조화했고, AI를 계획과 구현 속도를 높이는 도구로 쓰되 최종 품질은 테스트, 배포, 운영 문서로 직접 책임지는 방식으로 일해 왔습니다.
