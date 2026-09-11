-- Scuola tennis: gruppi/corsi, studenti iscritti e orario settimanale.
-- Gestita interamente da /admin/scuola-tennis tramite service role: nessuna
-- policy per anon/authenticated, come per le altre tabelle amministrative
-- (vedi 20260829_ricevute.sql).

create table if not exists public.scuola_tennis_gruppi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  colore text not null default '#38bdf8',
  tipo text,
  eta text,
  livello text,
  created_at timestamptz not null default now()
);

create table if not exists public.scuola_tennis_studenti (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text not null,
  gruppo_id uuid references public.scuola_tennis_gruppi(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- giorno_settimana: 1=lunedì ... 7=domenica.
-- ora_inizio_minuti: minuti dalla mezzanotte (es. 720 = 12:00).
-- durata_minuti: lunghezza del blocco, multipla di 15, fino a 8 ore.
create table if not exists public.scuola_tennis_lezioni (
  id uuid primary key default gen_random_uuid(),
  gruppo_id uuid not null references public.scuola_tennis_gruppi(id) on delete cascade,
  giorno_settimana smallint not null check (giorno_settimana between 1 and 7),
  ora_inizio_minuti smallint not null check (ora_inizio_minuti between 0 and 1439),
  durata_minuti smallint not null check (durata_minuti > 0 and durata_minuti <= 480),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scuola_tennis_studenti_gruppo_id_idx on public.scuola_tennis_studenti(gruppo_id);
create index if not exists scuola_tennis_lezioni_gruppo_id_idx on public.scuola_tennis_lezioni(gruppo_id);

alter table public.scuola_tennis_gruppi enable row level security;
alter table public.scuola_tennis_studenti enable row level security;
alter table public.scuola_tennis_lezioni enable row level security;

revoke all on table public.scuola_tennis_gruppi from anon, authenticated;
revoke all on table public.scuola_tennis_studenti from anon, authenticated;
revoke all on table public.scuola_tennis_lezioni from anon, authenticated;
