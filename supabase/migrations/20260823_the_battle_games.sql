-- The Battle (Tie-Break Chase) online: una riga per partita, scritta solo
-- lato server (service role) tramite src/pages/api/thebattle.ts, letta
-- pubblicamente via anon key e propagata ai due giocatori via Supabase
-- Realtime, stesso schema già usato per public.supertris_games.

create table if not exists public.the_battle_games (
  id uuid primary key default gen_random_uuid(),
  pin text not null,
  state jsonb not null,
  status text not null default 'waiting', -- waiting | active | finished
  player_a_name text not null,
  player_b_name text,
  player_a_token uuid not null default gen_random_uuid(),
  player_b_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Il PIN deve essere univoco solo tra le partite ancora vive: una volta
-- terminata la partita il PIN torna disponibile per una nuova.
create unique index if not exists the_battle_games_pin_live_idx
  on public.the_battle_games (pin)
  where status <> 'finished';

alter table public.the_battle_games enable row level security;

revoke all on table public.the_battle_games from anon, authenticated;

-- Le colonne dei token restano fuori dalla grant pubblica: solo la service
-- role (bypassa RLS) può leggerle per verificare le mosse.
grant select (id, pin, state, status, player_a_name, player_b_name, created_at, updated_at)
  on table public.the_battle_games to anon, authenticated;

drop policy if exists "Public read the_battle_games" on public.the_battle_games;
create policy "Public read the_battle_games"
on public.the_battle_games
for select
to anon, authenticated
using (true);
