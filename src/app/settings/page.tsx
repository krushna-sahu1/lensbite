"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { BackIcon, DownloadIcon, TrashIcon, UploadIcon } from "@/components/icons";
import {
  clearAllData,
  DEFAULT_GOALS,
  exportData,
  importData,
  importLegacyData,
  setGoals,
  useLegacyMealCount,
  useStore,
} from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import type { Goals } from "@/lib/types";

const GOAL_FIELDS: { key: keyof Goals; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
];

function importedMessage({ added, duplicates, invalid }: { added: number; duplicates: number; invalid: number }) {
  const extra = [duplicates && `${duplicates} already present`, invalid && `${invalid} invalid skipped`].filter(Boolean);
  return `Imported ${added} meal${added === 1 ? "" : "s"}${extra.length ? ` (${extra.join(", ")})` : ""}`;
}

export default function SettingsPage() {
  const { goals, mealCount, email, loaded } = useStore();
  const legacyMeals = useLegacyMealCount();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function flash(text: string, error = false) {
    setMessage({ text, error });
    setTimeout(() => setMessage(null), 3500);
  }

  /** Runs one save/load against Supabase, then flashes its result (or error). */
  async function run(action: () => Promise<string>) {
    setBusy(true);
    try {
      flash(await action());
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong", true);
    } finally {
      setBusy(false);
    }
  }

  function saveGoals(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next: Partial<Goals> = {};
    for (const { key } of GOAL_FIELDS) next[key] = Number(form.get(key));
    void run(async () => {
      await setGoals(next);
      return "Goals saved";
    });
  }

  function download() {
    void run(async () => {
      const blob = new Blob([await exportData()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lensbite-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return "Export downloaded";
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    await run(async () => importedMessage(await importData(await file.text())));
    if (fileInput.current) fileInput.current.value = "";
  }

  async function signOut() {
    await createClient().auth.signOut();
    // A full page load (not router.push) also clears the in-memory food log, so
    // the next account to sign in on this device never sees this one's meals.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
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
        <form key={JSON.stringify(goals)} onSubmit={saveGoals} className="mt-4">
          <fieldset disabled={busy || !loaded} className="min-w-0 space-y-3">
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
                onClick={() =>
                  void run(async () => {
                    await setGoals(DEFAULT_GOALS);
                    return "Goals reset to defaults";
                  })
                }
                className="rounded-full px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-track disabled:opacity-60"
              >
                Reset
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full bg-foreground py-2.5 font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
              >
                Save goals
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      {/* Data */}
      <section className="mt-5 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-0.5 text-sm text-muted">
          {loaded ? `${mealCount} meal${mealCount === 1 ? "" : "s"}` : "Your meals are"} saved to your account.
          Export a JSON backup any time.
        </p>
        {legacyMeals > 0 && (
          <div className="mt-4 rounded-2xl bg-accent/10 p-4">
            <p className="text-sm">
              This browser still has {legacyMeals} meal{legacyMeals === 1 ? "" : "s"} from before you signed in.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(async () => importedMessage(await importLegacyData()))}
              className="mt-3 w-full rounded-full bg-foreground py-2.5 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
            >
              Move them to my account
            </button>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={download}
            className="flex items-center justify-center gap-2 rounded-2xl bg-track py-3 text-sm font-medium transition hover:brightness-95 disabled:opacity-60"
          >
            <DownloadIcon width={18} height={18} /> Export JSON
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-track py-3 text-sm font-medium transition hover:brightness-95 disabled:opacity-60"
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
          disabled={busy}
          onClick={() => {
            if (confirm("Delete ALL meals and reset goals? Export first if you want a backup.")) {
              void run(async () => {
                await clearAllData();
                return "All data cleared";
              });
            }
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-fat-ink transition hover:bg-fat/10 disabled:opacity-60"
        >
          <TrashIcon width={18} height={18} /> Clear all data
        </button>
      </section>

      {/* Account */}
      <section className="mt-5 flex items-center justify-between gap-4 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-line">
        <div className="min-w-0">
          <h2 className="font-semibold">Account</h2>
          <p className="mt-0.5 h-5 truncate text-sm text-muted">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="shrink-0 rounded-full bg-track px-4 py-2.5 text-sm font-medium transition hover:brightness-95"
        >
          Sign out
        </button>
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
