type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};

export type AuthBindings = {
  ASSETS: AssetFetcher;
  AUTH_ADMIN_PASSWORD?: string;
  AUTH_DEMO_PASSWORD?: string;
  AUTH_SECRET?: string;
  AUTH_KAKAO_CLIENT_ID?: string;
  AUTH_KAKAO_CLIENT_SECRET?: string;
  AUTH_NAVER_CLIENT_ID?: string;
  AUTH_NAVER_CLIENT_SECRET?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: {
    connectionString?: string;
  };
  NEXTAUTH_URL?: string;
  SITE_URL?: string;
  USE_MOCK_DATA?: string;
};

export type AuthRouteDependencies<TBindings extends AuthBindings> = {
  noStoreHeaders: Record<string, string>;
  runWorkerDatabaseRoute<T>(env: TBindings, load: () => Promise<T>): Promise<T>;
};
