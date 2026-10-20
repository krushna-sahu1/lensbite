"use client";

import type { ReactNode } from "react";

/** Elevated panel. The default surface for grouped content. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line ${className}`}>{children}</section>
  );
}

/** Section heading used above cards and inside Settings. */
export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Loading placeholder. `className` sets the shape (e.g. "h-4 w-24"). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

/** Shown when there is genuinely nothing to display (not while loading). */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-track text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Segmented control (Day | Week | Month). Implemented as a radio group so
 * arrow keys and screen readers behave the way they do for native radios.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex gap-1 rounded-2xl bg-track p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition ${
              active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small rounded label used for meal types and statuses. */
export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

/** Primary call to action. Full width on mobile, rounded, 44px+ tall. */
export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-2xl bg-foreground px-5 font-semibold text-background transition active:scale-[0.98] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

/** Secondary call to action on a neutral surface. */
export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-2xl bg-track px-5 font-semibold transition hover:brightness-95 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
