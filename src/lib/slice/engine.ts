// Logica pura del gioco "Slice" — nessuna dipendenza dal DOM o da Svelte.
// Clone tennis-themed di Threes!: PUNTO+15 è l'unica fusione "mista" (1+2=3),
// da lì in poi si fondono solo tessere identiche, raddoppiando lungo la scala
// del punteggio tennis: PUNTO, 15, 30, 40, 1°GAME..6°GAME, 1°SET..3°SET, MATCH.

export type Dir = 'up' | 'down' | 'left' | 'right';

export const LABELS = [
  'PUNTO',
  '15',
  '30',
  '40',
  '1°GAME',
  '2°GAME',
  '3°GAME',
  '4°GAME',
  '5°GAME',
  '6°GAME',
  '1°SET',
  '2°SET',
  '3°SET',
  'MATCH',
] as const;

export const VALUES = [1, 2, 3, 6, 12, 24, 48, 96, 192, 384, 768, 1536, 3072, 6144] as const;

export const MAX_LEVEL = LABELS.length - 1; // 13 (MATCH)

/**
 * Punteggio di una singola tessera, come in Threes!: non il suo valore
 * tennis, ma 3 elevato a un esponente che sale di 1 ad ogni raddoppio.
 * PUNTO e 15 (livelli 0-1) non contano nulla, sono solo "carburante". Così
 * fondere due tessere identiche non lascia il punteggio invariato (la somma
 * dei valori tennis raddoppierebbe comunque): il merge vale sempre ×3, quindi
 * conviene sempre più che tenerle separate.
 */
function tileScore(level: number): number {
  return level < 2 ? 0 : 3 ** (level - 1);
}

/** Punteggio finale: somma del punteggio (non del valore tennis) di ogni tessera in campo. */
export function score(tiles: Tile[]): number {
  return tiles.reduce((sum, t) => sum + tileScore(t.level), 0);
}

export interface Tile {
  id: number;
  level: number; // 0..MAX_LEVEL, indice in LABELS/VALUES
  row: number;
  col: number;
}

export interface GameState {
  tiles: Tile[];
  /** livello più alto raggiunto finora (resta anche se quella tessera si è poi fusa oltre). */
  highestLevel: number;
  status: 'playing' | 'won' | 'over';
  /** stato del RNG mulberry32: rende lo spawn deterministico dato un seed. */
  rngSeed: number;
  /** mazzo delle prossime tessere da spawnare: si pesca dal fondo, si rimescola da vuoto. */
  bag: number[];
  /** livello della prossima tessera in uscita, già impegnato: è quello mostrato in anteprima. */
  nextLevel: number;
}

/** Esito di una mossa: descrive l'animazione, non solo il risultato. */
export interface MoveResult {
  moved: boolean;
  slides: { id: number; row: number; col: number }[];
  removed: { id: number; reason: 'merged' }[];
  created: Tile[];
  spawned: Tile | null;
  levelUp: number | null;
  won: boolean;
  gameOver: boolean;
  state: GameState;
}

const SIZE = 4;

/**
 * PUNTO (0) e 15 (1) si comportano come l'1 e il 2 di Threes!: non si sommano
 * con sé stessi, solo PUNTO+15 produce 30. Da 30 in su le tessere si sommano
 * solo se identiche, salendo di un livello alla volta. Due MATCH (livello
 * massimo) fanno vincere la partita invece di generare una tessera nuova.
 */
export function mergeRule(a: number, b: number): number | 'WIN' | null {
  if ((a === 0 && b === 1) || (a === 1 && b === 0)) return 2;
  if (a !== b) return null;
  if (a === 0 || a === 1) return null;
  if (a >= MAX_LEVEL) return 'WIN';
  return a + 1;
}

// mulberry32, passo puro: dato uno stato ritorna un valore [0,1) e il prossimo stato.
function mulberry32Step(state: number): { value: number; nextState: number } {
  let a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState: a };
}

type PlanSlot =
  | { type: 'keep'; tile: Tile; at: [number, number] }
  | { type: 'merge'; a: Tile; b: Tile; level: number; at: [number, number] }
  | { type: 'win'; a: Tile; b: Tile; at: [number, number] };

interface Plan {
  slots: PlanSlot[];
  changed: boolean;
}

function slotFor(dir: Dir, i: number, j: number): [number, number] {
  switch (dir) {
    case 'up': return [j, i];
    case 'down': return [SIZE - 1 - j, i];
    case 'left': return [i, j];
    case 'right': return [i, SIZE - 1 - j];
  }
}

