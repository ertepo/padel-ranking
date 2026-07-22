-- Traccia superficie e roster (nomi dei 6 tennisti per lato) di ogni
-- partita salvata, per poter rigiocare/condividere la stessa configurazione.

alter table public.legends_game_score
  add column if not exists surface text,
  add column if not exists player_roster text[] not null default '{}',
  add column if not exists cpu_roster text[] not null default '{}';
