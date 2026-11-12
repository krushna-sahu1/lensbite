"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/Sheet";
import { TrashIcon } from "@/components/icons";
import { deleteWeight, logWeight, type WeightRecord } from "@/lib/body";
import { formatWeight, fromKg, toKg, type Units } from "@/lib/energy";
import { localDateKey } from "@/lib/nutrition";
import { localDateFromKey } from "@/lib/periods";

const INPUT = "h-11 w-full rounded-xl border border-line bg-background px-3 tabular-nums outline-none transition focus:border-accent-ink";

/** Log a weigh-in (today or an earlier day) and see/delete recent ones. */
export function WeightSheet({
  open,
  onClose,
  units,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  units: Units;
  entries: WeightRecord[];
}) {
  const last = entries.at(-1);
  return (
    <Sheet open={open} onClose={onClose} title="Log weight" subtitle="Weigh in at the same time each day, ideally in the morning.">
      {open && <WeightForm key={last?.id ?? "none"} units={units} entries={entries} onDone={onClose} />}
    </Sheet>
  );
}

function WeightForm({ units, entries, onDone }: { units: Units; entries: WeightRecord[]; onDone: () => void }) {
  const last = entries.at(-1);
  const [value, setValue] = useState(last ? fromKg(last.kg, units).toFixed(1) : "");
  const [day, setDay] = useState(() => localDateKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const n = Number(value);
    if (!n) return setError("Enter your weight.");
    setBusy(true);
    setError(null);
    try {
      await logWeight(day, toKg(n, units));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    await deleteWeight(id).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Weight ({units === "imperial" ? "lb" : "kg"})</span>
            <input
              className={`${INPUT} mt-1.5 text-right text-lg font-semibold`}
              type="number"
              inputMode="decimal"
              step="0.1"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Day</span>
            <input className={`${INPUT} mt-1.5`} type="date" max={localDateKey(new Date())} value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
        </div>
        {error && (
          <p role="alert" className="rounded-2xl bg-fat/15 px-4 py-3 text-sm text-fat-ink">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-2xl bg-foreground font-semibold text-background transition active:scale-[0.98] disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </form>

      {entries.length > 0 && (
        <div className="mt-5">
          <p className="label-caps mb-1.5 px-1">Recent weigh-ins</p>
          <ul className="divide-y divide-line">
            {[...entries]
              .reverse()
              .slice(0, 7)
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between py-1.5 pl-1">
                  <span className="text-sm text-muted">
                    {localDateFromKey(e.day).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="font-medium tabular-nums">{formatWeight(e.kg, units)}</span>
                    <button
                      type="button"
                      onClick={() => void remove(e.id)}
                      aria-label={`Delete weigh-in on ${e.day}`}
                      className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-track hover:text-fat-ink"
                    >
                      <TrashIcon width={15} height={15} />
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
