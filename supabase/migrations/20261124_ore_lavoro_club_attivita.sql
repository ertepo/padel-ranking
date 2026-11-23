-- Ore di lavoro: club (Cingoli, Poggio) e attività (tennis, atletica) su
-- turni ed eccezioni; turni previsti di tutti i maestri insieme (per vedere
-- i colleghi nel calendario); filtro per club nei conteggi.
-- Richiede 20261123_ore_lavoro.sql.

alter table public.work_schedule_slots
  add column if not exists club text not null default 'cingoli',
  add column if not exists attivita text not null default 'tennis';

alter table public.work_exceptions
  add column if not exists club text not null default 'cingoli',
  add column if not exists attivita text not null default 'tennis';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_schedule_slots_club_valido') then
    alter table public.work_schedule_slots
      add constraint work_schedule_slots_club_valido check (club in ('cingoli', 'poggio')),
      add constraint work_schedule_slots_attivita_valida check (attivita in ('tennis', 'atletica'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'work_exceptions_club_valido') then
    alter table public.work_exceptions
      add constraint work_exceptions_club_valido check (club in ('cingoli', 'poggio')),
      add constraint work_exceptions_attivita_valida check (attivita in ('tennis', 'atletica'));
  end if;
end
$$;

create index if not exists work_exceptions_data_idx on public.work_exceptions(data);

-- Le firme cambiano (filtro per club, maestro facoltativo): si ricreano.
drop function if exists public.work_hours_summary(uuid, date, date, text);
drop function if exists public.work_hours_daily(uuid, date, date);
drop function if exists public.work_planned_intervals(uuid, date, date);

-- Turni previsti giorno per giorno. p_staff null = tutti i maestri;
-- p_club null = tutti i club.
create or replace function public.work_planned_intervals(p_staff uuid, p_dal date, p_al date, p_club text default null)
returns table (
  data date,
  ora_inizio time,
  ora_fine time,
  staff_id uuid,
  club text,
  attivita text,
  schedule_id uuid,
  slot_id uuid
)
language sql
stable
set search_path = public
as $$
  select g.data, s.ora_inizio, s.ora_fine, w.staff_id, s.club, s.attivita, w.id, s.id
  from (
    select d::date as data
    from generate_series(p_dal::timestamp, p_al::timestamp, interval '1 day') as d
  ) as g
  join public.work_schedule as w
    on (p_staff is null or w.staff_id = p_staff)
   and g.data >= w.valido_dal
   and (w.valido_al is null or g.data <= w.valido_al)
  join public.work_schedule_slots as s
    on s.schedule_id = w.id
   and s.giorno_settimana = extract(isodow from g.data)::smallint
   and (p_club is null or s.club = p_club)
  order by g.data, s.ora_inizio, w.staff_id
$$;

-- Come in 20261123_ore_lavoro.sql, con il filtro per club su turni ed eccezioni.
create or replace function public.work_hours_daily(p_staff uuid, p_dal date, p_al date, p_club text default null)
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
  eccezioni as (
    select e.*
    from public.work_exceptions as e
    where e.data between p_dal and p_al
      and (p_club is null or e.club = p_club)
      and (e.assente_id = p_staff or e.sostituto_id = p_staff)
  ),
  previsto as (
    select p.data, range_agg(tsrange(p.data + p.ora_inizio, p.data + p.ora_fine)) as mr
    from public.work_planned_intervals(p_staff, p_dal, p_al, p_club) as p
    group by p.data
  ),
  assenze as (
    select e.data,
           range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) as mr,
           range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine))
             filter (where e.sostituto_id is not null) as mr_con_sostituto
    from eccezioni as e
    where e.assente_id = p_staff
    group by e.data
  ),
  sostituzioni as (
    select e.data, range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) as mr
    from eccezioni as e
    where e.sostituto_id = p_staff
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
                    'club', e.club,
                    'attivita', e.attivita,
                    'minuti', public.multirange_minutes(
                      tsmultirange(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) * m.previsto),
                    'note', e.note
                  ) order by e.ora_inizio), '[]'::jsonb)
           from eccezioni as e
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
                    'club', e.club,
                    'attivita', e.attivita,
                    'minuti', public.multirange_minutes(
                      tsmultirange(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine))),
                    'note', e.note
                  ) order by e.ora_inizio), '[]'::jsonb)
           from eccezioni as e
           left join public.staff as st on st.id = e.assente_id
           where e.sostituto_id = p_staff and e.data = m.data
         )
  from minuti as m
  left join public.work_day_flags as f on f.staff_id = p_staff and f.data = m.data
  order by m.data
$$;

create or replace function public.work_hours_summary(
  p_staff uuid, p_dal date, p_al date, p_periodo text, p_club text default null
)
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
    from public.work_hours_daily(p_staff, p_dal, p_al, p_club) as d
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

revoke all on function public.work_planned_intervals(uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.work_hours_daily(uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.work_hours_summary(uuid, date, date, text, text) from public, anon, authenticated;

grant execute on function public.work_planned_intervals(uuid, date, date, text) to service_role;
grant execute on function public.work_hours_daily(uuid, date, date, text) to service_role;
grant execute on function public.work_hours_summary(uuid, date, date, text, text) to service_role;
