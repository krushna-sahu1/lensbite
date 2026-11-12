/**
 * Body profile (for goal calculation) and the weight log, both in Supabase.
 * Kept apart from storage.ts so the core food log keeps working even before
 * the profile/weights migration has been applied: these hooks report
 * `available: false` instead of failing.
 */
import { useEffect, useState } from "react";
import type { ActivityLevel, Sex, Units, WeightGoal } from "./energy";
import { localDateKey } from "./nutrition";
import { refresh } from "./storage";
import { createClient } from "./supabase/client";
import type { Goals } from "./types";
import type { WeightEntry } from "./weight-trend";

export interface Profile {
  sex: Sex | null;
  birthYear: number | null;
  heightCm: number | null;
  activity: ActivityLevel | null;
  goal: WeightGoal | null;
  weeklyRateKg: number | null;
  units: Units;
  /** When onboarding was finished or skipped; null means "never asked". */
  completedAt: string | null;
}

const PROFILE_COLUMNS = "sex, birth_year, height_cm, activity_level, goal, weekly_rate_kg, units, profile_completed_at";

// One signal for profile + weights changes, so every hook on screen re-reads.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
function useChangeCounter() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return version;
}

/** 42703 = undefined column, 42P01 = undefined table: the migration isn't applied yet. */
const isMissingSchema = (code?: string) => code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205";

export interface ProfileState {
  loaded: boolean;
  available: boolean;
  profile: Profile | null;
}

export function useProfile(): ProfileState {
  const version = useChangeCounter();
  const [state, setState] = useState<ProfileState>({ loaded: false, available: true, profile: null });
  useEffect(() => {
    let cancelled = false;
    void createClient()
      .from("settings")
      .select(PROFILE_COLUMNS)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (!isMissingSchema(error.code)) console.warn("[profile]", error.message);
          setState({ loaded: true, available: false, profile: null });
          return;
        }
        setState({
          loaded: true,
          available: true,
          profile: data
            ? {
                sex: (data.sex as Sex | null) ?? null,
                birthYear: data.birth_year,
                heightCm: data.height_cm === null ? null : Number(data.height_cm),
                activity: (data.activity_level as ActivityLevel | null) ?? null,
                goal: (data.goal as WeightGoal | null) ?? null,
                weeklyRateKg: data.weekly_rate_kg === null ? null : Number(data.weekly_rate_kg),
                units: data.units === "imperial" ? "imperial" : "metric",
                completedAt: data.profile_completed_at,
              }
            : null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);
  return state;
}

async function userId() {
  const { data } = await createClient().auth.getSession();
  if (!data.session) throw new Error("You're signed out. Sign in again.");
  return data.session.user.id;
}

/** Saves the profile, the goals calculated from it, and marks onboarding done. */
export async function saveProfile(profile: Omit<Profile, "completedAt">, goals: Goals): Promise<void> {
  const { error } = await createClient()
    .from("settings")
    .upsert({
      user_id: await userId(),
      sex: profile.sex,
      birth_year: profile.birthYear,
      height_cm: profile.heightCm,
      activity_level: profile.activity,
      goal: profile.goal,
      weekly_rate_kg: profile.weeklyRateKg,
      units: profile.units,
      profile_completed_at: new Date().toISOString(),
      calorie_goal: Math.round(goals.calories),
      protein_goal: goals.protein_g,
      carbs_goal: goals.carbs_g,
      fat_goal: goals.fat_g,
      fiber_goal: goals.fiber_g,
    });
  if (error) throw new Error(`Couldn't save your profile: ${error.message}`);
  notify();
  await refresh().catch(() => {});
}

/** "Not now": stop suggesting onboarding, keep the goals as they are. */
export async function dismissOnboarding(): Promise<void> {
  const { error } = await createClient()
    .from("settings")
    .upsert({ user_id: await userId(), profile_completed_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  notify();
}

/** Switches kg/lb display. */
export async function setUnits(units: Units): Promise<void> {
  const { error } = await createClient().from("settings").upsert({ user_id: await userId(), units });
  if (error) throw new Error(`Couldn't save units: ${error.message}`);
  notify();
}

// ---------------------------------------------------------------------------
// Weight log
// ---------------------------------------------------------------------------

export interface WeightRecord extends WeightEntry {
  id: string;
}

export interface WeightsState {
  loaded: boolean;
  available: boolean;
  entries: WeightRecord[];
  error?: string;
}

/** Weigh-ins from the last `days` days, oldest first. */
export function useWeights(days = 365): WeightsState {
  const version = useChangeCounter();
  const [state, setState] = useState<WeightsState>({ loaded: false, available: true, entries: [] });
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const since = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
    void createClient()
      .from("weights")
      .select("id, measured_on, weight_kg")
      .gte("measured_on", since)
      .order("measured_on")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          const missing = isMissingSchema(error.code);
          setState({ loaded: true, available: !missing, entries: [], error: missing ? undefined : error.message });
          return;
        }
        setState({
          loaded: true,
          available: true,
          entries: data.map((r) => ({ id: r.id, day: r.measured_on, kg: Number(r.weight_kg) })),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [days, version]);
  return state;
}

/** Records a weigh-in for a local day; a second one on the same day replaces it. */
export async function logWeight(day: string, kg: number): Promise<void> {
  if (!(kg >= 20 && kg <= 400)) throw new Error("Enter a weight between 20 and 400 kg (44–880 lb).");
  const { error } = await createClient()
    .from("weights")
    .upsert(
      { user_id: await userId(), measured_on: day, weight_kg: Math.round(kg * 100) / 100 },
      { onConflict: "user_id,measured_on" },
    );
  if (error) throw new Error(`Couldn't save your weight: ${error.message}`);
  notify();
}

export async function deleteWeight(id: string): Promise<void> {
  const { error } = await createClient().from("weights").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete that weigh-in: ${error.message}`);
  notify();
}
