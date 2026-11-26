-- Le parti di turno eliminate (colonna eliminata della migrazione 20261130)
-- non sono assenze: escono dalle ore previste del giorno, come se il turno
-- quel giorno non ci fosse mai stato. Richiede la 20261130. Si può rilanciare.

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
      and not e.privata
  ),
  -- Parti di turno eliminate: escono dal previsto (non sono assenze).
  eliminate as (
    select e.data, range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) as mr
    from eccezioni as e
    where e.assente_id = p_staff and e.eliminata
    group by e.data
  ),
  previsto as (
    select p.data,
           range_agg(tsrange(p.data + p.ora_inizio, p.data + p.ora_fine))
             - coalesce((select el.mr from eliminate as el where el.data = p.data), '{}'::tsmultirange) as mr
    from public.work_planned_intervals(p_staff, p_dal, p_al, p_club) as p
    group by p.data
  ),
  assenze as (
    select e.data,
           range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine)) as mr,
           range_agg(tsrange(e.data + e.ora_inizio, e.data + e.ora_fine))
             filter (where e.sostituto_id is not null) as mr_con_sostituto
    from eccezioni as e
    where e.assente_id = p_staff and not e.eliminata
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
           where e.assente_id = p_staff and e.data = m.data and not e.eliminata
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

revoke all on function public.work_hours_daily(uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.work_hours_daily(uuid, date, date, text) to service_role;
