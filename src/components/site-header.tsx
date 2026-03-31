import Link from "next/link";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/map", label: "지도" },
  { href: "/submit", label: "등록" },
  { href: "/bookmarks", label: "북마크" },
  { href: "/login", label: "로그인" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600"
        >
          Altteulmap
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 transition hover:bg-stone-100 hover:text-stone-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
