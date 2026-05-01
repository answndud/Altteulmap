import { Link, NavLink, Route, Routes } from "react-router-dom";

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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--altteul-bg-canvas)] text-[var(--altteul-text-primary)]">
      <header className="border-b border-stone-200/70 bg-[var(--altteul-bg-surface)]/95 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to="/" className="text-base font-semibold text-stone-950">
            알뜰맵
          </Link>
          <nav className="flex items-center gap-1 text-sm">
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
