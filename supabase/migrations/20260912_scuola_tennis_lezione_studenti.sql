-- Roster per singolo slot di calendario: alla creazione di una lezione il
-- gestionale propone di default tutti i membri del gruppo, ma l'iscrizione
-- viene copiata qui e può essere personalizzata slot per slot (es. un
-- allievo che si allena con un gruppo il martedì e con un altro il giovedì).

create table if not exists public.scuola_tennis_lezione_studenti (
  lezione_id uuid not null references public.scuola_tennis_lezioni(id) on delete cascade,
  studente_id uuid not null references public.scuola_tennis_studenti(id) on delete cascade,
  primary key (lezione_id, studente_id)
);

create index if not exists scuola_tennis_lezione_studenti_studente_id_idx
  on public.scuola_tennis_lezione_studenti(studente_id);

alter table public.scuola_tennis_lezione_studenti enable row level security;
revoke all on table public.scuola_tennis_lezione_studenti from anon, authenticated;
