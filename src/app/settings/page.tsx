"use client";

import { useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DownloadIcon, MoonIcon, SunIcon, SystemIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { Toast } from "@/components/Toast";
import { Card, SectionTitle, Skeleton } from "@/components/ui";
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
import { THEMES, type Theme } from "@/lib/theme";
import type { Goals } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";

const GOAL_FIELDS: { key: keyof Goals; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "fiber_g", label: "Fiber", unit: "g" },
];

const THEME_ICONS: Record<Theme, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: SystemIcon,
};

function importedMessage({ added, duplicates, invalid }: { added: number; duplicates: number; invalid: number }) {
  const extra = [duplicates && `${duplicates} already present`, invalid && `${invalid} invalid skipped`].filter(Boolean);
  return `Imported ${added} meal${added === 1 ? "" : "s"}${extra.length ? ` (${extra.join(", ")})` : ""}`;
}

export default function SettingsPage() {
  const { goals, mealCount, email, loaded } = useStore();
  const legacyMeals = useLegacyMealCount();
  const { theme, setTheme } = useTheme();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"clear" | "signout" | "reset" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function flash(text: string, error = false) {
    setMessage({ text, error });
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
    <>
      <main className="mx-auto w-full max-w-md px-4 pb-nav pt-[max(env(safe-area-inset-top),1.5rem)]">
        <header className="mb-6">
          <h1 className="page-title">Settings</h1>
          <p className="mt-1 text-sm text-muted">Goals, appearance and your data.</p>
        </header>

        {/* Goals. `key` remounts the form when goals change (e.g. after import). */}
        <section aria-labelledby="goals-heading">
          <SectionTitle title="Goals" hint="What the AI tells you is left." />
          <Card>
            <h2 id="goals-heading" className="sr-only">
              Daily goals
            </h2>
            <p className="text-sm text-muted">Daily calorie and macro goals, shared with the AI.</p>
            <form key={JSON.stringify(goals)} onSubmit={saveGoals} className="mt-4">
              <fieldset disabled={busy || !loaded} className="min-w-0 space-y-3">
                {GOAL_FIELDS.map(({ key, label, unit }) => (
                  <label key={key} className="flex min-h-11 items-center justify-between gap-4">
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
                        className="h-11 w-28 rounded-xl border border-line bg-background px-3 text-right tabular-nums outline-none transition focus:border-accent-ink"
                      />
                      <span className="w-8 text-sm text-muted">{unit}</span>
                    </span>
                  </label>
                ))}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirm("reset")}
                    className="min-h-11 rounded-2xl px-4 text-sm font-medium text-muted transition hover:bg-track disabled:opacity-60"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="min-h-11 flex-1 rounded-2xl bg-foreground font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
                  >
                    Save goals
                  </button>
                </div>
              </fieldset>
            </form>
            {!loaded && (
              <div className="mt-3 space-y-2" aria-hidden="true">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            )}
          </Card>
        </section>

        {/* Appearance */}
        <section aria-labelledby="appearance-heading" className="mt-7">
          <SectionTitle title="Appearance" />
          <Card>
            <h2 id="appearance-heading" className="text-sm font-medium">
              Theme
            </h2>
            <p className="mt-0.5 text-sm text-muted">Light, dark, or follow your phone&apos;s setting.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {THEMES.map((option) => {
                const Icon = THEME_ICONS[option.value];
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={active}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border text-sm font-semibold transition ${
                      active
                        ? "border-accent-ink bg-accent-soft text-accent-ink"
                        : "border-line bg-background text-muted hover:text-foreground"
                    }`}
                  >
                    <Icon width={20} height={20} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Data */}
        <section aria-labelledby="data-heading" className="mt-7">
          <SectionTitle title="Data" />
          <Card>
            <h2 id="data-heading" className="text-sm font-medium">
              Your food log
            </h2>
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
                  className="mt-3 min-h-11 w-full rounded-2xl bg-foreground text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
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
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-track text-sm font-medium transition hover:brightness-95 disabled:opacity-60"
              >
                <DownloadIcon width={18} height={18} /> Export JSON
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-track text-sm font-medium transition hover:brightness-95 disabled:opacity-60"
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
              onClick={() => setConfirm("clear")}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-medium text-fat-ink transition hover:bg-fat/10 disabled:opacity-60"
            >
              <TrashIcon width={18} height={18} /> Clear all data
            </button>
          </Card>
        </section>

        {/* Account */}
        <section aria-labelledby="account-heading" className="mt-7">
          <SectionTitle title="Account" />
          <Card>
            <h2 id="account-heading" className="text-sm font-medium">
              Signed in
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">{email ?? "—"}</p>
            <button
              type="button"
              onClick={() => setConfirm("signout")}
              className="mt-4 min-h-11 w-full rounded-2xl bg-track text-sm font-semibold transition hover:brightness-95"
            >
              Sign out
            </button>
          </Card>
        </section>

        <p className="mt-8 text-center text-xs text-muted">
          Estimates come from AI and can be off. Not medical advice.
        </p>
      </main>

      <ConfirmDialog
        open={confirm === "clear"}
        title="Clear all data?"
        description="Every meal and your goals will be deleted. Export a JSON backup first if you want to keep them."
        confirmLabel="Delete everything"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(async () => {
            await clearAllData();
            return "All data cleared";
          });
        }}
      />

      <ConfirmDialog
        open={confirm === "reset"}
        title="Reset goals?"
        description="Your goals go back to the defaults. You can change them again at any time."
        confirmLabel="Reset goals"
        destructive={false}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void run(async () => {
            await setGoals(DEFAULT_GOALS);
            return "Goals reset to defaults";
          });
        }}
      />

      <ConfirmDialog
        open={confirm === "signout"}
        title="Sign out?"
        description="You'll need to sign in with Google again to see your food log."
        confirmLabel="Sign out"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void signOut();
        }}
      />

      {message && (
        <Toast message={message.text} error={message.error} onDismiss={() => setMessage(null)} duration={3500} />
      )}
    </>
  );
}
