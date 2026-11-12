"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BackIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import { dismissOnboarding, logWeight, saveProfile, useProfile, useWeights, type Profile } from "@/lib/body";
import {
  ACTIVITY_LEVELS,
  CM_PER_IN,
  fromKg,
  GAIN_RATES,
  LOSE_RATES,
  planGoals,
  toKg,
  type ActivityLevel,
  type Sex,
  type Units,
  type WeightGoal,
} from "@/lib/energy";
import { localDateKey } from "@/lib/nutrition";

const INPUT =
  "h-11 w-full rounded-xl border border-line bg-background px-3 tabular-nums outline-none transition focus:border-accent-ink";

/** Pill-style single choice. */
function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className={`mt-1.5 grid gap-1.5 ${columns === 3 ? "grid-cols-3" : columns === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm transition ${
                active ? "bg-foreground text-background" : "bg-track hover:brightness-95"
              }`}
            >
              <span className="block font-semibold">{o.label}</span>
              {o.hint && <span className={`block text-xs ${active ? "opacity-75" : "text-muted"}`}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { loaded, available, profile } = useProfile();
  const weights = useWeights(60);
  // Re-key the form once the saved profile arrives, so its values prefill.
  const ready = loaded && weights.loaded;
  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-md px-4 pb-nav pt-[max(env(safe-area-inset-top),1.5rem)]">
        <div className="h-96 animate-pulse rounded-3xl bg-track" />
      </main>
    );
  }
  return <OnboardingForm available={available} profile={profile} lastKg={weights.entries.at(-1)?.kg ?? null} />;
}

