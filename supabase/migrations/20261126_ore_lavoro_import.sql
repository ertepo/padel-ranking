-- Ore di lavoro: import di un periodo da CSV, in un'unica transazione.
-- Richiede le migrazioni 20261123-20261125.
--
-- Il piano (periodi d'orario, eccezioni, giorni da verificare) lo prepara il
-- server dal CSV (src/lib/ore-lavoro/csv.ts); qui lo si applica tutto o niente:
--   1. se p_sostituisci, toglie le eccezioni del maestro (assente o sostituto)
--      e i suoi giorni segnati nel periodo [p_dal, p_al];
--   2. se p_orario_dal non è null, ritaglia gli orari del maestro attorno a
--      [p_orario_dal, p_orario_al] (prima e dopo restano com'erano) e ci mette
--      i periodi di p_periodi;
--   3. inserisce le eccezioni di p_eccezioni e i giorni di p_giorni.
-- Restituisce i conteggi.

create or replace function public.work_import_apply(
  p_staff uuid,
  p_dal date,
  p_al date,
  p_sostituisci boolean,
  p_orario_dal date,
  p_orario_al date,
  p_periodi jsonb,
  p_eccezioni jsonb,
  p_giorni jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_nuovo uuid;
  v_p jsonb;
  v_t jsonb;
  n_rimosse integer := 0;
  n_periodi integer := 0;
  n_eccezioni integer := 0;
  n_giorni integer := 0;
begin
  if p_staff is null or p_dal is null or p_al is null or p_al < p_dal then
    raise exception 'Maestro o periodo non validi.';
  end if;
  if p_orario_dal is not null and (p_orario_al is null or p_orario_al < p_orario_dal
      or p_orario_dal < p_dal or p_orario_al > p_al) then
    raise exception 'Il periodo dell''orario deve stare dentro quello dell''import.';
  end if;

  if p_sostituisci then
    delete from public.work_exceptions
    where data between p_dal and p_al and (assente_id = p_staff or sostituto_id = p_staff);
    get diagnostics n_rimosse = row_count;
    delete from public.work_day_flags where staff_id = p_staff and data between p_dal and p_al;
  end if;

  if p_orario_dal is not null then
    for r in
      select * from public.work_schedule
      where staff_id = p_staff
        and valido_dal <= p_orario_al
        and coalesce(valido_al, 'infinity'::date) >= p_orario_dal
      order by valido_dal
      for update
    loop
      if r.valido_dal < p_orario_dal and coalesce(r.valido_al, 'infinity'::date) > p_orario_al then
        -- Copre tutto il periodo: resta la testa, la coda diventa una copia.
        update public.work_schedule set valido_al = p_orario_dal - 1, updated_at = now() where id = r.id;
        insert into public.work_schedule (staff_id, valido_dal, valido_al, note)
        values (p_staff, p_orario_al + 1, r.valido_al, r.note)
        returning id into v_nuovo;
        insert into public.work_schedule_slots (schedule_id, giorno_settimana, ora_inizio, ora_fine, club, attivita)
        select v_nuovo, giorno_settimana, ora_inizio, ora_fine, club, attivita
        from public.work_schedule_slots where schedule_id = r.id;
      elsif r.valido_dal < p_orario_dal then
        update public.work_schedule set valido_al = p_orario_dal - 1, updated_at = now() where id = r.id;
      elsif coalesce(r.valido_al, 'infinity'::date) > p_orario_al then
        update public.work_schedule set valido_dal = p_orario_al + 1, updated_at = now() where id = r.id;
      else
        delete from public.work_schedule where id = r.id;
      end if;
    end loop;

    for v_p in select * from jsonb_array_elements(coalesce(p_periodi, '[]'::jsonb)) loop
      insert into public.work_schedule (staff_id, valido_dal, valido_al, note)
      values (p_staff, (v_p->>'valido_dal')::date, (v_p->>'valido_al')::date, nullif(v_p->>'note', ''))
      returning id into v_nuovo;
      n_periodi := n_periodi + 1;
      for v_t in select * from jsonb_array_elements(coalesce(v_p->'turni', '[]'::jsonb)) loop
        insert into public.work_schedule_slots (schedule_id, giorno_settimana, ora_inizio, ora_fine, club, attivita)
        values (
          v_nuovo,
          (v_t->>'giorno_settimana')::smallint,
          (v_t->>'ora_inizio')::time,
          (v_t->>'ora_fine')::time,
          coalesce(v_t->>'club', 'cingoli'),
          coalesce(v_t->>'attivita', 'tennis')
        );
      end loop;
    end loop;
  end if;

  insert into public.work_exceptions (data, ora_inizio, ora_fine, assente_id, sostituto_id, club, attivita, note)
  select (e->>'data')::date,
         (e->>'ora_inizio')::time,
         (e->>'ora_fine')::time,
         nullif(e->>'assente_id', '')::uuid,
         nullif(e->>'sostituto_id', '')::uuid,
         coalesce(e->>'club', 'cingoli'),
         coalesce(e->>'attivita', 'tennis'),
         nullif(e->>'note', '')
  from jsonb_array_elements(coalesce(p_eccezioni, '[]'::jsonb)) as e;
  get diagnostics n_eccezioni = row_count;

  insert into public.work_day_flags (staff_id, data, da_verificare, note)
  select p_staff, (g->>'data')::date, coalesce((g->>'da_verificare')::boolean, true), nullif(g->>'note', '')
  from jsonb_array_elements(coalesce(p_giorni, '[]'::jsonb)) as g
  on conflict (staff_id, data) do update
    set da_verificare = excluded.da_verificare, note = excluded.note, updated_at = now();
  get diagnostics n_giorni = row_count;

  return jsonb_build_object(
    'eccezioni_rimosse', n_rimosse,
    'periodi', n_periodi,
    'eccezioni', n_eccezioni,
    'giorni', n_giorni
  );
end
$$;

revoke all on function public.work_import_apply(uuid, date, date, boolean, date, date, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.work_import_apply(uuid, date, date, boolean, date, date, jsonb, jsonb, jsonb)
  to service_role;
