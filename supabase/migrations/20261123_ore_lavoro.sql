-- Ore di lavoro dei maestri (Tennis Club Cingoli): orario teorico ricorrente
-- con periodo di validità, eccezioni (assenze, sostituzioni, ore extra) e
-- calcolo delle ore lavorate in SQL.
--
-- Gestita interamente da /admin/ore-lavoro tramite service role: RLS attivo e
-- nessuna policy per anon/authenticated, come per le altre tabelle
-- amministrative (vedi 20260911_scuola_tennis.sql). Anche le funzioni sono
-- eseguibili solo dalla service role.
--
-- Date e orari sono "ora locale di Roma" così come si leggono sul calendario
-- (date + time, senza fuso): un turno 16:00-21:30 dura 5h30 qualunque sia il
-- giorno, senza conversioni UTC.

create extension if not exists btree_gist with schema extensions;

-- Maestri e collaboratori. sono_io marca l'utente dell'area admin: al più
-- una riga può averlo.
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  ruolo text not null default 'maestro' check (ruolo in ('maestro', 'collaboratore')),
  colore text not null default '#38bdf8',
  sono_io boolean not null default false,
  attivo boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_sono_io_unico on public.staff (sono_io) where sono_io;

-- Un orario settimanale per periodo di validità (valido_al null = in corso).
-- I periodi dello stesso maestro non possono sovrapporsi: per cambiare orario
-- si chiude il periodo corrente e se ne apre uno nuovo.
create table if not exists public.work_schedule (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  valido_dal date not null,
  valido_al date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_schedule_periodo_valido check (valido_al is null or valido_al >= valido_dal),
  constraint work_schedule_periodi_disgiunti exclude using gist (
    staff_id with =,
    daterange(valido_dal, coalesce(valido_al, 'infinity'::date), '[]') with &&
  )
);

-- I turni di un orario. giorno_settimana: 1=lunedì ... 7=domenica (ISO).
create table if not exists public.work_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.work_schedule(id) on delete cascade,
  giorno_settimana smallint not null check (giorno_settimana between 1 and 7),
  ora_inizio time not null,
  ora_fine time not null,
  constraint work_schedule_slots_orario_valido check (ora_fine > ora_inizio)
);

