-- Traccia il livello di difficoltà (1-5, ultra) usato in ogni partita
-- salvata in classifica, per dare contesto al punteggio.

alter table public.legends_game_score
  add column if not exists difficulty text;
