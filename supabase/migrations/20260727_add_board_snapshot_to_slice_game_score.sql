-- "Fotografia" della board a fine partita di Slice: 16 valori separati da
-- virgola (livello della tessera, indice in LABELS/VALUES), riga per riga a
-- partire dall'angolo in alto a sinistra, cella vuota = campo vuoto tra due
-- virgole. Serve per ridisegnare la board com'era a fine partita (es. un
-- pulsante "info" in classifica che apre un modale con la griglia finale),
-- senza dover salvare l'intero GameState.

alter table public.slice_game_score
  add column if not exists board_snapshot text;