-- Eccezioni rispetto all'orario, in un'unica forma "chi è assente, chi lo
-- sostituisce, in quale fascia":
--   sono sostituito          assente = io, sostituto = X
--   sostituisco un collega   assente = X,  sostituto = io
--   assenza senza sostituto  assente = X,  sostituto = null
--   ore extra                assente = null, sostituto = X
-- "Tutto il turno" è solo una scorciatoia del modale: la fascia viene sempre
-- salvata in chiaro.
create table if not exists public.work_exceptions (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  ora_inizio time not null,
  ora_fine time not null,
  assente_id uuid references public.staff(id) on delete restrict,
  sostituto_id uuid references public.staff(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_exceptions_orario_valido check (ora_fine > ora_inizio),
  constraint work_exceptions_qualcuno check (assente_id is not null or sostituto_id is not null),
  constraint work_exceptions_persone_diverse check (assente_id is null or sostituto_id is null or assente_id <> sostituto_id)
);

create index if not exists work_schedule_staff_id_idx on public.work_schedule(staff_id);
create index if not exists work_schedule_slots_schedule_id_idx on public.work_schedule_slots(schedule_id);
create index if not exists work_exceptions_assente_data_idx on public.work_exceptions(assente_id, data);
create index if not exists work_exceptions_sostituto_data_idx on public.work_exceptions(sostituto_id, data);

-- Giorni da verificare (azzurro nel calendario) ed eventuale nota del giorno.
create table if not exists public.work_day_flags (
  staff_id uuid not null references public.staff(id) on delete cascade,
  data date not null,
  da_verificare boolean not null default true,
  note text,
  updated_at timestamptz not null default now(),
  primary key (staff_id, data)
);

alter table public.staff enable row level security;
alter table public.work_schedule enable row level security;
alter table public.work_schedule_slots enable row level security;
alter table public.work_exceptions enable row level security;
alter table public.work_day_flags enable row level security;

revoke all on table public.staff from anon, authenticated;
revoke all on table public.work_schedule from anon, authenticated;
revoke all on table public.work_schedule_slots from anon, authenticated;
revoke all on table public.work_exceptions from anon, authenticated;
revoke all on table public.work_day_flags from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Calcolo delle ore
-- ---------------------------------------------------------------------------

-- Minuti totali coperti da un insieme di intervalli (già fusi, senza doppi).
create or replace function public.multirange_minutes(mr tsmultirange)
returns integer
language sql
immutable
set search_path = public
as $$
  select coalesce(sum(extract(epoch from upper(r) - lower(r)) / 60), 0)::integer
  from unnest(mr) as r
$$;

-- I turni previsti di un maestro, giorno per giorno, dall'orario valido in
-- ciascun giorno. Serve al calendario (blocchi previsti) e al calcolo.
create or replace function public.work_planned_intervals(p_staff uuid, p_dal date, p_al date)
returns table (data date, ora_inizio time, ora_fine time, schedule_id uuid, slot_id uuid)
language sql
stable
set search_path = public
as $$
  select g.data, s.ora_inizio, s.ora_fine, w.id, s.id
  from (
    select d::date as data
    from generate_series(p_dal::timestamp, p_al::timestamp, interval '1 day') as d
  ) as g
  join public.work_schedule as w
    on w.staff_id = p_staff
   and g.data >= w.valido_dal
   and (w.valido_al is null or g.data <= w.valido_al)
  join public.work_schedule_slots as s
    on s.schedule_id = w.id
   and s.giorno_settimana = extract(isodow from g.data)::smallint
  order by g.data, s.ora_inizio
$$;

-- Le ore di un maestro, giorno per giorno (anche i giorni senza turni).
--   previsto      = turni dell'orario valido quel giorno
--   lavorato      = (previsto - fasce in cui era assente) + fasce in cui ha sostituito o fatto extra
-- Gli intervalli sono multirange, quindi sovrapposizioni e doppioni non
-- vengono mai contati due volte. Le colonne rispettano sempre:
--   minuti_lavorati = minuti_previsti - minuti_assenza + minuti_sostituzioni
--   minuti_assenza  = minuti_sostituito + minuti_assente_senza_sostituto
-- dove minuti_sostituzioni sono solo i minuti che aggiungono lavoro (una
-- sostituzione dentro un proprio turno già previsto non aggiunge nulla).
create or replace function public.work_hours_daily(p_staff uuid, p_dal date, p_al date)
returns table (
  data date,
  minuti_previsti integer,
  minuti_lavorati integer,
  minuti_assenza integer,
  minuti_sostituito integer,
  minuti_assente_senza_sostituto integer,
  minuti_sostituzioni integer,
  minuti_differenza integer,
  da_verificare boolean,
  nota_giorno text,
  sostituito_da jsonb,
  sostituzioni jsonb
)
language sql
stable
set search_path = public
as $$
  with giorni as (
    select d::date as data
    from generate_series(p_dal::timestamp, p_al::timestamp, interval '1 day') as d
  ),
  previsto as (
    select p.data, range_agg(tsrange(p.data + p.ora_inizio, p.data + p.ora_fine)) as mr
    from public.work_planned_intervals(p_staff, p_dal, p_al) as p
    group by p.data
  ),
  assenze as (
    select e.data,
           range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) as mr,
           range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine))
             filter (where e.sostituto_id is not null) as mr_con_sostituto
    from public.work_exceptions as e
    where e.assente_id = p_staff and e.data between p_dal and p_al
    group by e.data
  ),
  sostituzioni as (
    select e.data, range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) as mr
    from public.work_exceptions as e
    where e.sostituto_id = p_staff and e.data between p_dal and p_al
    group by e.data
  ),
  intervalli as (
    select g.data,
           coalesce(pr.mr, '{}'::tsmultirange) as previsto,
           coalesce(pr.mr, '{}'::tsmultirange) - coalesce(a.mr, '{}'::tsmultirange) as residuo,
           coalesce(pr.mr, '{}'::tsmultirange) * coalesce(a.mr_con_sostituto, '{}'::tsmultirange) as sostituito,
           coalesce(s.mr, '{}'::tsmultirange) as sostituzioni
    from giorni as g
    left join previsto as pr on pr.data = g.data
    left join assenze as a on a.data = g.data
    left join sostituzioni as s on s.data = g.data
  ),
  minuti as (
    select i.data,
           i.previsto,
           public.multirange_minutes(i.previsto) as previsti,
           public.multirange_minutes(i.residuo + i.sostituzioni) as lavorati,
           public.multirange_minutes(i.previsto - i.residuo) as assenza,
           public.multirange_minutes(i.sostituito) as sostituito,
           public.multirange_minutes(i.sostituzioni - i.residuo) as extra
    from intervalli as i
  )
  select m.data,
         m.previsti,
         m.lavorati,
         m.assenza,
         m.sostituito,
         m.assenza - m.sostituito,
         m.extra,
         m.lavorati - m.previsti,
         coalesce(f.da_verificare, false),
         f.note,
         (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'id', e.id,
                    'sostituto_id', e.sostituto_id,
                    'sostituto', st.nome,
                    'ora_inizio', to_char(e.ora_inizio, 'HH24:MI'),
                    'ora_fine', to_char(e.ora_fine, 'HH24:MI'),
                    'minuti', public.multirange_minutes(
                      tsmultirange(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) * m.previsto),
                    'note', e.note
                  ) order by e.ora_inizio), '[]'::jsonb)
           from public.work_exceptions as e
           left join public.staff as st on st.id = e.sostituto_id
           where e.assente_id = p_staff and e.data = m.data
         ),
         (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'id', e.id,
                    'assente_id', e.assente_id,
                    'assente', st.nome,
                    'ora_inizio', to_char(e.ora_inizio, 'HH24:MI'),
                    'ora_fine', to_char(e.ora_fine, 'HH24:MI'),
                    'minuti', public.multirange_minutes(
                      tsmultirange(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine))),
                    'note', e.note
                  ) order by e.ora_inizio), '[]'::jsonb)
           from public.work_exceptions as e
           left join public.staff as st on st.id = e.assente_id
           where e.sostituto_id = p_staff and e.data = m.data
         )
  from minuti as m
  left join public.work_day_flags as f on f.staff_id = p_staff and f.data = m.data
  order by m.data
