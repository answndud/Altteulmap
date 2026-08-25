# Dead Code·Dependency 정리 감사 — 2026-08-25

## 결론

현재 안전하게 삭제할 수 있는 dead code나 미사용 dependency는 확인되지 않았다. 동작을 줄이기 위한 형식적인 삭제는 수행하지 않았으며, 실제 import·entrypoint·routing·build-time 사용을 확인한 항목만 유지했다.

## 확인 결과

- `npm run hygiene:dead-code`의 Knip 결과는 0건이다.
- `@hookform/resolvers`, `react-hook-form`, `react-router-dom`, `hono`, `drizzle-orm`, `postgres`, `zod`는 각각 client form, routing, Worker API, PostgreSQL schema/query/runtime에서 사용한다.
- `@axe-core/playwright`, `playwright`, `drizzle-kit`, `wrangler`, `vite`는 테스트·migration·배포·build entrypoint에서 사용한다.
- Tailwind/PostCSS 패키지는 Vite/PostCSS 설정과 CSS build convention에서 사용하므로 import가 없다는 이유로 삭제하지 않았다.
- `npm audit --omit=dev --audit-level=moderate`는 취약점 0건이다.

## 유지 판단

단일-use wrapper와 mock/production 분기는 현재 Worker runtime·E2E·로컬 개발 계약을 연결하므로, 호출 지점과 환경 convention을 함께 바꾸지 않고 제거하면 회귀 위험이 있다. 다음 dependency 변경 시 `npm ci`, `npm run build`, `npm run verify:quality`, production dependency audit를 필수 검증으로 유지한다.

## 증거 명령

```bash
npm run hygiene:dead-code
npm audit --omit=dev --audit-level=moderate
npm run build
```
