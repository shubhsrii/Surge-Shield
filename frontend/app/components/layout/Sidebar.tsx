    "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/predictions", label: "Predictions & Analysis" },
  { href: "/recommendations", label: "AI Recommendations" },
  { href: "/insights", label: "Insights & Reports" },
  { href: "/about", label: "About" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-slate-950 border-r border-slate-800">
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="text-lg font-semibold">
          <span className="text-primary-500">Surge</span> Shield
        </div>
        <p className="text-xs text-slate-400 mt-1">
          AI Surge Operations Command
        </p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "flex items-center px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === link.href
                ? "bg-primary-500/10 text-primary-100"
                : "text-slate-300 hover:bg-slate-800 hover:text-slate-50"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
