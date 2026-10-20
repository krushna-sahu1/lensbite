"use client";

import { useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";

/**
 * Confirmation dialog for destructive actions. Replaces the browser's `confirm()`
 * so it matches the rest of the app and is keyboard accessible.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        tabIndex={-1}
        className="relative z-10 w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl outline-none animate-[fade-up_0.2s_ease-out]"
      >
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p id="confirm-dialog-description" className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-2xl bg-track px-4 font-semibold transition hover:brightness-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-11 flex-1 rounded-2xl px-4 font-semibold transition active:scale-[0.98] ${
              destructive ? "bg-fat text-white hover:brightness-105" : "bg-foreground text-background"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
