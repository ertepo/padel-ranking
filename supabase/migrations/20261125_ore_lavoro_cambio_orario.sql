-- Ore di lavoro: modifiche all'orario ricorrente "da questa data in poi".
-- Richiede 20261123_ore_lavoro.sql e 20261124_ore_lavoro_club_attivita.sql.
--
-- work_schedule_apply(maestro, dal, operazioni) applica in un'unica
-- transazione una lista di operazioni sui turni dell'orario valido dal
-- giorno p_dal in poi, senza toccare i giorni precedenti:
--   - se l'orario valido quel giorno inizia proprio quel giorno, lo modifica;
--   - se è iniziato prima, lo chiude al giorno precedente e ne apre una copia
--     da p_dal (fino alla stessa fine), su cui applica le modifiche;
--   - se quel giorno non c'è un orario, ne apre uno nuovo da p_dal fino al
--     giorno prima del successivo (o senza fine).
-- Operazioni (jsonb array):
--   {"op":"add", "giorno_settimana":2, "ora_inizio":"16:30", "ora_fine":"18:30", "club":"cingoli", "attivita":"atletica"}
--   {"op":"update", "slot_id":"<turno dell'orario valido a p_dal>", "ora_inizio":"17:00", "ora_fine":"19:00", "club":..., "attivita":...}
--   {"op":"delete", "slot_id":"<turno dell'orario valido a p_dal>"}
-- Restituisce l'id dell'orario modificato o creato.

create or replace function public.work_schedule_apply(p_staff uuid, p_dal date, p_ops jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_corrente public.work_schedule%rowtype;
  v_trovato boolean;
  v_prossimo date;
  v_target uuid;
  v_mappa jsonb := '{}'::jsonb;
  v_op jsonb;
  v_slot uuid;
  v_nuovo uuid;
  r record;
begin
  if p_staff is null or p_dal is null then
    raise exception 'Maestro e data sono obbligatori.';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 then
    raise exception 'Nessuna modifica da applicare.';
  end if;

  select * into v_corrente
  from public.work_schedule
  where staff_id = p_staff
    and valido_dal <= p_dal
    and (valido_al is null or valido_al >= p_dal)
  for update;
  v_trovato := found;

  if v_trovato and v_corrente.valido_dal = p_dal then
    v_target := v_corrente.id;
    select coalesce(jsonb_object_agg(s.id::text, s.id::text), '{}'::jsonb) into v_mappa
    from public.work_schedule_slots as s
    where s.schedule_id = v_target;
  elsif v_trovato then
    update public.work_schedule set valido_al = p_dal - 1, updated_at = now() where id = v_corrente.id;
    insert into public.work_schedule (staff_id, valido_dal, valido_al, note)
    values (p_staff, p_dal, v_corrente.valido_al, v_corrente.note)
    returning id into v_target;
    for r in select * from public.work_schedule_slots where schedule_id = v_corrente.id loop
      insert into public.work_schedule_slots (schedule_id, giorno_settimana, ora_inizio, ora_fine, club, attivita)
      values (v_target, r.giorno_settimana, r.ora_inizio, r.ora_fine, r.club, r.attivita)
      returning id into v_nuovo;
      v_mappa := v_mappa || jsonb_build_object(r.id::text, v_nuovo::text);
    end loop;
  else
    select min(valido_dal) into v_prossimo
    from public.work_schedule
    where staff_id = p_staff and valido_dal > p_dal;
    insert into public.work_schedule (staff_id, valido_dal, valido_al)
    values (p_staff, p_dal, v_prossimo - 1)
    returning id into v_target;
  end if;

  for v_op in select * from jsonb_array_elements(p_ops) loop
    if v_op->>'op' = 'add' then
      insert into public.work_schedule_slots (schedule_id, giorno_settimana, ora_inizio, ora_fine, club, attivita)
      values (
        v_target,
        (v_op->>'giorno_settimana')::smallint,
        (v_op->>'ora_inizio')::time,
        (v_op->>'ora_fine')::time,
        coalesce(v_op->>'club', 'cingoli'),
        coalesce(v_op->>'attivita', 'tennis')
      );
    elsif v_op->>'op' in ('update', 'delete') then
      v_slot := (v_mappa->>(v_op->>'slot_id'))::uuid;
      if v_slot is null then
        raise exception 'Il turno da modificare non fa parte dell''orario valido il %.', to_char(p_dal, 'DD/MM/YYYY');
      end if;
      if v_op->>'op' = 'delete' then
        delete from public.work_schedule_slots where id = v_slot;
      else
        update public.work_schedule_slots
        set ora_inizio = coalesce((v_op->>'ora_inizio')::time, ora_inizio),
            ora_fine = coalesce((v_op->>'ora_fine')::time, ora_fine),
            club = coalesce(v_op->>'club', club),
            attivita = coalesce(v_op->>'attivita', attivita)
        where id = v_slot;
      end if;
    else
      raise exception 'Operazione non valida: %.', coalesce(v_op->>'op', '(vuota)');
    end if;
  end loop;

  update public.work_schedule set updated_at = now() where id = v_target;
  return v_target;
end
$$;

revoke all on function public.work_schedule_apply(uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.work_schedule_apply(uuid, date, jsonb) to service_role;
