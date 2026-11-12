-- Applied to the quiet-move Supabase project on 2026-11-12.

-- Profiles: one public row per account, created by trigger at signup.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));
alter table public.profiles enable row level security;
create policy "Anyone can read profiles" on public.profiles
  for select to anon, authenticated using (true);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Games: only games that count for stats live here. Moves travel over Realtime.
-- A result counts when both players report the same one (see src/lib/game.ts).
create table public.games (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('duel', 'quick', 'bot')),
  white uuid references public.profiles on delete set null,
  black uuid references public.profiles on delete set null,
  bot text,
  white_report text check (white_report in ('white', 'black', 'draw')),
  black_report text check (black_report in ('white', 'black', 'draw')),
  reported_at timestamptz,
  created_at timestamptz not null default now()
);
create index games_white on public.games (white);
create index games_black on public.games (black);
alter table public.games enable row level security;

create policy "Players read their games, anyone signed in reads open seats" on public.games
  for select to authenticated using (
    (select auth.uid()) in (white, black)
    or (kind <> 'bot' and (white is null or black is null))
  );

create policy "Signed-in users create a game with themselves in one seat" on public.games
  for insert to authenticated with check (
    ((white = (select auth.uid()) and black is null) or (black = (select auth.uid()) and white is null))
    and white_report is null and black_report is null and reported_at is null
  );

-- The two functions below are the only way to change a game row.
create function public.join_game(game_id uuid) returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in to join'; end if;
  select * into g from public.games where id = game_id for update;
  if not found or g.kind = 'bot' then raise exception 'Game not found'; end if;
  if g.white = me or g.black = me then return g; end if;
  if g.white is null and g.black is not null then
    update public.games set white = me where id = game_id returning * into g;
  elsif g.black is null and g.white is not null then
    update public.games set black = me where id = game_id returning * into g;
  else
    raise exception 'Game is full';
  end if;
  return g;
end $$;

create function public.report_result(game_id uuid, result text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if result is null or result not in ('white', 'black', 'draw') then
    raise exception 'Unknown result';
  end if;
  update public.games set
    white_report = case when white = me then coalesce(white_report, result) else white_report end,
    black_report = case when black = me then coalesce(black_report, result) else black_report end,
    reported_at = coalesce(reported_at, now())
  where id = game_id
    and (white = me or black = me)
    and (kind = 'bot' or (white is not null and black is not null));
  if not found then raise exception 'Game not found'; end if;
end $$;

revoke execute on function public.join_game(uuid) from public, anon;
revoke execute on function public.report_result(uuid, text) from public, anon;
grant execute on function public.join_game(uuid) to authenticated;
grant execute on function public.report_result(uuid, text) to authenticated;
