-- Daily goals, one row per user. A missing row means "use the defaults".
-- Row Level Security limits each user to their own row (user_id = auth.uid()).

create table public.settings (
  -- Filled in from the caller's JWT, so the app never has to send it.
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  calorie_goal integer not null default 2000 check (calorie_goal > 0),
  protein_goal numeric(7, 1) not null default 120 check (protein_goal > 0),
  carbs_goal numeric(7, 1) not null default 220 check (carbs_goal > 0),
  fat_goal numeric(7, 1) not null default 65 check (fat_goal > 0),
  fiber_goal numeric(7, 1) not null default 30 check (fiber_goal > 0)
);

comment on table public.settings is 'LensBite daily goals. Rows are private to their user (RLS).';

alter table public.settings enable row level security;

-- (select auth.uid()) is evaluated once per statement instead of once per row.
create policy "Users can read their own settings"
  on public.settings for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Saving goals is an upsert, so it needs both insert and update.
create policy "Users can add their own settings"
  on public.settings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own settings"
  on public.settings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own settings"
  on public.settings for delete
  to authenticated
  using (user_id = (select auth.uid()));