function OnboardingForm({ available, profile, lastKg }: { available: boolean; profile: Profile | null; lastKg: number | null }) {
  const router = useRouter();
  const [units, setUnits] = useState<Units>(profile?.units ?? "metric");
  const [sex, setSex] = useState<Sex | null>(profile?.sex ?? null);
  const [birthYear, setBirthYear] = useState(profile?.birthYear ? String(profile.birthYear) : "");
  const [heightCm, setHeightCm] = useState(profile?.heightCm ? String(profile.heightCm) : "");
  const [feet, setFeet] = useState(profile?.heightCm ? String(Math.floor(profile.heightCm / CM_PER_IN / 12)) : "");
  const [inches, setInches] = useState(profile?.heightCm ? String(Math.round((profile.heightCm / CM_PER_IN) % 12)) : "");
  const [weight, setWeight] = useState(lastKg ? fromKg(lastKg, profile?.units ?? "metric").toFixed(1) : "");
  const [activity, setActivity] = useState<ActivityLevel | null>(profile?.activity ?? null);
  const [goal, setGoal] = useState<WeightGoal | null>(profile?.goal ?? null);
  const [rate, setRate] = useState<number>(Math.abs(profile?.weeklyRateKg ?? 0.5) || 0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const age = Number(birthYear) ? year - Number(birthYear) : NaN;
  const height = units === "metric" ? Number(heightCm) : (Number(feet) * 12 + Number(inches || 0)) * CM_PER_IN;
  const weightKg = toKg(Number(weight), units);
  const weeklyRateKg = goal === "lose" ? -rate : goal === "gain" ? rate : 0;

  const problem = !sex
    ? "Pick the body type the formula should use."
    : !(age >= 13 && age <= 100)
      ? "Enter a birth year (13 to 100 years old)."
      : !(height >= 100 && height <= 250)
        ? "Enter your height."
        : !(weightKg >= 30 && weightKg <= 300)
          ? "Enter your current weight."
          : !activity
            ? "Pick how active you are."
            : !goal
              ? "Pick your goal."
              : null;

  const plan = useMemo(
    () =>
      problem
        ? null
        : planGoals({ sex: sex!, age, heightCm: height, weightKg, activity: activity!, goal: goal!, weeklyRateKg }),
    [problem, sex, age, height, weightKg, activity, goal, weeklyRateKg],
  );

  function switchUnits(next: Units) {
    if (next === units) return;
    // Carry typed values across.
    if (next === "imperial" && Number(heightCm)) {
      const totalIn = Number(heightCm) / CM_PER_IN;
      setFeet(String(Math.floor(totalIn / 12)));
      setInches(String(Math.round(totalIn % 12)));
    }
    if (next === "metric" && Number(feet)) setHeightCm(String(Math.round((Number(feet) * 12 + Number(inches || 0)) * CM_PER_IN)));
    if (Number(weight)) setWeight(fromKg(toKg(Number(weight), units), next).toFixed(1));
    setUnits(next);
  }

  async function save() {
    if (!plan) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await saveProfile(
        {
          sex,
          birthYear: Number(birthYear),
          heightCm: Math.round(height * 10) / 10,
          activity,
          goal,
          weeklyRateKg,
          units,
        },
        plan.goals,
      );
      await logWeight(localDateKey(new Date()), weightKg);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    await dismissOnboarding().catch(() => {});
    router.push("/");
  }

  const rates = goal === "gain" ? GAIN_RATES : LOSE_RATES;
  const rateLabel = (r: number) => (units === "imperial" ? `${(r / 0.45359237).toFixed(1)} lb` : `${r} kg`);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-nav pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="mb-5">
        <Link href="/" className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-sm font-medium text-muted hover:text-foreground">
          <BackIcon width={16} height={16} />
          Home
        </Link>
        <h1 className="page-title mt-1">Your goals</h1>
        <p className="mt-1 text-sm text-muted">A few details to work out a calorie and protein target that fits you.</p>
      </header>

      {!available && (
        <p role="alert" className="mb-4 rounded-2xl bg-fat/15 px-4 py-3 text-sm text-fat-ink">
          Goal setup needs a database update that hasn&apos;t been applied yet. You can still set goals by hand in Settings.
        </p>
      )}

      <Card>
        <div className="space-y-5">
          <Choice
            label="Units"
            value={units}
            onChange={switchUnits}
            options={[
              { value: "metric", label: "kg · cm" },
              { value: "imperial", label: "lb · ft" },
            ]}
          />
          <Choice
            label="Body (for the formula)"
            value={sex}
            onChange={setSex}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Birth year</span>
              <input
                className={`${INPUT} mt-1.5`}
                inputMode="numeric"
                placeholder="1995"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Weight ({units === "metric" ? "kg" : "lb"})</span>
              <input
                className={`${INPUT} mt-1.5`}
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder={units === "metric" ? "70" : "155"}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
          </div>
          {units === "metric" ? (
            <label className="block">
              <span className="text-sm font-medium">Height (cm)</span>
              <input className={`${INPUT} mt-1.5`} type="number" inputMode="numeric" placeholder="170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </label>
          ) : (
            <div>
              <span className="text-sm font-medium">Height</span>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input className={INPUT} type="number" inputMode="numeric" placeholder="5" value={feet} onChange={(e) => setFeet(e.target.value)} aria-label="Feet" />
                  <span className="text-sm text-muted">ft</span>
                </label>
                <label className="flex items-center gap-2">
                  <input className={INPUT} type="number" inputMode="numeric" placeholder="8" value={inches} onChange={(e) => setInches(e.target.value)} aria-label="Inches" />
                  <span className="text-sm text-muted">in</span>
                </label>
              </div>
            </div>
          )}
          <Choice
            label="How active are you?"
            value={activity}
            onChange={setActivity}
            columns={1}
            options={ACTIVITY_LEVELS.map((a) => ({ value: a.value, label: a.label, hint: a.hint }))}
          />
          <Choice
            label="Goal"
            value={goal}
            onChange={(g) => {
              setGoal(g);
              setRate(g === "gain" ? 0.25 : 0.5);
            }}
            columns={3}
            options={[
              { value: "lose", label: "Lose" },
              { value: "maintain", label: "Maintain" },
              { value: "gain", label: "Gain" },
            ]}
          />
          {(goal === "lose" || goal === "gain") && (
            <Choice
              label="Per week"
              value={rate}
              onChange={setRate}
              columns={rates.length === 3 ? 3 : 2}
              options={rates.map((r) => ({
                value: r,
                label: rateLabel(r),
                hint: goal === "lose" ? (r <= 0.5 ? "Steady" : r <= 0.75 ? "Faster" : "Aggressive") : r <= 0.25 ? "Lean gain" : "Faster",
              }))}
            />
          )}
        </div>
      </Card>

      {plan && (
        <Card className="mt-4">
          <p className="label-caps">Your daily targets</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
            {plan.goals.calories.toLocaleString()} <span className="text-base font-medium text-muted">kcal</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            You burn about {plan.maintenance.toLocaleString()} kcal a day.
            {plan.floored && " We didn't go lower than a safe minimum, so progress may be slower than the rate you picked."}
          </p>
          <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ["Protein", plan.goals.protein_g],
              ["Carbs", plan.goals.carbs_g],
              ["Fat", plan.goals.fat_g],
              ["Fiber", plan.goals.fiber_g],
            ].map(([label, grams]) => (
              <div key={label} className="rounded-2xl bg-track/70 py-2.5">
                <dd className="text-lg font-semibold tabular-nums">{grams}g</dd>
                <dt className="text-[11px] text-muted">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            A starting point from the Mifflin-St Jeor formula, not medical advice. Log your weight and adjust after a few weeks.
          </p>
        </Card>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-fat/15 px-4 py-3 text-sm text-fat-ink">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button type="button" onClick={() => void skip()} disabled={busy || !available} className="min-h-12 rounded-2xl px-4 text-sm font-medium text-muted transition hover:bg-track disabled:opacity-50">
          Not now
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !available}
          className="min-h-12 flex-1 rounded-2xl bg-foreground font-semibold text-background transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : plan ? "Use these goals" : "Fill in the details"}
        </button>
      </div>
    </main>
  );
}
