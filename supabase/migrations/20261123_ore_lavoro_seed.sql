-- Dati iniziali delle ore di lavoro: i due maestri e il loro orario
-- settimanale in vigore dal 1° settembre 2026 (inizio della stagione da
-- importare). I nomi sono segnaposto, da rinominare dalla pagina
-- /admin/ore-lavoro (o con un update su public.staff): così nessun nome
-- reale finisce nel repository.
--
-- Idempotente: non fa nulla se esiste già un maestro marcato sono_io.

do $$
declare
  v_io uuid;
  v_altro uuid;
  v_orario uuid;
begin
  if exists (select 1 from public.staff where sono_io) then
    return;
  end if;

  insert into public.staff (nome, ruolo, colore, sono_io)
  values ('Io', 'maestro', '#22c55e', true)
  returning id into v_io;

  insert into public.staff (nome, ruolo, colore)
  values ('Altro maestro', 'maestro', '#38bdf8')
  returning id into v_altro;

  insert into public.work_schedule (staff_id, valido_dal)
  values (v_io, date '2026-09-01')
  returning id into v_orario;

  insert into public.work_schedule_slots (schedule_id, giorno_settimana, ora_inizio, ora_fine)
  values
    (v_orario, 1, '16:00', '21:30'),
    (v_orario, 2, '16:30', '18:30'),
    (v_orario, 3, '16:00', '17:30'),
    (v_orario, 4, '20:00', '21:00'),
    (v_orario, 5, '15:30', '19:30');

  insert into public.work_schedule (staff_id, valido_dal)
  values (v_altro, date '2026-09-01')
  returning id into v_orario;

  insert into public.work_schedule_slots (schedule_id, giorno_settimana, ora_inizio, ora_fine)
  values
    (v_orario, 2, '15:30', '19:30'),
    (v_orario, 4, '15:00', '20:00');
end
$$;