// Cella di una linea durante la risoluzione di una mossa: vuota, una tessera
// ferma/in scorrimento di una sola casella, o il risultato di una fusione
// (che "blocca" quella casella per il resto del passaggio, niente fusioni a
// catena nella stessa mossa).
type LineCell =
  | { kind: 'empty' }
  | { kind: 'tile'; tile: Tile }
  | { kind: 'merge'; a: Tile; b: Tile; level: number }
  | { kind: 'win'; a: Tile; b: Tile };

/**
 * A differenza di un 2048/Quindici, in Slice ogni tessera scorre al massimo
 * di UNA casella per mossa (come in Threes!): non si compattano verso il
 * bordo. Si scorre la linea dal bordo di destinazione verso l'interno; ogni
 * tessera guarda solo la cella immediatamente davanti a sé (nello stato già
 * aggiornato da questo stesso passaggio): se è vuota si sposta lì, se
 * contiene una tessera compatibile si fondono, altrimenti resta ferma.
 */
function buildPlan(tiles: Tile[], dir: Dir): Plan {
  const occ = new Map<string, Tile>();
  for (const t of tiles) occ.set(`${t.row},${t.col}`, t);

  const slots: PlanSlot[] = [];
  let changed = false;

  for (let i = 0; i < SIZE; i++) {
    const slotCoords: [number, number][] = [];
    for (let j = 0; j < SIZE; j++) slotCoords.push(slotFor(dir, i, j));

    const line: LineCell[] = slotCoords.map(([r, c]) => {
      const t = occ.get(`${r},${c}`);
      return t ? { kind: 'tile', tile: t } : { kind: 'empty' };
    });

    for (let j = 1; j < SIZE; j++) {
      const cur = line[j];
      if (cur.kind !== 'tile') continue;
      const front = line[j - 1];

      if (front.kind === 'empty') {
        line[j - 1] = cur;
        line[j] = { kind: 'empty' };
        continue;
      }
      if (front.kind !== 'tile') continue; // già bloccata da una fusione in questo passaggio

      const res = mergeRule(front.tile.level, cur.tile.level);
      if (res === 'WIN') {
        line[j - 1] = { kind: 'win', a: front.tile, b: cur.tile };
        line[j] = { kind: 'empty' };
      } else if (res !== null) {
        line[j - 1] = { kind: 'merge', a: front.tile, b: cur.tile, level: res };
        line[j] = { kind: 'empty' };
      }
      // altrimenti: bloccata, la tessera resta ferma in j
    }

    for (let j = 0; j < SIZE; j++) {
      const cell = line[j];
      const at = slotCoords[j];
      if (cell.kind === 'tile') {
        slots.push({ type: 'keep', tile: cell.tile, at });
        if (cell.tile.row !== at[0] || cell.tile.col !== at[1]) changed = true;
      } else if (cell.kind === 'merge') {
        slots.push({ type: 'merge', a: cell.a, b: cell.b, level: cell.level, at });
        changed = true;
      } else if (cell.kind === 'win') {
        slots.push({ type: 'win', a: cell.a, b: cell.b, at });
        changed = true;
      }
    }
  }

  return { slots, changed };
}

export function canMove(state: GameState): boolean {
  return (['up', 'down', 'left', 'right'] as Dir[]).some(
    (dir) => buildPlan(state.tiles, dir).changed,
  );
}

function freeCells(tiles: Tile[]): [number, number][] {
  const occ = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const free: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!occ.has(`${r},${c}`)) free.push([r, c]);
    }
  }
  return free;
}

// Preferisce celle "isolate" (riga e colonna ancora libere da altre tessere),
// poi celle con almeno la colonna libera, prima di ripiegare su una cella
// qualsiasi: evita che i nuovi spawn si accumulino sempre sulle stesse righe
// o colonne già occupate, accelerando per sbaglio le fusioni.
function spawnCandidates(tiles: Tile[], free: [number, number][]): [number, number][] {
  const occupiedRows = new Set(tiles.map((t) => t.row));
  const occupiedCols = new Set(tiles.map((t) => t.col));

  const isolated = free.filter(([r, c]) => !occupiedRows.has(r) && !occupiedCols.has(c));
  if (isolated.length > 0) return isolated;

  const freeColumn = free.filter(([, c]) => !occupiedCols.has(c));
  if (freeColumn.length > 0) return freeColumn;

  return free;
}

