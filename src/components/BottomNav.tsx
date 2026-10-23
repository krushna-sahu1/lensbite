"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CameraIcon, ChartIcon, HomeIcon } from "./icons";
import { useLiveSessionContext } from "./LiveSessionProvider";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/insights", label: "Insights", icon: ChartIcon },
] as const;

/**
 * Bottom navigation: Home | Live | Insights. Live is a raised round button
 * docked in the middle of the bar. The bar itself never clips the button (no
 * overflow hidden) and pages pad by `--nav-clearance` so nothing sits under it.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { controller, state } = useLiveSessionContext();

  // The live screen is full-bleed and has its own controls; and the sign-in
  // screen is a standalone page.
  if (pathname === "/login" || state.status !== "idle") return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      style={{ paddingBottom: "var(--nav-safe)" }}
    >
      <div className="relative mx-auto w-full max-w-md">
        {/* Raised Live button: half above the bar, half docked into it. */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
          <span
            className="absolute inset-0 animate-[live-pulse_4s_ease-in-out_infinite] rounded-full bg-accent/60 blur-xl"
            aria-hidden="true"
          />
          <button
            type="button"
            // start() must run directly in the tap handler so mobile browsers allow audio.
            onClick={() => void controller.start()}
            aria-label="Go Live"
            className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-accent to-emerald-500 text-black shadow-[0_10px_30px_-8px_rgba(34,197,94,0.65)] ring-1 ring-white/40 transition active:scale-95"
          >
            <CameraIcon width={26} height={26} strokeWidth={2.2} />
          </button>
        </div>

        <ul className="grid grid-cols-3 items-stretch px-2 pt-2">
          <NavTab {...TABS[0]} active={pathname === TABS[0].href} />
          {/* Empty centre column: the raised Live button lives here. */}
          <li aria-hidden="true" />
          <NavTab {...TABS[1]} active={pathname.startsWith(TABS[1].href)} />
        </ul>
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
}) {
  return (
    <li>
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
}
