# Gioco dello scambio — design document

Gioco a turni con tema tennis ispirato alla dinamica dei Pokemon, da integrare
nel sito ASD Tie-Break (Astro + Svelte + Supabase).

## Concept

Il giocatore affronta un avversario (CPU o, in futuro, un altro utente).
Ognuno ha un roster di 6 tennisti scelti da un database di leggende (1970-oggi).
Si vince arrivando per primi a 6 game. Ogni game si gioca con il
"gioco dello scambio": un minigioco di memoria in stile Simon.

## Il gioco dello scambio

- Il campo è visto dall'alto: 5 riquadri sopra la rete (metà campo
  avversario) e 5 sotto (metà campo del giocatore), disposti a clessidra
  (fila da 3 verso il fondo campo, fila da 2 verso la rete) per staccarsi
  visivamente dalle linee del campo disegnato sullo sfondo.
- Una sequenza di riquadri si illumina uno alla volta. I colpi si alternano
  SEMPRE tra i due lati della rete, come una vera pallina che passa la rete.
  Il lato del primo colpo è casuale.
- Finita la riproduzione, il giocatore deve ripetere la sequenza cliccando
  i riquadri nell'ordine esatto, entro un tempo limite (barra visibile).
- Sequenza giusta = game al giocatore. Errore o tempo scaduto = game alla CPU.
- Lunghezza minima: 5 colpi. La sequenza cresce di 1 a ogni game giocato.
- Due colpi consecutivi non cadono mai sullo stesso riquadro.

## Giocatori

Ogni tennista esiste in un'unica versione (un solo Federer, un solo Borg...)
e ha tre caratteristiche:

- **Stile**: `att` (attaccante), `sv` (serve&volley), `reg` (regolarista)
- **Forza**: da 1 a 5
- **Superficie preferita**: `terra`, `erba`, `cemento`

## Triangolo degli stili (come i tipi Pokemon)

- serve&volley batte regolarista
- regolarista batte attaccante
- attaccante batte serve&volley

## Superficie del match

Sorteggiata a inizio match tra terra, erba e cemento. Un giocatore la cui
superficie preferita coincide con quella del match riceve un bonus.

## Calcolo della difficoltà

Prima di ogni game si calcola un punteggio di difficoltà `d` per il giocatore
umano (vedi `matchup.ts`):

```
d = (forza avversario - forza mia)
  - 1 se il mio stile batte il suo
  + 1 se il suo stile batte il mio
  - 1 se la superficie del match è la mia preferita
  + 1 se la superficie del match è la sua preferita
d è limitato all'intervallo [-3, +3]
```

`d` modifica tre parametri:

- lunghezza sequenza: `max(5, 4 + numeroGame + d)`
- velocità di riproduzione: 360ms se d>0, 480ms se d<0, 420ms se d=0
  (pausa tra colpi: 130ms)
- tempo per rispondere: lunghezza x (950ms se d>0, 1300ms se d<0, 1100ms se d=0)

Esempio: Federer (att, 5, erba) contro Nadal (reg, 5, terra) sulla terra:
d = 0 + 1 (reg batte att) + 1 (terra è la sua) = +2 -> "durissimo".

Etichette mostrate all'utente: d<=-2 molto favorevole, -1 favorevole,
0 equilibrato, +1 difficile, >=+2 durissimo.

## Difficoltà generale

Oltre alla difficoltà `d` calcolata per ogni singolo game (matchup contro
l'avversario), in fase di draft il giocatore sceglie anche una difficoltà
generale — facile, normale, difficile — che scala i parametri restituiti da
`gameParams` (senza modificare `matchup.ts`): allunga `showMs`/`inputMsPerStep`
e accorcia leggermente `seqLength` per facile/normale. La taratura "difficile"
coincide con i valori originali di `matchup.ts` (il livello più impegnativo).

## Flusso di un match

1. Sorteggio superficie.
2. La CPU mostra il suo roster di 6; il giocatore sceglie i suoi 6 dal database
   (fase draft, vede il roster CPU prima di scegliere) e la difficoltà generale.
   La scelta dei tennisti è vincolata per forza: esattamente 1 tennista di
   forza 5, 2 di forza 4, 2 di forza 3, 1 di forza 2.
3. A ogni game: la CPU schiera un tennista, il giocatore schiera il suo,
   l'indicatore di difficoltà è sempre visibile prima di iniziare.
4. Rotazione obbligatoria: sia la CPU sia il giocatore devono schierare un
   tennista diverso da quello appena usato. Un tennista non può essere
   riselezionato finché non sono stati usati tutti e 6 i membri del roster;
   a quel punto il blocco si resetta e torna disponibile l'intera rosa.
5. Primo a 6 game vince, ma se il punteggio arriva a 5 pari il traguardo
   sale a 7 (come un set di tennis vinto 7-5). Se si arriva a 6 pari, si
   gioca un game secco tra due tennisti scelti a caso (uno per squadra,
   senza vincoli di rotazione): chi lo vince vince la partita.

## Dati

Fase prototipo: i giocatori vivono in `players.json` (75 giocatori, 1970-oggi),
importato direttamente nel componente. Niente database per ora.

Migrazione futura su Supabase: la struttura dei record è già identica a quella
della tabella `players` prevista (name, style, strength, surface, era);
`players_seed.sql` è pronto per quando servirà (include RLS in sola lettura).
Insieme al database arriveranno anche la tabella `matches` per i risultati e
i roster per utente.

## Stato del lavoro

- Prototipo HTML/JS funzionante validato in chat (logica in `matchup.ts`).
- Dati giocatori pronti (`players.json`).
- Da fare: componente Svelte del campo, pagina Astro, texture superfici
  (campo terra/erba/cemento come sfondo), persistenza risultati, taratura
  dei modificatori dopo playtest.
