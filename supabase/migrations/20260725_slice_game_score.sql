-- Punteggi del gioco "Slice": stessa identità condivisa via legends_game_players
-- (il nickname viene verificato/reclamato lì prima di salvare qui), ma con una
-- tabella punteggi propria dato che Slice non ha match_score/difficulty/surface.

create table if not exists public.slice_game_score (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  points integer not null,
  created_at timestamptz not null default now()
);

alter table public.slice_game_score enable row level security;

revoke all on table public.slice_game_score from anon, authenticated;
grant select on table public.slice_game_score to anon, authenticated;

drop policy if exists "Public read slice_game_score" on public.slice_game_score;
create policy "Public read slice_game_score"
on public.slice_game_score
for select
to anon, authenticated
using (true);
