import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";

import { BookmarksRoute } from "@/client/routes/BookmarksRoute";
import { MapRoute } from "@/client/routes/MapRoute";
import { LoginRoute } from "@/client/routes/LoginRoute";
import { PlaceDetailRoute } from "@/client/routes/PlaceDetailRoute";
import { ReportRoute } from "@/client/routes/ReportRoute";
import { SignupRoute } from "@/client/routes/SignupRoute";
import { SubmitRoute } from "@/client/routes/SubmitRoute";
import { AdminRoutes } from "@/client/routes/admin/AdminRoutes";

const navItems = [
  { href: "/", label: "지도" },
  { href: "/submit", label: "제보" },
  { href: "/bookmarks", label: "북마크" },
  { href: "/admin", label: "관리자" },
];

type SessionUser = {
  email?: string | null;
  name?: string | null;
  role?: "user" | "admin" | null;
};

type SessionResponse = {
  user?: SessionUser;
};

function Shell({ children }: { children: React.ReactNode }) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as SessionResponse;
      })
      .then((session) => {
        if (!isMounted) {
          return;
        }

        setSessionUser(session?.user ?? null);
      })
      .catch(() => {
        if (isMounted) {
          setSessionUser(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/signout", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        callbackUrl: "/",
        json: "true",
      }),
    }).catch(() => null);

    setSessionUser(null);
    window.location.assign("/");
  }

  return (
    <div className="min-h-dvh bg-[var(--altteul-bg-canvas)] text-[var(--altteul-text-primary)]">
      <header className="border-b border-stone-200/70 bg-[var(--altteul-bg-surface)]/95 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-base font-semibold text-stone-950">
            알뜰맵
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 py-2 transition",
                    isActive
                      ? "bg-[var(--altteul-accent)] text-white"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            {sessionUser ? (
              <>
                <span
                  data-testid="session-user-badge"
                  className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600"
                >
                  {sessionUser.email ?? sessionUser.name ?? "로그인됨"}
                </span>
                {sessionUser.role === "admin" ? (
                  <Link
                    to="/admin"
                    data-testid="session-admin-link"
                    className="rounded-full bg-stone-900 px-3 py-2 text-sm text-white transition hover:bg-stone-700"
                  >
                    운영
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  data-testid="sign-out-button"
                  className="rounded-full px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                to="/login"
                data-testid="session-login-link"
                className="rounded-full px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
              >
                로그인
              </Link>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<MapRoute />} />
        <Route path="/place/:id" element={<PlaceDetailRoute />} />
        <Route path="/submit" element={<SubmitRoute />} />
        <Route path="/report" element={<ReportRoute />} />
        <Route path="/bookmarks" element={<BookmarksRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/signup" element={<SignupRoute />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </Shell>
  );
}
