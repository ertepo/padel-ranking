-- Super Tris (Ultimate Tic-Tac-Toe) online: una riga per partita, scritta
-- solo lato server (service role) tramite src/pages/api/supertris.ts,
-- letta pubblicamente via anon key e propagata ai due giocatori via
-- Supabase Realtime, stesso schema già usato per public.live_score.

create table if not exists public.supertris_games (
  id uuid primary key default gen_random_uuid(),
  pin text not null,
  state jsonb not null,
  status text not null default 'waiting', -- waiting | active | finished
  player_x_name text not null,
  player_o_name text,
  player_x_token uuid not null default gen_random_uuid(),
  player_o_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Il PIN deve essere univoco solo tra le partite ancora vive: una volta
-- terminata la partita il PIN torna disponibile per una nuova.
create unique index if not exists supertris_games_pin_live_idx
  on public.supertris_games (pin)
  where status <> 'finished';

alter table public.supertris_games enable row level security;

revoke all on table public.supertris_games from anon, authenticated;

-- Le colonne dei token restano fuori dalla grant pubblica: solo la service
-- role (bypassa RLS) può leggerle per verificare le mosse.
grant select (id, pin, state, status, player_x_name, player_o_name, created_at, updated_at)
  on table public.supertris_games to anon, authenticated;

drop policy if exists "Public read supertris_games" on public.supertris_games;
create policy "Public read supertris_games"
on public.supertris_games
for select
to anon, authenticated
using (true);