// Cella per cella, il bordo opposto alla direzione dello swipe: è lì che in
// Threes! nascono le nuove tessere. Tenerle "in fila" dal lato da cui si è
// appena arrivati, invece che sparse a caso, è essenziale quando ogni
// tessera si muove di una sola casella a mossa: se le nuove tessere
// nascessero isolate lontano dalle altre (come in Quindici, dove ogni mossa
// compatta comunque tutto il bordo) non farebbero mai in tempo a incontrarsi.
function edgeCells(dir: Dir): [number, number][] {
  const cells: [number, number][] = [];
  switch (dir) {
    case 'up':
      for (let c = 0; c < SIZE; c++) cells.push([SIZE - 1, c]);
      break;
    case 'down':
      for (let c = 0; c < SIZE; c++) cells.push([0, c]);
      break;
    case 'left':
      for (let r = 0; r < SIZE; r++) cells.push([r, SIZE - 1]);
      break;
    case 'right':
      for (let r = 0; r < SIZE; r++) cells.push([r, 0]);
      break;
  }
  return cells;
}

/**
 * Come in Threes!: man mano che la tessera più alta raggiunta cresce, iniziano
 * a comparire di tanto in tanto tessere "bonus" già avanzate lungo la scala,
 * non solo PUNTO/15/30. Il ventaglio di livelli papabili sale insieme al
 * massimo raggiunto (le tre più vicine sotto di esso, mai sotto il 40) — es.
 * raggiunto il 4°GAME spawnano anche 40/1°GAME, raggiunto il 5°GAME anche
 * 40/1°GAME/2°GAME, e così via. Ritorna null se il bonus non è ancora attivo.
 */
function bonusRange(highestLevel: number): [number, number] | null {
  const lo = Math.max(3, highestLevel - 5);
  const hi = highestLevel - 3;
  if (hi < lo) return null;
  return [lo, hi];
}

// Sistema a "mazzo" (bag) come in Threes!, invece di un RNG puro a ogni mossa:
// il mazzo contiene un numero fisso di PUNTO/15/30 (più eventualmente una
// tessera bonus), lo si mescola e lo si pesca fino a esaurirlo, poi si
// rimescola. Così su ogni mazzo esce esattamente lo stesso numero di ciascuna
// tessera. Il mazzo è volutamente corto (4 di ciascuna): PUNTO e 15 sono
// carburante a dipendenza reciproca (PUNTO si fonde solo con 15 e viceversa),
// e un mazzo lungo può farne uscire troppi di uno prima dell'altro — con 8 di
// ciascuna si accumulavano fino a 7 PUNTO spaiati. A 4 lo sbilancio massimo
// scende a 4, così arrivano più interlacciati e si accoppiano prima.
// Due vincoli tengono corte le serie, come nel Threes! reale (max 3-4):
//  1) si rimescola finché nessuna tessera compare più di MAX_RUN volte di
//     fila DENTRO il mazzo;
//  2) al confine, il mazzo nuovo non può iniziare con la stessa tessera
//     appena pescata, così nessuna serie attraversa la ricarica.
// Lo slot bonus è una singola carta. Per non far dipendere la frequenza dei
// bonus dalla lunghezza del mazzo (accorciandolo raddoppierebbe per sbaglio),
// lo slot entra solo in circa metà dei mazzi: così resta ~1 bonus ogni 25
// pescate. Quando pescato, si risolve nella finestra bonus corrente.
const BAG_PER_LEVEL = 4;
const BONUS_SLOT = -1;
const MAX_RUN = 3;
const BONUS_BAG_CHANCE = 0.5;

function maxRunLength(bag: number[]): number {
  let max = 1;
  let run = 1;
  for (let i = 1; i < bag.length; i++) {
    run = bag[i] === bag[i - 1] ? run + 1 : 1;
    if (run > max) max = run;
  }
  return max;
}

