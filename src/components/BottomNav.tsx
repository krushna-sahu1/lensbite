"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, HomeIcon, SettingsIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/insights", label: "Insights", icon: ChartIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

/** Bottom navigation. The active tab is marked with `aria-current="page"`. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-around px-2 pt-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 transition ${
                  active ? "text-accent-ink" : "text-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                    active ? "bg-accent-soft" : ""
                  }`}
                >
                  <Icon width={22} height={22} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className={`text-[11px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
