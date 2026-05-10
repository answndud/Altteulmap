import { useCallback, useEffect, useState } from "react";

export type SessionUser = {
  email?: string | null;
  name?: string | null;
  role?: "user" | "admin" | null;
};

type SessionResponse = {
  user?: SessionUser;
};

export function useSession() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as SessionResponse;
      })
      .then((session) => {
        setSessionUser(session?.user ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSessionUser(null);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const clearSession = useCallback(() => {
    setSessionUser(null);
  }, []);

  return { clearSession, sessionUser };
}