function shuffleBag(bag: number[], rngSeed: number): number {
  let seed = rngSeed;
  for (let i = bag.length - 1; i > 0; i--) {
    const roll = mulberry32Step(seed);
    seed = roll.nextState;
    const j = Math.floor(roll.value * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return seed;
}

// `avoid`: livello appena pescato dal mazzo precedente (o null all'inizio). Il
// mazzo si pesca dal fondo, quindi la prossima tessera è l'ultima dell'array.
// `bonusUnlocked`: se il bonus è disponibile; lo slot entra comunque solo in
// circa metà dei mazzi (BONUS_BAG_CHANCE), per non legarne la frequenza alla
// lunghezza del mazzo.
function makeBag(
  rngSeed: number,
  bonusUnlocked: boolean,
  avoid: number | null,
): { bag: number[]; rngSeed: number } {
  let seed = rngSeed;

  let withBonus = false;
  if (bonusUnlocked) {
    const bonusRoll = mulberry32Step(seed);
    seed = bonusRoll.nextState;
    withBonus = bonusRoll.value < BONUS_BAG_CHANCE;
  }

  const base: number[] = [];
  for (let level = 0; level <= 2; level++) {
    for (let k = 0; k < BAG_PER_LEVEL; k++) base.push(level);
  }
  if (withBonus) base.push(BONUS_SLOT);

  let bag = base.slice();
  for (let attempt = 0; attempt < 200; attempt++) {
    seed = shuffleBag(bag, seed);
    const runOk = maxRunLength(bag) <= MAX_RUN;
    const boundaryOk = avoid === null || bag[bag.length - 1] !== avoid;
    if (runOk && boundaryOk) break;
    bag = base.slice();
  }
  return { bag, rngSeed: seed };
}

function drawFromBag(
  bag: number[],
  rngSeed: number,
  highestLevel: number,
): { level: number; bag: number[]; rngSeed: number } {
  const bonusUnlocked = bonusRange(highestLevel) !== null;
  let currentBag = bag;
  let seed = rngSeed;

  // solo alla primissima pescata di una partita (mazzo vuoto, nessun confine)
  if (currentBag.length === 0) {
    const refilled = makeBag(seed, bonusUnlocked, null);
    currentBag = refilled.bag;
    seed = refilled.rngSeed;
  }

  const newBag = currentBag.slice();
  const drawn = newBag.pop() as number;

  let level: number;
  if (drawn !== BONUS_SLOT) {
    level = drawn;
  } else {
    // slot bonus: si risolve nella finestra bonus corrente (che può solo
    // crescere, quindi se lo slot è nel mazzo è per forza ancora valido)
    const range = bonusRange(highestLevel);
    if (range) {
      const roll = mulberry32Step(seed);
      const span = range[1] - range[0] + 1;
      level = range[0] + Math.min(span - 1, Math.floor(roll.value * span));
      seed = roll.nextState;
    } else {
      level = 2;
    }
  }

  // ricarica subito, ora che conosciamo la tessera appena pescata: così il
  // vincolo di confine tiene e nessuna serie attraversa il confine del mazzo.
  let outBag = newBag;
  if (outBag.length === 0) {
    const refilled = makeBag(seed, bonusUnlocked, level);
    outBag = refilled.bag;
    seed = refilled.rngSeed;
  }

  return { level, bag: outBag, rngSeed: seed };
}

// Piazza una tessera di livello GIÀ deciso (quello annunciato dall'anteprima)
// in una cella libera: qui si sceglie solo la posizione, non il valore.
function placeTile(
  tiles: Tile[],
  nextId: number,
  rngSeed: number,
  level: number,
  preferredCells?: [number, number][],
): { tile: Tile; rngSeed: number; nextId: number } | null {
  const free = freeCells(tiles);
  if (free.length === 0) return null;

  let candidates: [number, number][] | undefined;
  if (preferredCells) {
    const freeSet = new Set(free.map(([r, c]) => `${r},${c}`));
    candidates = preferredCells.filter(([r, c]) => freeSet.has(`${r},${c}`));
  }
  if (!candidates || candidates.length === 0) {
    candidates = spawnCandidates(tiles, free);
  }

  const pickRoll = mulberry32Step(rngSeed);
  const idx = Math.min(candidates.length - 1, Math.floor(pickRoll.value * candidates.length));
  const [row, col] = candidates[idx];

  return {
    tile: { id: nextId, level, row, col },
    rngSeed: pickRoll.nextState,
    nextId: nextId + 1,
  };
}

// Board iniziale: pesca un livello dal mazzo e lo piazza, ripetuto `count` volte.
function spawnMany(
  count: number,
  rngSeed: number,
  nextId: number,
): { tiles: Tile[]; rngSeed: number; nextId: number; bag: number[] } {
  let tiles: Tile[] = [];
  let seed = rngSeed;
  let id = nextId;
  let bag: number[] = [];
  for (let i = 0; i < count; i++) {
    const draw = drawFromBag(bag, seed, 0);
    seed = draw.rngSeed;
    bag = draw.bag;
    const placed = placeTile(tiles, id, seed, draw.level);
    if (!placed) break;
    tiles = [...tiles, placed.tile];
    seed = placed.rngSeed;
    id = placed.nextId;
  }
  return { tiles, rngSeed: seed, nextId: id, bag };
}

export function newGame(seed?: number): GameState {
  const initialSeed = (seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const countRoll = mulberry32Step(initialSeed);
  const initialCount = 3 + Math.floor(countRoll.value * 4); // 3..6 tessere iniziali
  const spawnResult = spawnMany(initialCount, countRoll.nextState, 1);
  // prima anteprima: la tessera che uscirà alla prima mossa
  const firstDraw = drawFromBag(spawnResult.bag, spawnResult.rngSeed, 0);
  return {
    tiles: spawnResult.tiles,
    highestLevel: 0,
    status: 'playing',
    rngSeed: firstDraw.rngSeed,
    bag: firstDraw.bag,
    nextLevel: firstDraw.level,
  };
}

export function move(state: GameState, dir: Dir): MoveResult {
  const noop: MoveResult = {
    moved: false,
    slides: [],
    removed: [],
    created: [],
    spawned: null,
    levelUp: null,
    won: false,
    gameOver: false,
    state,
  };
  if (state.status !== 'playing') return noop;

  const plan = buildPlan(state.tiles, dir);
  if (!plan.changed) return noop;

  const slides: { id: number; row: number; col: number }[] = [];
  const removed: { id: number; reason: 'merged' }[] = [];
  const created: Tile[] = [];
  const keptTiles: Tile[] = [];

  let nextId = state.tiles.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  let highestLevel = state.highestLevel;
  let levelUp: number | null = null;
  let won = false;

  for (const slot of plan.slots) {
    if (slot.type === 'keep') {
      const { tile, at } = slot;
      if (tile.row !== at[0] || tile.col !== at[1]) {
        slides.push({ id: tile.id, row: at[0], col: at[1] });
      }
      keptTiles.push({ ...tile, row: at[0], col: at[1] });
    } else if (slot.type === 'merge') {
      slides.push({ id: slot.a.id, row: slot.at[0], col: slot.at[1] });
      slides.push({ id: slot.b.id, row: slot.at[0], col: slot.at[1] });
      removed.push({ id: slot.a.id, reason: 'merged' });
      removed.push({ id: slot.b.id, reason: 'merged' });
      const tile: Tile = { id: nextId++, level: slot.level, row: slot.at[0], col: slot.at[1] };
      created.push(tile);
      keptTiles.push(tile);
      if (slot.level > highestLevel) {
        highestLevel = slot.level;
        levelUp = slot.level;
      }
    } else {
      // win: le due tessere MATCH convergono e spariscono, non nasce nessuna tessera
      slides.push({ id: slot.a.id, row: slot.at[0], col: slot.at[1] });
      slides.push({ id: slot.b.id, row: slot.at[0], col: slot.at[1] });
      removed.push({ id: slot.a.id, reason: 'merged' });
      removed.push({ id: slot.b.id, reason: 'merged' });
      won = true;
    }
  }

  if (won) {
    const newState: GameState = {
      tiles: keptTiles, highestLevel, status: 'won', rngSeed: state.rngSeed, bag: state.bag, nextLevel: state.nextLevel,
    };
    return { moved: true, slides, removed, created, spawned: null, levelUp, won: true, gameOver: false, state: newState };
  }

  let rngSeed = state.rngSeed;
  let bag = state.bag;
  let nextLevel = state.nextLevel;
  let spawned: Tile | null = null;
  let finalTiles = keptTiles;

  // spawna la tessera già annunciata dall'anteprima; il valore era deciso,
  // qui si decide solo dove (bordo opposto allo swipe)
  const placed = placeTile(keptTiles, nextId, rngSeed, state.nextLevel, edgeCells(dir));
  if (placed) {
    spawned = placed.tile;
    finalTiles = [...keptTiles, spawned];
    rngSeed = placed.rngSeed;

    // la prossima anteprima si pesca dal mazzo VECCHIO: la tessera che era in
    // coda viene sempre onorata, anche se questa mossa cambia livello
    const draw = drawFromBag(bag, rngSeed, highestLevel);
    nextLevel = draw.level;
    rngSeed = draw.rngSeed;
    bag = draw.bag;

    // al raggiungimento di un nuovo livello il resto del mazzo si rigenera per
    // la finestra bonus aggiornata, ma l'anteprima appena pescata resta
    if (levelUp !== null) {
      const regen = makeBag(rngSeed, bonusRange(highestLevel) !== null, nextLevel);
      bag = regen.bag;
      rngSeed = regen.rngSeed;
    }
  }

  let status: GameState['status'] = 'playing';
  let gameOver = false;
  if (!canMove({ tiles: finalTiles, highestLevel, status, rngSeed, bag, nextLevel })) {
    status = 'over';
    gameOver = true;
  }

  const newState: GameState = { tiles: finalTiles, highestLevel, status, rngSeed, bag, nextLevel };

  return { moved: true, slides, removed, created, spawned, levelUp, won: false, gameOver, state: newState };
}
