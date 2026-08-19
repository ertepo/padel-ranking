-- Punteggi del gioco "Trivia": stessa identità condivisa via
-- legends_game_players (il nickname viene verificato/reclamato lì prima di
-- salvare qui), ma con una tabella punteggi propria come slice_game_score.

create table if not exists public.trivia_game_score (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  points integer not null,
  correct_count integer not null,
  total_questions integer not null,
  created_at timestamptz not null default now()
);

alter table public.trivia_game_score enable row level security;

revoke all on table public.trivia_game_score from anon, authenticated;
grant select on table public.trivia_game_score to anon, authenticated;

drop policy if exists "Public read trivia_game_score" on public.trivia_game_score;
create policy "Public read trivia_game_score"
on public.trivia_game_score
for select
to anon, authenticated
using (true);
