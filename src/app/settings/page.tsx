"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { BackIcon, DownloadIcon, TrashIcon, UploadIcon } from "@/components/icons";
import {
  clearAllData,
  DEFAULT_GOALS,
  exportData,
  getAccessCode,
  importData,
  setAccessCode,
  setGoals,
  useStore,
} from "@/lib/storage";
import type { Goals } from "@/lib/types";

const GOAL_FIELDS: { key: keyof Goals; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
];

export default function SettingsPage() {
  const { goals, meals } = useStore();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function flash(text: string, error = false) {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 3500);
  }

  function saveGoals(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next: Partial<Goals> = {};
    for (const { key } of GOAL_FIELDS) next[key] = Number(form.get(key));
    setGoals(next);
    flash("Goals saved");
  }

  function download() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lensbite-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const { added, duplicates, invalid } = importData(await file.text());
      const extra = [duplicates && `${duplicates} already present`, invalid && `${invalid} invalid skipped`].filter(Boolean);
      flash(`Imported ${added} meal${added === 1 ? "" : "s"}${extra.length ? ` (${extra.join(", ")})` : ""}`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Import failed", true);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function saveAccessCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAccessCode(String(new FormData(e.currentTarget).get("code") ?? "").trim());
    flash("Access code saved on this device");
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-surface p-2.5 shadow-sm ring-1 ring-line transition hover:bg-track"
          aria-label="Back"
        >
          <BackIcon />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      {/* Goals. `key` remounts the form when goals change (e.g. after import). */}
      <section className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <h2 className="font-semibold">Daily goals</h2>
        <p className="mt-0.5 text-sm text-muted">Shared with the AI so it can tell you what&apos;s left.</p>
        <form key={JSON.stringify(goals)} onSubmit={saveGoals} className="mt-4 space-y-3">
          {GOAL_FIELDS.map(({ key, label, unit }) => (
            <label key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">{label}</span>
              <span className="flex items-center gap-2">
                <input
                  name={key}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step="any"
                  required
                  defaultValue={goals[key]}
                  className="w-28 rounded-xl border border-line bg-background px-3 py-2 text-right tabular-nums outline-none focus:border-accent-ink"
                />
                <span className="w-8 text-sm text-muted">{unit}</span>
              </span>
            </label>
          ))}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setGoals(DEFAULT_GOALS);
                flash("Goals reset to defaults");
              }}
              className="rounded-full px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-track"
            >
              Reset
            </button>
            <button
              type="submit"
              className="flex-1 rounded-full bg-foreground py-2.5 font-semibold text-background transition active:scale-[0.98]"
            >
              Save goals
            </button>
          </div>
        </form>
      </section>

      {/* Data */}
      <section className="mt-5 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-0.5 text-sm text-muted">
          {meals.length} meal{meals.length === 1 ? "" : "s"} stored only in this browser. Export regularly as a backup.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={download}
            className="flex items-center justify-center gap-2 rounded-2xl bg-track py-3 text-sm font-medium transition hover:brightness-95"
          >
            <DownloadIcon width={18} height={18} /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-track py-3 text-sm font-medium transition hover:brightness-95"
          >
            <UploadIcon width={18} height={18} /> Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete ALL meals and reset goals? Export first if you want a backup.")) {
              clearAllData();
              flash("All data cleared");
            }
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-fat-ink transition hover:bg-fat/10"
        >
          <TrashIcon width={18} height={18} /> Clear all data
        </button>
      </section>

      {/* Access code (only needed if the server sets ACCESS_CODE) */}
      <section className="mt-5 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <h2 className="font-semibold">Access code</h2>
        <p className="mt-0.5 text-sm text-muted">
          Only needed if your deployment sets <code className="text-xs">ACCESS_CODE</code>. Leave empty otherwise.
        </p>
        <form onSubmit={saveAccessCode} className="mt-4 flex gap-2">
          <input
            name="code"
            type="password"
            autoComplete="off"
            defaultValue={typeof window === "undefined" ? "" : getAccessCode()}
            suppressHydrationWarning
            placeholder="Access code"
            className="min-w-0 flex-1 rounded-xl border border-line bg-background px-3 py-2 outline-none focus:border-accent-ink"
          />
          <button type="submit" className="rounded-full bg-foreground px-5 font-semibold text-background">
            Save
          </button>
        </form>
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        Estimates come from AI and can be off. Not medical advice.
      </p>

      {message && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1.25rem)] mx-auto max-w-sm rounded-2xl px-4 py-3 text-center text-sm font-medium shadow-lg ${
            message.error ? "bg-fat text-black" : "bg-foreground text-background"
          }`}
        >
          {message.text}
        </div>
      )}
    </main>
  );
}
