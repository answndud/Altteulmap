# Next.js에서 Vite + React로 옮긴 이유와 과정

> 잘 돌아가던 Next.js 앱을 굳이 Vite + React + Cloudflare Worker로 옮겼다. 이유는 새 프레임워크가 더 멋져서가 아니라, 혼자 운영하는 작은 지도 서비스에 필요한 것은 더 많은 추상화가 아니라 더 선명한 경계였기 때문이다.

알뜰맵은 처음부터 거대한 서비스가 아니었다. 지도에서 저렴한 장소를 찾고, 가격 제보와 댓글, 신고를 받고, 운영자가 관리자 화면에서 이를 검토하는 서비스였다. 처음에는 Next.js가 합리적인 선택이었다. 페이지, API route, 인증, SEO, 배포를 한 프레임워크 안에서 묶을 수 있었기 때문이다.

하지만 Cloudflare Workers, OpenNext, public/admin split, Auth.js, PostgreSQL, 1인 운영, AI agent 협업이 겹치면서 구조가 점점 커졌다. 기능은 돌아갔지만, 문제가 생겼을 때 어디를 봐야 하는지 바로 좁히기 어려워졌다.

이 시리즈는 그 과정을 정리한 회고다. “Next.js가 틀렸다”는 이야기가 아니다. 한 프로젝트의 실제 요구와 운영 조건이 선명해질수록, 처음에는 합리적이었던 선택도 과해질 수 있다는 이야기다.

## 시리즈

1. [작은 지도 서비스에 Next.js는 왜 무거워졌나](./next-to-vite-01-why-nextjs-became-heavy.md)
2. [프레임워크를 바꿔도 기능은 바꾸지 않는다](./next-to-vite-02-preserving-contracts.md)
3. [로컬에서 되던 Vite 앱은 왜 배포에서 다시 깨졌나](./next-to-vite-03-production-cutover.md)

## 읽는 순서

이 시리즈는 세 질문에 답하는 구조다.

```text
1편: 왜 바꿨는가?
2편: 어떻게 기능을 깨지 않고 옮겼는가?
3편: 왜 배포와 운영 검증이 별도 문제였는가?
```

프레임워크 선택 자체가 궁금하다면 1편부터 읽으면 된다. 실제 마이그레이션 절차와 코드 경계가 궁금하다면 2편이 핵심이다. Cloudflare Worker 배포와 운영 시행착오가 궁금하다면 3편이 가장 실전적이다.

각 편은 독립적으로 읽을 수 있지만, 세 편을 순서대로 읽으면 다음 흐름이 보인다.

```text
선택의 이유
→ contract 보존 이관
→ production cutover와 운영 검증
```

## 전체 메시지

```text
작은 프로젝트일수록 강력한 프레임워크보다
명확한 경계와 검증 가능한 운영 구조가 더 중요하다.
```

핵심은 프레임워크 우열이 아니라 요구와 구조의 적합성이다. Vite + React + Worker가 모든 프로젝트에 더 낫다는 뜻도 아니다. 알뜰맵의 현재 단계에서는 지도 중심 SPA와 Worker API의 명확한 경계가 더 잘 맞았다는 뜻이다.

## 각 편의 역할

### 1편

Next.js를 처음 선택한 이유와, 왜 알뜰맵의 실제 요구와 점점 어긋났는지를 다룬다. 이 편은 구체적인 이관 코드보다 문제 정의와 의사결정에 집중한다.

### 2편

Vite + React + Worker로 옮기면서 API path, response shape, DB schema, env 이름, 인증 의미, admin 권한 정책을 어떻게 보존했는지 다룬다. 이 편은 contract 중심의 마이그레이션 전략을 설명한다.

### 3편

Cloudflare 배포와 production cutover에서 실제로 깨진 것들을 다룬다. build/deploy 설정, secret 누락, Worker DB lifecycle, remote smoke, old admin Worker 처리 같은 운영 이슈를 정리한다.

## 관련 글

- [Vite로 옮겼는데도 코드가 다시 무거워졌다](./vite-react-quality-refactor-retrospective.md)

마이그레이션 이후 React 코드 품질 하네스를 만들고, 접근성, 성능, CSP, dead-code, admin route 구조를 정리한 후속 회고다.
