-- Snapshot dei tornei "Americano" (coppie a rotazione) gestiti da /tornei/gestione.
-- Una riga per torneo salvato: stato jsonb con lo stesso shape usato in
-- localStorage (fase, giocatori, calendario partite e punteggi), così non
-- serve alcun mapping verso players/matches/padel_rankings.

create table if not exists public.tornei_americani (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  data_torneo date not null default current_date,
  nome text not null,
  stato jsonb not null
);

alter table public.tornei_americani enable row level security;

revoke all on table public.tornei_americani from anon, authenticated;
grant select on table public.tornei_americani to anon, authenticated;

drop policy if exists "Public read tornei_americani" on public.tornei_americani;
create policy "Public read tornei_americani"
on public.tornei_americani
for select
to anon, authenticated
using (true);
