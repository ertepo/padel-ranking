-- Impegni personali (non di lavoro): titolo, colore, note, su una o più date.
-- Non entrano nel conteggio delle ore. Una persona che non lavora al tennis
-- (staff.tennis = false) ha solo impegni: niente assenze, sostituzioni, orari.
-- Richiede la migrazione 20261123.

alter table public.staff
  add column if not exists tennis boolean not null default true;

create table if not exists public.impegni (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  data date not null,
  ora_inizio time not null,
  ora_fine time not null,
  titolo text not null check (char_length(titolo) between 1 and 80),
  colore text not null default 'azzurro'
    check (colore in ('rosso', 'arancio', 'giallo', 'verde', 'acqua', 'azzurro', 'viola', 'rosa')),
  note text,
  -- Impegni creati insieme ("ripeti impegno") condividono il gruppo.
  gruppo_id uuid,
  created_at timestamptz not null default now(),
  constraint impegni_orari check (ora_fine > ora_inizio)
);

create index if not exists impegni_data_idx on public.impegni (data);
create index if not exists impegni_gruppo_idx on public.impegni (gruppo_id) where gruppo_id is not null;

-- Solo il server (service role) legge e scrive.
alter table public.impegni enable row level security;
revoke all on table public.impegni from anon, authenticated;
