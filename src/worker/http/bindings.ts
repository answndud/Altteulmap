/** Cloudflare Workers의 정적 자산 바인딩(`ASSETS`). 라우트별 Bindings 타입이 공유한다. */
export type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};
