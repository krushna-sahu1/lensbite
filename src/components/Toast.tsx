"use client";

import { useEffect, useRef } from "react";

/**
 * Small floating message, used for "Meal deleted" / "Undo" and for the result
 * of a settings action. `onDismiss` is called after `duration` ms.
 */
export function Toast({
  message,
  action,
  onDismiss,
  duration = 4000,
  error = false,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  duration?: number;
  /** Shows the message in the "something went wrong" colour. */
  error?: boolean;
}) {
  // Keep the latest callback in a ref, so a re-render doesn't restart the timer.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current?.(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),9.5rem)] z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl animate-[fade-up_0.2s_ease-out] ${
        error ? "bg-fat text-white" : "bg-foreground text-background"
      }`}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`shrink-0 rounded-lg px-2 py-1 font-semibold underline underline-offset-2 ${
            error ? "text-white" : "text-accent-ink"
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
