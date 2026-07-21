-- Abbina ogni nickname del "Gioco delle leggende" al suo "nome cognome"
-- (normalizzato) la prima volta che viene usato, per evitare che due
-- giocatori diversi rivendichino lo stesso nickname in classifica.
-- Nessuna lettura pubblica: ci accede solo l'endpoint server-side con la
-- service role, per non esporre i nomi in chiaro.

create table if not exists public.legends_game_players (
  nickname_norm text primary key,
  nomecognome_norm text not null,
  created_at timestamptz not null default now()
);

alter table public.legends_game_players enable row level security;

revoke all on table public.legends_game_players from anon, authenticated;
