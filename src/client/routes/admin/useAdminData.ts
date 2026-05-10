import { useEffect, useState } from "react";

import { loadAdminSession } from "@/client/routes/admin/api";
import type { LoadState } from "@/client/routes/admin/types";

export function useAdminData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function run() {
      setState({ status: "loading" });

      try {
        const user = await loadAdminSession();

        if (!active) {
          return;
        }

        if (!user) {
          setState({ status: "unauthenticated" });
          return;
        }

        if (user.role !== "admin") {
          setState({ status: "forbidden", user });
          return;
        }

        const data = await load();

        if (active) {
          setState({ status: "ready", user, data });
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "관리자 데이터를 불러오지 못했습니다.",
        });
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [load]);

  return state;
}
