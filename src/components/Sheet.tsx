"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
import { useFocusTrap } from "./use-focus-trap";

/**
 * Bottom sheet. Opens over the current screen, traps keyboard focus, closes on
 * Escape or a tap outside, and respects the phone's safe area at the bottom.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onClose);

  // Stop the page behind the sheet from scrolling while it's open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl outline-none animate-[sheet-in_0.28s_cubic-bezier(0.32,0.72,0,1)]"
      >
        <div className="sticky top-0 z-10 bg-surface/95 px-5 pb-3 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-track hover:text-foreground"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="px-5 pb-2">{children}</div>
      </div>
    </div>
  );
}
