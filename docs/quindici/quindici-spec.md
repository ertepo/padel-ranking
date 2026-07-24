# Quindici — specifica di implementazione

Gioco puzzle a griglia per **tie-break.it** (Astro + Svelte + Supabase).
È un 2048 in cui le tessere sono i punti del tennis e la direzione dello swipe
decide a chi va il game.

Riferimento funzionante: `quindici-prototype.html` — prototipo in HTML/JS puro,
già giocabile e con le regole corrette. Va usato come oracolo del comportamento,
**non** come codice da copiare: la logica va riscritta in TypeScript puro e
separata dalla UI.

---

## 1. Regole di gioco

### Griglia
4x4. Ogni cella è vuota o contiene una tessera con valore `15 | 30 | 40 | "AD" | "G"`.

### Movimento
Swipe/freccia in una delle 4 direzioni. Tutte le tessere scorrono verso quel
bordo e si compattano, come in 2048. Se nulla si muove e nulla si fonde, la
mossa non è valida: non si spawna nulla e il turno non cambia.

Vale la regola classica di 2048: **una tessera nata da una fusione non può
fondersi di nuovo nella stessa mossa**.

### Fusioni
Il **15 è jolly: si somma a qualsiasi tessera**. Le altre si sommano solo con
una uguale.

| Coppia | Risultato |
|---|---|
| 15 + 15 | 30 |
| 15 + 30 | 40 |
| 30 + 30 | 40 |
| 40 + 40 | AD |
| 15 + 40 | **G** |
| 15 + AD | **G** |
| AD + AD | **G** |
| 30 + 40 | non si fondono |
| 30 + AD | non si fondono |
| 40 + AD | non si fondono |
| G + qualsiasi | non si fonde mai (nemmeno G + G) |

### La tessera G e l'uscita dal campo
A differenza delle altre, la tessera **G non sparisce quando nasce**: resta
sul campo come una tessera vera e propria, si sposta con le altre ma non si
fonde mai con niente.

Solo il bordo **sopra** e il bordo **sotto** contano qualcosa; sinistra e
destra sono muri normali (una G che li tocca resta lì ferma, non esce mai).

Il meccanismo è in due tempi:

1. Fai scorrere la G finché non resta ferma contro il bordo sopra o sotto
   (come una tessera qualunque che sbatte contro il muro: si ferma, non esce).
2. Con la G già ferma contro quel bordo, uno swipe **successivo nella stessa
   direzione** la fa uscire dal campo: la casella si libera e il game va
   assegnato.

- G uscita dal bordo **sopra** → il game è del giocatore.
- G uscita dal bordo **sotto** → il game va all'avversario.

Una singola mossa può far uscire più G contemporaneamente (una per colonna):
contano tutte, e vanno tutte allo stesso lato (la direzione è una sola).

### Punteggio del set
Si contano i games. Vince il set chi:

- arriva a 6 con almeno 2 di scarto (6-0 … 6-4);
- sul 5 pari, arriva a 7 (7-5);
- sul 6 pari, vince il game successivo (7-6).

Formula: `vince(a, b) = (a >= 6 && a - b >= 2) || a === 7`.
Il punteggio non può superare 7.

### Spawn
Dopo ogni mossa valida compare **una** tessera in una cella libera a caso:
80% `15`, 20% `30`. A inizio partita si spawnano 2 tessere.

### Stallo
Se non esiste nessuna mossa valida in nessuna direzione: **un game
all'avversario** e la griglia si azzera (2 nuove tessere), mantenendo il
punteggio del set. Se quel game chiude il set, vince l'avversario.

### Cosa NON succede
- La griglia **non** si azzera dopo ogni game vinto o perso, solo dopo uno stallo.
- Non c'è timer, non c'è turno dell'avversario: l'avversario è solo un contatore.

---

## 2. Architettura richiesta

```
src/lib/quindici/engine.ts             logica pura, zero DOM, zero Svelte
src/components/quindici/QuindiciBoard.svelte  griglia, tessere, animazioni, swipe
src/components/quindici/QuindiciGame.svelte   scoreboard, regole, input, stato partita
src/pages/game/quindici.astro          pagina, con <QuindiciGame client:load />
```

(`/game` e `/game/classifica` sono già le route del gioco esistente sul sito:
Quindici segue la stessa convenzione invece di una cartella `/giochi` a parte.)

### API dell'engine

