-- Public pages can read sporting data, but all writes are server-side.
-- The players table receives column-level grants so private contact data
-- cannot be requested with the public anon key.

alter table public.players enable row level security;
alter table public.padel_rankings enable row level security;
alter table public.tennis_rankings enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.tennis_matches enable row level security;
alter table public.live_score enable row level security;

revoke all on table public.players from anon, authenticated;
revoke all on table public.padel_rankings from anon, authenticated;
revoke all on table public.tennis_rankings from anon, authenticated;
revoke all on table public.matches from anon, authenticated;
revoke all on table public.match_players from anon, authenticated;
revoke all on table public.tennis_matches from anon, authenticated;
revoke all on table public.live_score from anon, authenticated;

grant select (id, name, active) on table public.players to anon, authenticated;
grant select on table public.padel_rankings to anon, authenticated;
grant select on table public.tennis_rankings to anon, authenticated;
grant select on table public.matches to anon, authenticated;
grant select on table public.match_players to anon, authenticated;
grant select on table public.tennis_matches to anon, authenticated;
grant select on table public.live_score to anon, authenticated;

drop policy if exists "Public read players" on public.players;
create policy "Public read players"
on public.players
for select
to anon, authenticated
using (true);

drop policy if exists "Public read padel rankings" on public.padel_rankings;
create policy "Public read padel rankings"
on public.padel_rankings
for select
to anon, authenticated
using (true);

drop policy if exists "Public read tennis rankings" on public.tennis_rankings;
create policy "Public read tennis rankings"
on public.tennis_rankings
for select
to anon, authenticated
using (true);

drop policy if exists "Public read padel matches" on public.matches;
create policy "Public read padel matches"
on public.matches
for select
to anon, authenticated
using (true);

drop policy if exists "Public read padel match players" on public.match_players;
create policy "Public read padel match players"
on public.match_players
for select
to anon, authenticated
using (true);

drop policy if exists "Public read tennis matches" on public.tennis_matches;
create policy "Public read tennis matches"
on public.tennis_matches
for select
to anon, authenticated
using (true);

drop policy if exists "Public read live score" on public.live_score;
create policy "Public read live score"
on public.live_score
for select
to anon, authenticated
using (true);
