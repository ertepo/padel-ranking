# Quindici — specifica di implementazione

Gioco puzzle a griglia per **tie-break.it** (Astro + Svelte). È un 2048 in cui
le tessere sono i punteggi del tennis (15, 30, 40, AD): completare la scala
non chiude una partita contro un avversario, ma sblocca il **livello
successivo** — una scala identica ma isolata, che riparte da zero. L'obiettivo
è arrivare più in alto possibile, come la tessera massima nel 2048 originale.

Non c'è avversario: è un gioco a giocatore singolo.

---

## 1. Regole di gioco

### Griglia
4x4. Ogni cella è vuota o contiene una tessera. Una tessera è definita da una
coppia **(livello, step)**:

- `step` è `0 | 15 | 30 | 40 | "AD"`.
- `level` va da `0` a `MAX_LEVEL` (5).
- Lo step `0` è il "seme"/jolly di ogni livello, livello 0 compreso: spawna
  direttamente per il livello 0, mentre dal livello 1 in su nasce quando il
  livello precedente si completa.

Sulla tessera si vedono due informazioni separate: lo **step** al centro
(`15`/`30`/`40`/`AD`, oppure una pallina colorata per lo step `0`) e il
**livello** in piccolo nell'angolo in alto a sinistra. Il colore di sfondo
codifica entrambe le cose insieme: una tinta base per livello (0 blu, 1 verde,
2 giallo, 3 rosso, 4 viola, 5 nero) che si fa più intensa man mano che lo step
sale verso `AD`.

### Movimento
Swipe/freccia in una delle 4 direzioni. Tutte le tessere scorrono verso quel
bordo e si compattano, come in 2048. Se nulla si muove e nulla si fonde, la
mossa non è valida: non si spawna nulla e il turno non cambia.

Vale la regola classica di 2048: **una tessera nata da una fusione non può
fondersi di nuovo nella stessa mossa**. Non ci sono uscite dai bordi: nessuna
tessera lascia mai il campo per merito della direzione della mossa.

### Fusioni
**Due tessere si fondono solo se sono dello stesso livello.** Tessere di
livelli diversi non interagiscono mai, anche se adiacenti (si comportano come
valori incompatibili: bloccano semplicemente lo scorrimento).

All'interno dello stesso livello, il jolly è lo **step `0`** (dove esiste): si
somma con qualsiasi altro step dello stesso livello e lo fa avanzare. `15` non
è più jolly: si somma solo con un altro `15`, esattamente come `30`, `40` e
`AD` si sommano solo con sé stessi.

| Coppia (stesso livello) | Risultato |
|---|---|
| 0 + 0 | 15 |
| 0 + 15 | 30 |
| 0 + 30 | 40 |
| 0 + 40 | **livello successivo** (step 0), o **vittoria** al livello massimo |
| 0 + AD | **livello successivo**, o **vittoria** |
| 15 + 15 | 30 |
| 30 + 30 | 40 |
| 40 + 40 | AD |
| AD + AD | **livello successivo**, o **vittoria** |
| 15 + 30, 15 + 40, 15 + AD, 30 + 40, 30 + AD, 40 + AD | non si fondono |

Il livello 0 si comporta come tutti gli altri: lo spawn genera direttamente
tessere `0` (jolly), quindi il jolly è disponibile fin dall'inizio della
partita, non solo dal livello 1 in su.

### Livelli e vittoria
Completare la scala di un livello (una delle tre combinazioni sopra) crea la
tessera `0` del livello successivo — una tessera vera e propria, che resta sul
campo e va fatta crescere di nuovo lungo la stessa scala, isolata da tutto il
resto.

Se il livello appena completato è il **livello massimo** (`MAX_LEVEL`, 5), non
nasce nessuna tessera: le due tessere che si fondono spariscono e basta e la
partita è **vinta**.

### Spawn
Dopo ogni mossa valida compare **una** tessera in una cella libera a caso,
sempre di livello 0: 80% step `0`, 20% step `15`. A inizio partita se ne
spawnano 2.

Lo spawn preferisce celle "isolate" (riga e colonna ancora del tutto libere da
altre tessere); se non esistono, preferisce almeno una colonna libera; solo
come ultima risorsa sceglie una cella libera qualsiasi. Questo evita che le
nuove tessere si accumulino sempre sulle stesse righe/colonne già occupate,
accelerando per sbaglio le fusioni.

### Game over
Se non esiste nessuna mossa valida in nessuna direzione, la partita finisce
lì: **game over**, come in un 2048 qualunque. Nessun reset, nessun punteggio
verso un avversario: il campo resta fermo nella posizione finale.

---

## 2. Architettura richiesta

```
src/lib/quindici/engine.ts                    logica pura, zero DOM, zero Svelte
src/components/quindici/QuindiciBoard.svelte  griglia, tessere, animazioni, swipe
src/components/quindici/QuindiciGame.svelte   indicatore di livello, regole, input, stato partita
src/pages/arcade/quindici.astro                pagina, con <QuindiciGame client:load />
```

(`/arcade/legends` e `/arcade/classifica` sono già le route del gioco esistente sul sito:
Quindici segue la stessa convenzione, tutti i giochi arcade vivono sotto `/arcade`.)

### API dell'engine

