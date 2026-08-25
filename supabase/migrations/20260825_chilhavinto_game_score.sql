-- Punteggi del gioco "Chi l'ha vinto?": stessa identità condivisa via
-- legends_game_players (il nickname viene verificato/reclamato lì prima di
-- salvare qui), ma con una tabella punteggi propria come trivia_game_score.
-- Il punteggio è il numero di livelli superati (0-100) nella corsa a
-- eliminazione sulle finali Slam.

create table if not exists public.chilhavinto_game_score (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  level_reached integer not null,
  created_at timestamptz not null default now()
);

alter table public.chilhavinto_game_score enable row level security;

revoke all on table public.chilhavinto_game_score from anon, authenticated;
grant select on table public.chilhavinto_game_score to anon, authenticated;

drop policy if exists "Public read chilhavinto_game_score" on public.chilhavinto_game_score;
create policy "Public read chilhavinto_game_score"
on public.chilhavinto_game_score
for select
to anon, authenticated
using (true);
