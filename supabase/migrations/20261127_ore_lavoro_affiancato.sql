-- Ore di lavoro: una persona "affiancata" a un'altra (per esempio il partner).
-- Nel calendario di ciascuna delle due si possono mostrare sempre i turni
-- dell'altra, senza mostrare tutti i colleghi. Basta impostarlo su una delle
-- due: l'abbinamento vale nei due sensi.
-- Richiede la migrazione 20261123.

alter table public.staff
  add column if not exists affiancato_id uuid references public.staff(id) on delete set null;

alter table public.staff drop constraint if exists staff_affiancato_diverso;
alter table public.staff
  add constraint staff_affiancato_diverso check (affiancato_id is null or affiancato_id <> id);
