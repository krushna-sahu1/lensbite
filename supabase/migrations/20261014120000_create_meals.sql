-- Food log. One row per logged meal or snack.
-- Every row belongs to an auth user, and Row Level Security limits each user
-- to their own rows (user_id = auth.uid()).

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  -- Filled in from the caller's JWT, so the app never has to send it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text not null default 'snack'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric(7, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(7, 1) not null default 0 check (fiber_g >= 0),
  notes text check (char_length(notes) <= 2000)
);

comment on table public.meals is 'LensBite food log. Rows are private to their user (RLS).';

-- "Today's meals" and "last meal today" both filter by user and time range.
create index meals_user_id_eaten_at_idx on public.meals (user_id, eaten_at desc);

alter table public.meals enable row level security;

-- (select auth.uid()) is evaluated once per statement instead of once per row.
create policy "Users can read their own meals"
  on public.meals for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can add their own meals"
  on public.meals for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own meals"
  on public.meals for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own meals"
  on public.meals for delete
  to authenticated
  using (user_id = (select auth.uid()));
