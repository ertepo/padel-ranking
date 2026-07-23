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
4x4. Ogni cella è vuota o contiene una tessera con valore `15 | 30 | 40 | "AD"`.

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
| 15 + 40 | **game** |
| 15 + AD | **game** |
| AD + AD | **game** |
| 30 + 40 | non si fondono |
| 30 + AD | non si fondono |
| 40 + AD | non si fondono |

### Chiusura del game
Le fusioni marcate **game** non producono una tessera: entrambe spariscono e la
casella resta **libera**. Le tessere rimanenti della linea si compattano
nello spazio liberato.

Chi si aggiudica il game dipende **solo dalla direzione della mossa**:

- swipe **verso l'alto** → il game è del giocatore;
- swipe verso il basso, a sinistra o a destra → il game va all'avversario.

Una singola mossa può chiudere più game contemporaneamente: contano tutti, e
vanno tutti allo stesso lato (la direzione è una sola).

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
src/lib/quindici/engine.ts      logica pura, zero DOM, zero Svelte
src/lib/quindici/engine.test.ts test unitari (vitest, se già presente nel repo)
src/components/Quindici.svelte  UI, input, animazioni
src/pages/giochi/quindici.astro pagina, con <Quindici client:load />
```

### API dell'engine

```ts
export type Value = 15 | 30 | 40 | 'AD';
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
  /** posizioni verso cui animare le tessere prima di risolvere le fusioni */
  slides: { id: number; row: number; col: number }[];
  /** tessere che spariscono, con il motivo */
  removed: { id: number; reason: 'merged' | 'point' }[];
  /** tessere nate da una fusione, da far comparire con un pop */
  created: Tile[];
  /** tessera nuova di spawn */
  spawned: Tile | null;
  /** games assegnati da questa mossa */
  pointsTo: 'player' | 'opponent' | null;
  pointsCount: number;
  deadlock: boolean;
  state: GameState;
}

export function newGame(seed?: number): GameState;
export function move(state: GameState, dir: Dir): MoveResult;
export function canMove(state: GameState): boolean;
export function mergeRule(a: Value, b: Value): Value | 'POINT' | null;
```

L'engine deve essere **deterministico se gli passi un seed** (RNG semplice tipo
mulberry32), così i test sono ripetibili.

### Test minimi da scrivere
1. `mergeRule` copre tutte le 10 combinazioni della tabella.
2. 40 e 15 in colonna, swipe up → `pointsTo === 'player'`, casella libera.
3. Stessa configurazione, swipe down → `pointsTo === 'opponent'`.
4. Una mossa che chiude 2 game insieme → `pointsCount === 2`.
5. Una tessera nata da fusione non si rifonde nella stessa mossa.
6. `[15, 15, 15]` su una riga, swipe left → `[30, 15]`, non `[30, 30]` né `[40]`.
7. Mossa che non muove niente → `moved === false`, nessuno spawn.
8. Punteggio: 5-5 → serve il 7; 6-6 → 7-6 chiude; 6-4 chiude; 6-5 no.
9. Stallo → game all'avversario e griglia con 2 tessere.

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
- La direzione è la meccanica centrale del gioco: va resa visibile. Nel
  prototipo il bordo superiore della griglia è marcato come "il tuo lato" e il
  bordo lampeggia del colore di chi ha appena preso il game. Mantieni questa
  idea o sostituiscila con qualcosa di equivalente, ma non lasciarla implicita.
- Grafica: adattala al design system del sito, non copiare i colori del
  prototipo. Deve stare accanto all'altro gioco già presente sul sito.

## 4. Fatto quando
- I test passano.
- Si gioca con tastiera su desktop e con swipe su mobile, senza che la pagina scrolli.
- Il set si chiude correttamente compresi i casi 7-5 e 7-6.
- La pagina è linkata dalla sezione giochi del sito.

## 5. Punto aperto sul bilanciamento
Il 15 jolly rende facile chiudere per sbaglio un 40 o un AD nella direzione
sbagliata, quindi l'avversario potrebbe prendere troppi games. Se dopo qualche
partita di prova il set finisce quasi sempre 0-6, la modifica da valutare è:
le chiusure a **sinistra e destra non danno il game a nessuno** (la casella si
libera e basta), lasciando solo il basso come errore punito. Non implementarla
adesso: tienila dietro una costante di configurazione così si prova in un minuto.
