// Logica pura del gioco "Quindici" — nessuna dipendenza dal DOM o da Svelte.
// Vedi docs/quindici/quindici-spec.md per le regole complete.

export type Value = 15 | 30 | 40 | 'AD' | 'G';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  value: Value;
  row: number;
  col: number;
}

export interface GameState {
  tiles: Tile[];
  gamesPlayer: number;
  gamesOpponent: number;
  status: 'playing' | 'won' | 'lost';
  /** stato del RNG mulberry32: rende lo spawn deterministico dato un seed. */
  rngSeed: number;
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
  /** games assegnati da questa mossa (una tessera G uscita dal bordo) */
  pointsTo: 'player' | 'opponent' | null;
  pointsCount: number;
  deadlock: boolean;
  state: GameState;
}

const SIZE = 4;

export function mergeRule(a: Value, b: Value): Value | null {
  const key = [String(a), String(b)].sort().join('|');
  switch (key) {
    case '15|15': return 30;
    case '15|30': return 40;
    case '30|30': return 40;
    case '40|40': return 'AD';
    case '15|40': return 'G';
    case '15|AD': return 'G';
    case 'AD|AD': return 'G';
    default: return null;
  }
}

function setOver(a: number, b: number): boolean {
  return (a >= 6 && a - b >= 2) || a === 7;
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
  | { type: 'merge'; a: Tile; b: Tile; value: Value; at: [number, number] }
  | { type: 'exit'; tile: Tile };

interface Plan {
  slots: PlanSlot[];
  changed: boolean;
  exitCount: number;
}

function slotFor(dir: Dir, i: number, j: number): [number, number] {
  switch (dir) {
    case 'up': return [j, i];
    case 'down': return [SIZE - 1 - j, i];
    case 'left': return [i, j];
    case 'right': return [i, SIZE - 1 - j];
  }
}

function buildPlan(tiles: Tile[], dir: Dir): Plan {
  const occ = new Map<string, Tile>();
  for (const t of tiles) occ.set(`${t.row},${t.col}`, t);

  const slots: PlanSlot[] = [];
  let changed = false;
  let exitCount = 0;
  const canExit = dir === 'up' || dir === 'down';

  for (let i = 0; i < SIZE; i++) {
    const slotCoords: [number, number][] = [];
    const line: Tile[] = [];
    for (let j = 0; j < SIZE; j++) {
      const [r, c] = slotFor(dir, i, j);
      slotCoords.push([r, c]);
      const t = occ.get(`${r},${c}`);
      if (t) line.push(t);
    }

    const edgeSlot = slotCoords[0];

    let idx = 0;
    let p = 0;
    while (idx < line.length) {
      const a = line[idx];

      // una tessera G già ferma contro il bordo verso cui si spinge esce dal
      // campo invece di restare ferma: serve un secondo swipe nella stessa
      // direzione per "espellerla" e guadagnare il game.
      if (canExit && a.value === 'G' && a.row === edgeSlot[0] && a.col === edgeSlot[1]) {
        slots.push({ type: 'exit', tile: a });
        exitCount++;
        changed = true;
        idx += 1;
        continue;
      }

      const b = line[idx + 1];
      const res = b ? mergeRule(a.value, b.value) : null;
      const at = slotCoords[p];

      if (res !== null) {
        slots.push({ type: 'merge', a, b: b!, value: res, at });
        changed = true;
        idx += 2;
        p++;
        continue;
      }
      slots.push({ type: 'keep', tile: a, at });
      if (a.row !== at[0] || a.col !== at[1]) changed = true;
      idx++;
      p++;
    }
  }

  return { slots, changed, exitCount };
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
// o colonne già occupate, accelerando per sbaglio le fusioni verso G.
function spawnCandidates(tiles: Tile[], free: [number, number][]): [number, number][] {
  const occupiedRows = new Set(tiles.map((t) => t.row));
  const occupiedCols = new Set(tiles.map((t) => t.col));

  const isolated = free.filter(([r, c]) => !occupiedRows.has(r) && !occupiedCols.has(c));
  if (isolated.length > 0) return isolated;

  const freeColumn = free.filter(([, c]) => !occupiedCols.has(c));
  if (freeColumn.length > 0) return freeColumn;

  return free;
}

function spawnTile(
  tiles: Tile[],
  nextId: number,
  rngSeed: number,
): { tile: Tile; rngSeed: number; nextId: number } | null {
  const free = freeCells(tiles);
  if (free.length === 0) return null;

  const candidates = spawnCandidates(tiles, free);

  const pickRoll = mulberry32Step(rngSeed);
  const idx = Math.min(candidates.length - 1, Math.floor(pickRoll.value * candidates.length));
  const valueRoll = mulberry32Step(pickRoll.nextState);
  const value: Value = valueRoll.value < 0.8 ? 15 : 30;
  const [row, col] = candidates[idx];

  return {
    tile: { id: nextId, value, row, col },
    rngSeed: valueRoll.nextState,
    nextId: nextId + 1,
  };
}

function spawnMany(
  count: number,
  rngSeed: number,
  nextId: number,
): { tiles: Tile[]; rngSeed: number; nextId: number } {
  let tiles: Tile[] = [];
  let seed = rngSeed;
  let id = nextId;
  for (let i = 0; i < count; i++) {
    const res = spawnTile(tiles, id, seed);
    if (!res) break;
    tiles = [...tiles, res.tile];
    seed = res.rngSeed;
    id = res.nextId;
  }
  return { tiles, rngSeed: seed, nextId: id };
}

export function newGame(seed?: number): GameState {
  const initialSeed = (seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const spawnResult = spawnMany(2, initialSeed, 1);
  return {
    tiles: spawnResult.tiles,
    gamesPlayer: 0,
    gamesOpponent: 0,
    status: 'playing',
    rngSeed: spawnResult.rngSeed,
  };
}

export function move(state: GameState, dir: Dir): MoveResult {
  const noop: MoveResult = {
    moved: false,
    slides: [],
    removed: [],
    created: [],
    spawned: null,
    pointsTo: null,
    pointsCount: 0,
    deadlock: false,
    state,
  };
  if (state.status !== 'playing') return noop;

  const plan = buildPlan(state.tiles, dir);
  if (!plan.changed) return noop;

  const slides: { id: number; row: number; col: number }[] = [];
  const removed: { id: number; reason: 'merged' | 'exit' }[] = [];
  const created: Tile[] = [];
  const keptTiles: Tile[] = [];

  let nextId = state.tiles.reduce((m, t) => Math.max(m, t.id), 0) + 1;

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
      const tile: Tile = { id: nextId++, value: slot.value, row: slot.at[0], col: slot.at[1] };
      created.push(tile);
      keptTiles.push(tile);
    } else {
      // exit: la tessera scivola oltre il bordo verso cui si spinge e sparisce
      const exitRow = dir === 'up' ? -1 : dir === 'down' ? SIZE : slot.tile.row;
      const exitCol = dir === 'left' ? -1 : dir === 'right' ? SIZE : slot.tile.col;
      slides.push({ id: slot.tile.id, row: exitRow, col: exitCol });
      removed.push({ id: slot.tile.id, reason: 'exit' });
    }
  }

  let gamesPlayer = state.gamesPlayer;
  let gamesOpponent = state.gamesOpponent;
  let pointsTo: 'player' | 'opponent' | null = null;
  let pointsCount = 0;

  if (plan.exitCount > 0) {
    pointsTo = dir === 'up' ? 'player' : 'opponent';
    pointsCount = plan.exitCount;
    if (pointsTo === 'player') gamesPlayer = Math.min(7, gamesPlayer + pointsCount);
    else gamesOpponent = Math.min(7, gamesOpponent + pointsCount);
  }

  let status: GameState['status'] = 'playing';
  if (setOver(gamesPlayer, gamesOpponent)) status = 'won';
  else if (setOver(gamesOpponent, gamesPlayer)) status = 'lost';

  let rngSeed = state.rngSeed;
  let spawned: Tile | null = null;
  let deadlock = false;
  let finalTiles = keptTiles;

  if (status === 'playing') {
    const spawnResult = spawnTile(keptTiles, nextId, rngSeed);
    if (spawnResult) {
      spawned = spawnResult.tile;
      finalTiles = [...keptTiles, spawned];
      rngSeed = spawnResult.rngSeed;
      nextId = spawnResult.nextId;
    }

    if (!canMove({ tiles: finalTiles, gamesPlayer, gamesOpponent, status, rngSeed })) {
      deadlock = true;
      gamesOpponent = Math.min(7, gamesOpponent + 1);
      if (setOver(gamesOpponent, gamesPlayer)) status = 'lost';
      const resetResult = spawnMany(2, rngSeed, nextId);
      finalTiles = resetResult.tiles;
      rngSeed = resetResult.rngSeed;
    }
  }

  const newState: GameState = { tiles: finalTiles, gamesPlayer, gamesOpponent, status, rngSeed };

  return { moved: true, slides, removed, created, spawned, pointsTo, pointsCount, deadlock, state: newState };
}