```ts
export type Value = 15 | 30 | 40 | 'AD' | 'G';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile { id: number; value: Value; row: number; col: number; }

export interface GameState {
  tiles: Tile[];
  gamesPlayer: number;
  gamesOpponent: number;
  status: 'playing' | 'won' | 'lost';
}

/** Esito di una mossa: descrive l'animazione, non solo il risultato. */
export interface MoveResult {
  moved: boolean;
  /** posizioni verso cui animare le tessere prima di risolvere fusioni/uscite */
  slides: { id: number; row: number; col: number }[];
  /** tessere che spariscono, con il motivo */
  removed: { id: number; reason: 'merged' | 'exit' }[];
  /** tessere nate da una fusione (compresa la G), da far comparire con un pop */
  created: Tile[];
  /** tessera nuova di spawn */
  spawned: Tile | null;
  /** games assegnati da questa mossa (una G uscita dal bordo sopra/sotto) */
  pointsTo: 'player' | 'opponent' | null;
  pointsCount: number;
  deadlock: boolean;
  state: GameState;
}

export function newGame(seed?: number): GameState;
export function move(state: GameState, dir: Dir): MoveResult;
export function canMove(state: GameState): boolean;
export function mergeRule(a: Value, b: Value): Value | null;
```

L'engine deve essere **deterministico se gli passi un seed** (RNG semplice tipo
mulberry32), così i test sono ripetibili.

### Test minimi da scrivere
1. `mergeRule` copre tutte le combinazioni della tabella, inclusi i tre casi
   che producono G e il fatto che G non si fonde mai (nemmeno con un'altra G).
2. 40 e 15 in colonna con la cella sopra libera, swipe up due volte: la prima
   compatta la G nata dalla fusione contro il bordo sopra (nessun punto
   ancora), la seconda la fa uscire → `pointsTo === 'player'`.
3. Stessa configurazione ma contro il bordo sotto, doppio swipe down →
   `pointsTo === 'opponent'`.
4. Uno swipe left o right con una G già al muro non la fa mai uscire.
5. Una mossa che fa uscire 2 G insieme (una per colonna) → `pointsCount === 2`.
6. Una tessera nata da fusione non si rifonde nella stessa mossa.
7. `[15, 15, 15]` su una riga, swipe left → `[30, 15]`, non `[30, 30]` né `[40]`.
8. Mossa che non muove niente → `moved === false`, nessuno spawn.
9. Punteggio: 5-5 → serve il 7; 6-6 → 7-6 chiude; 6-4 chiude; 6-5 no.
10. Stallo → game all'avversario e griglia con 2 tessere.

---

## 3. Note per la UI Svelte

- Tessere in **posizione assoluta** dentro la griglia, animate con `transform`
  e una transizione di ~110ms. Non ricreare i nodi a ogni mossa: la continuità
  dell'`id` è ciò che rende fluido lo scorrimento.
- Sequenza di una mossa: applica gli `slides` → attendi la transizione → applica
  `removed`/`created`/`spawned`. Blocca l'input finché non hai finito.
- Input: frecce, WASD, swipe touch con soglia ~24px. Su touch serve
  `touch-action: none` sulla griglia e `preventDefault` sul `touchmove`, o su
  mobile la pagina scrolla invece di giocare.
- Rispetta `prefers-reduced-motion`.
- La direzione è la meccanica centrale del gioco: va resa visibile. Bordo
  sopra e bordo sotto vanno marcati in modo permanente (es. tinta verde/rossa)
  come "zona tua"/"zona avversario", e devono lampeggiare più intensamente
  quando una G esce da quel lato. Sinistra e destra sono muri neutri, senza
  alcuna colorazione legata al punteggio.
- Grafica: adattala al design system del sito, non copiare i colori del
  prototipo. Deve stare accanto all'altro gioco già presente sul sito.

## 4. Fatto quando
- I test passano.
- Si gioca con tastiera su desktop e con swipe su mobile, senza che la pagina scrolli.
- Il set si chiude correttamente compresi i casi 7-5 e 7-6.
- La pagina è linkata dalla sezione giochi del sito.

## 5. Bilanciamento (risolto)
La prima versione assegnava il game istantaneamente a ogni fusione che
produceva una chiusura, in base alla sola direzione della mossa — il 15 jolly
rendeva troppo facile regalare games all'avversario per sbaglio, e le uscite
laterali (sinistra/destra → avversario) aggiungevano un altro modo di
sbagliare senza offrire un vantaggio equivalente al giocatore.

La revisione attuale introduce la tessera **G** persistente: il game non è più
un evento istantaneo di una singola fusione, ma richiede di manovrare
deliberatamente la G fino al bordo giusto e poi espellerla con un secondo
swipe. Questo dà al giocatore il tempo di accorgersi di una G pericolosa vicino
al bordo sotto e provare a spostarla altrove prima che esca, ed elimina del
tutto le uscite laterali (ora semplici muri neutri).