$$;

-- Riepilogo per settimana (da lunedì) o per mese, con i minuti in cui il
-- maestro è stato sostituito suddivisi per sostituto. p_periodo: 'week' | 'month'.
create or replace function public.work_hours_summary(p_staff uuid, p_dal date, p_al date, p_periodo text)
returns table (
  periodo_inizio date,
  minuti_previsti integer,
  minuti_lavorati integer,
  minuti_assenza integer,
  minuti_sostituito integer,
  minuti_assente_senza_sostituto integer,
  minuti_sostituzioni integer,
  minuti_differenza integer,
  giorni_da_verificare integer,
  sostituito_da jsonb
)
language sql
stable
set search_path = public
as $$
  with giorni as (
    select date_trunc(case when p_periodo = 'month' then 'month' else 'week' end, d.data::timestamp)::date
             as periodo_inizio,
           d.*
    from public.work_hours_daily(p_staff, p_dal, p_al) as d
  )
  select g.periodo_inizio,
         sum(g.minuti_previsti)::integer,
         sum(g.minuti_lavorati)::integer,
         sum(g.minuti_assenza)::integer,
         sum(g.minuti_sostituito)::integer,
         sum(g.minuti_assente_senza_sostituto)::integer,
         sum(g.minuti_sostituzioni)::integer,
         sum(g.minuti_differenza)::integer,
         count(*) filter (where g.da_verificare)::integer,
         (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'sostituto_id', x.sostituto_id,
                    'sostituto', x.sostituto,
                    'minuti', x.minuti
                  ) order by x.minuti desc), '[]'::jsonb)
           from (
             select e->>'sostituto_id' as sostituto_id,
                    e->>'sostituto' as sostituto,
                    sum((e->>'minuti')::integer)::integer as minuti
             from giorni as g2
             cross join lateral jsonb_array_elements(g2.sostituito_da) as e
             where g2.periodo_inizio = g.periodo_inizio
               and e->>'sostituto_id' is not null
             group by 1, 2
           ) as x
           where x.minuti > 0
         )
  from giorni as g
  group by g.periodo_inizio
  order by g.periodo_inizio
$$;

revoke all on function public.multirange_minutes(tsmultirange) from public, anon, authenticated;
revoke all on function public.work_planned_intervals(uuid, date, date) from public, anon, authenticated;
revoke all on function public.work_hours_daily(uuid, date, date) from public, anon, authenticated;
revoke all on function public.work_hours_summary(uuid, date, date, text) from public, anon, authenticated;

grant execute on function public.multirange_minutes(tsmultirange) to service_role;
grant execute on function public.work_planned_intervals(uuid, date, date) to service_role;
grant execute on function public.work_hours_daily(uuid, date, date) to service_role;
grant execute on function public.work_hours_summary(uuid, date, date, text) to service_role;