```ts
export type Step = 0 | 15 | 30 | 40 | 'AD';
export interface Value { level: number; step: Step; }
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile { id: number; value: Value; row: number; col: number; }

export interface GameState {
  tiles: Tile[];
  highestLevel: number; // livello più alto raggiunto finora
  status: 'playing' | 'won' | 'over';
}

/** Esito di una mossa: descrive l'animazione, non solo il risultato. */
export interface MoveResult {
  moved: boolean;
  /** posizioni verso cui animare le tessere prima di risolvere le fusioni */
  slides: { id: number; row: number; col: number }[];
  /** tessere che spariscono (fuse, o nella fusione finale di vittoria) */
  removed: { id: number; reason: 'merged' }[];
  /** tessere nate da una fusione, da far comparire con un pop */
  created: Tile[];
  /** tessera nuova di spawn */
  spawned: Tile | null;
  /** livello raggiunto per la prima volta con questa mossa, se presente */
  levelUp: number | null;
  /** questa mossa ha completato il livello massimo: partita vinta */
  won: boolean;
  /** questa mossa ha portato a un campo senza mosse possibili: game over */
  gameOver: boolean;
  state: GameState;
}

export const MAX_LEVEL = 5;

export function valueLabel(v: Value): string;
export function newGame(seed?: number): GameState;
export function move(state: GameState, dir: Dir): MoveResult;
export function canMove(state: GameState): boolean;
export function mergeRule(a: Value, b: Value): Value | 'WIN' | null;
```

L'engine deve essere **deterministico se gli passi un seed** (RNG semplice tipo
mulberry32), così i test sono ripetibili.

### Test minimi da scrivere
1. `mergeRule` copre tutte le combinazioni della tabella per un livello con
   step `0` (0 jolly su 15/30/40/AD, 15/30/40/AD si sommano solo con sé stessi).
2. `mergeRule` tra due tessere di livello diverso è sempre `null`.
3. `0 + 0` dello stesso livello dà `15` dello stesso livello.
4. Completare un livello (0+40, 0+AD o AD+AD) sotto il livello massimo crea
   `{ level: level+1, step: 0 }`; al livello massimo restituisce `'WIN'`.
5. Una tessera nata da fusione non si rifonde nella stessa mossa.
6. `[15, 15, 15]` su una riga, swipe left → `[30, 15]`, non `[30, 30]` né `[40]`.
7. Mossa che non muove niente → `moved === false`, nessuno spawn.
8. Una mossa che completa il livello massimo → `won === true`, nessuna
   tessera creata, le due tessere sparite.
9. Uno stallo (nessuna mossa possibile in nessuna direzione) → `gameOver ===
   true`, `status === 'over'`, il campo non cambia.

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
- Il livello e lo step sono due informazioni diverse e vanno lette entrambe a
  colpo d'occhio: il colore di sfondo li codifica insieme (tinta per livello,
  intensità crescente per step), e il numero di livello è scritto anche per
  esteso nell'angolo in alto a sinistra della tessera.
- Grafica: adattala al design system del sito, non copiare i colori del
  prototipo. Deve stare accanto all'altro gioco già presente sul sito.

## 4. Fatto quando
- I test passano.
- Si gioca con tastiera su desktop e con swipe su mobile, senza che la pagina scrolli.
- Si vede chiaramente il livello attuale, e le schermate di vittoria e di game over.
- La pagina è linkata dalla sezione giochi del sito.

## 5. Storia delle revisioni
1. **Uscita direzionale**: ogni fusione che chiudeva la scala assegnava
   subito un game in base alla sola direzione della mossa (su = giocatore,
   giù/sinistra/destra = avversario). Il 15 jolly rendeva troppo facile
   regalare games per sbaglio.
2. **Tessera G persistente**: la chiusura smette di essere istantanea. Nasce
   una tessera "G" che va manovrata fino al bordo giusto e poi espulsa con un
   secondo swipe nella stessa direzione; le uscite laterali vengono rimosse.
3. **Livelli**: eliminata anche l'uscita dai bordi e il concetto di
   avversario. Completare la scala non fa più uscire nulla dal campo: fa
   nascere il seme (`0`) di un nuovo livello, una scala identica ma isolata.
   Il gioco diventa a giocatore singolo: l'obiettivo è superare il livello
   massimo (vittoria) prima di restare senza mosse (game over). In questa
   prima versione il jolly restava `15` e `0` si sommava solo con un altro `0`.
4. **Jolly spostato su `0`**: il ruolo di jolly passa dal `15` allo step `0`.
   `15` diventa un doppione normale come `30`/`40`/`AD` (si somma solo con un
   altro `15`).
5. **Spawn dello `0` anche al livello base, `MAX_LEVEL` a 5, nuova
   colorazione (attuale)**: lo spawn genera direttamente tessere `0` (80%) e
   `15` (20%) invece di `15`/`30` — il jolly è quindi disponibile fin
   dall'inizio della partita, non solo dal livello 1 in su. `MAX_LEVEL` sale
   da 4 a 5, con i colori viola (livello 4) e nero (livello 5) aggiunti alla
   scala blu/verde/giallo/rosso. Il bordo colorato per livello viene sostituito
   da uno sfondo colorato (tinta per livello, intensità per step) più un
   numero di livello nell'angolo della tessera; lo step `0` non mostra più un
   numero ma una pallina piena dello stesso colore del livello.
