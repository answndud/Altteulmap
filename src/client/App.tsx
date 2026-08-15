import { Link, NavLink, Route, Routes } from "react-router-dom";

import { useSession } from "@/client/lib/useSession";
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
  { href: "/submit", label: "장소 제보" },
  { href: "/bookmarks", label: "저장한 장소" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { clearSession, sessionUser } = useSession();

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

    clearSession();
    window.location.assign("/");
  }

  return (
    <div className="min-h-dvh bg-[var(--altteul-bg-canvas)] text-[var(--altteul-text-primary)]">
      <header className="border-b border-[var(--altteul-surface-border)] bg-[var(--altteul-bg-surface)]/95 px-4 py-3">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-base font-bold text-[var(--altteul-text-strong)]">
            알뜰맵
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  [
                    "rounded-[0.7rem] px-3 py-2 font-medium transition",
                    isActive
                      ? "bg-[var(--altteul-primary)] text-white"
                      : "text-[var(--altteul-text-secondary)] hover:bg-[var(--altteul-bg-subtle)] hover:text-[var(--altteul-text-strong)]",
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
                  className="altteulmap-badge px-3 py-2 text-xs font-medium"
                >
                  {sessionUser.role === "admin"
                    ? "운영자"
                    : sessionUser.name || "내 계정"}
                </span>
                {sessionUser.role === "admin" ? (
                  <Link
                    to="/admin"
                    data-testid="session-admin-link"
                    className="rounded-[0.7rem] bg-[var(--altteul-text-strong)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--altteul-text-primary)]"
                  >
                    운영
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  data-testid="sign-out-button"
                  className="rounded-[0.7rem] px-3 py-2 text-sm font-medium text-[var(--altteul-text-secondary)] transition hover:bg-[var(--altteul-bg-subtle)] hover:text-[var(--altteul-text-strong)]"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                to="/login"
                data-testid="session-login-link"
                className="rounded-[0.7rem] px-3 py-2 text-sm font-medium text-[var(--altteul-text-secondary)] transition hover:bg-[var(--altteul-bg-subtle)] hover:text-[var(--altteul-text-strong)]"
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
        <Route path="/map" element={<MapRoute />} />
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
