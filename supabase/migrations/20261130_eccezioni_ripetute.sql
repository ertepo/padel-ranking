-- Eccezioni ripetute ("ripeti in questi giorni fino al…"): le righe create
-- insieme hanno lo stesso gruppo, così si possono eliminare "da qui in poi".
-- Si può rilanciare.

alter table public.work_exceptions add column if not exists gruppo_id uuid;
create index if not exists work_exceptions_gruppo_idx on public.work_exceptions (gruppo_id) where gruppo_id is not null;

-- Parte di turno eliminata (non "assente"): non si lavora e non si disegna
-- nel calendario. Per il conteggio è come un'assenza senza sostituto.
alter table public.work_exceptions
  add column if not exists eliminata boolean not null default false;

alter table public.work_exceptions drop constraint if exists work_exceptions_eliminata_valida;
alter table public.work_exceptions
  add constraint work_exceptions_eliminata_valida
  check (not eliminata or (assente_id is not null and sostituto_id is null and not privata));
