-- Tier 1: body profile for goal calculation, a weight log, saved (favorite)
-- foods, and a daily counter for the non-live Gemini calls (describe/photo).
-- Every table is private to its user via Row Level Security.

-- ---------------------------------------------------------------------------
-- Profile fields on settings (all optional; filled in by onboarding)
-- ---------------------------------------------------------------------------

alter table public.settings
  add column sex text check (sex in ('female', 'male')),
  add column birth_year integer check (birth_year between 1900 and 2100),
  add column height_cm numeric(4, 1) check (height_cm between 50 and 272),
  add column activity_level text
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  add column goal text check (goal in ('lose', 'maintain', 'gain')),
  -- kg per week: negative to lose, positive to gain.
  add column weekly_rate_kg numeric(3, 2) check (weekly_rate_kg between -1.5 and 1.0),
  add column units text not null default 'metric' check (units in ('metric', 'imperial')),
  -- Set when the user finished onboarding (or chose to set goals by hand).
  add column profile_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Weight log: one entry per user per day (a second entry that day replaces it)
-- ---------------------------------------------------------------------------

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

comment on table public.weights is 'LensBite weight log, one row per user per day. Rows are private to their user (RLS).';

alter table public.weights enable row level security;

create policy "Users can read their own weights"
  on public.weights for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can add their own weights"
  on public.weights for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own weights"
  on public.weights for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own weights"
  on public.weights for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Saved foods: meals the user starred for one-tap logging
-- ---------------------------------------------------------------------------

create table public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric(7, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(7, 1) not null default 0 check (fiber_g >= 0),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

comment on table public.saved_foods is 'LensBite favorite foods for quick logging. Rows are private to their user (RLS).';

create index saved_foods_user_id_idx on public.saved_foods (user_id, created_at desc);

alter table public.saved_foods enable row level security;

create policy "Users can read their own saved foods"
  on public.saved_foods for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can add their own saved foods"
  on public.saved_foods for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own saved foods"
  on public.saved_foods for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own saved foods"
  on public.saved_foods for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Daily counter for /api/analyze (describe-a-meal and photo logging)
-- Same pattern as live_usage: readable by the user, written only by the function.
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('analyze')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

comment on table public.ai_usage is 'Non-live Gemini requests per user per UTC day. Written only by claim_ai_usage().';

alter table public.ai_usage enable row level security;

create policy "Users can read their own ai usage"
  on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Adds one to the caller's count of `p_kind` requests today and returns the new count.
create function public.claim_ai_usage(p_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.ai_usage as u (user_id, day, kind, count)
  values (uid, (now() at time zone 'utc')::date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = u.count + 1
  returning u.count into used;

  return used;
end;
$$;

revoke all on function public.claim_ai_usage(text) from public, anon;
grant execute on function public.claim_ai_usage(text) to authenticated;
