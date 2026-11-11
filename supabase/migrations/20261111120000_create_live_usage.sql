-- Daily count of Gemini Live tokens handed out per user, so one account can't
-- spend the whole Gemini quota. /api/token calls claim_live_token() before it
-- creates a token and refuses once the day's count passes its limit.
--
-- Users can read their own counts but can't write them: the only way to change
-- a count is claim_live_token(), which can only add one to the caller's own row.

create table public.live_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- UTC calendar day.
  day date not null,
  tokens integer not null default 0 check (tokens >= 0),
  primary key (user_id, day)
);

comment on table public.live_usage is 'Gemini Live tokens issued per user per UTC day. Written only by claim_live_token().';

alter table public.live_usage enable row level security;

create policy "Users can read their own live usage"
  on public.live_usage for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policies: writes go through the function below.

-- Adds one to the caller's count for today and returns the new count.
-- security definer so it can write past RLS; it only ever touches auth.uid()'s row.
create function public.claim_live_token()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  issued integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.live_usage as u (user_id, day, tokens)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set tokens = u.tokens + 1
  returning u.tokens into issued;

  return issued;
end;
$$;

revoke all on function public.claim_live_token() from public, anon;
grant execute on function public.claim_live_token() to authenticated;
