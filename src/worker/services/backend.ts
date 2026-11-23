import {
  isWorkerDatabaseEnabled,
  isWorkerMockDataEnabled,
  type WorkerDatabaseBindings,
} from "@/worker/db";
import { DomainError } from "@/worker/http/api-error";

/**
 * 저장소 구현 선택(DB / mock / 미설정)을 서비스 조립 지점 한 곳으로 모은다.
 * 라우트는 이 분기를 모르고, 설정이 없으면 DATABASE_UNAVAILABLE DomainError가 던져진다.
 */
export function selectBackend<T>(
  env: WorkerDatabaseBindings,
  backends: { database: () => T; mock: () => T },
  unavailableMessage: string,
): T {
  if (isWorkerDatabaseEnabled(env)) {
    return backends.database();
  }

  if (isWorkerMockDataEnabled(env)) {
    return backends.mock();
  }

  throw new DomainError("DATABASE_UNAVAILABLE", unavailableMessage);
}
