// Logica pura del gioco "Quindici" — nessuna dipendenza dal DOM o da Svelte.
// Vedi docs/quindici/quindici-spec.md per le regole complete.

export type Value = 15 | 30 | 40 | 'AD';
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

const SIZE = 4;

/**
 * Punto aperto §5 della spec: se il 15 jolly rende troppo facile regalare
 * games all'avversario, si può provare a rendere neutre le chiusure a
 * sinistra/destra (solo il basso punisce). Spenta di default.
 */
export const NEUTRAL_LEFT_RIGHT_CLOSE = false;

export function mergeRule(a: Value, b: Value): Value | 'POINT' | null {
  const key = [String(a), String(b)].sort().join('|');
  switch (key) {
    case '15|15': return 30;
    case '15|30': return 40;
    case '30|30': return 40;
    case '40|40': return 'AD';
    case '15|40': return 'POINT';
    case '15|AD': return 'POINT';
    case 'AD|AD': return 'POINT';
    default: return null;
  }
}

function recipientFor(dir: Dir): 'player' | 'opponent' | null {
  if (dir === 'up') return 'player';
  if (dir === 'down') return 'opponent';
  return NEUTRAL_LEFT_RIGHT_CLOSE ? null : 'opponent';
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
  | { type: 'point'; a: Tile; b: Tile; at: [number, number] };

interface Plan {
  slots: PlanSlot[];
  changed: boolean;
  pointCount: number;
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
  let pointCount = 0;

  for (let i = 0; i < SIZE; i++) {
    const slotCoords: [number, number][] = [];
    const line: Tile[] = [];
    for (let j = 0; j < SIZE; j++) {
      const [r, c] = slotFor(dir, i, j);
      slotCoords.push([r, c]);
      const t = occ.get(`${r},${c}`);
      if (t) line.push(t);
    }

    let idx = 0;
    let p = 0;
    while (idx < line.length) {
      const a = line[idx];
      const b = line[idx + 1];
      const res = b ? mergeRule(a.value, b.value) : null;
      const at = slotCoords[p];

      if (res === 'POINT') {
        slots.push({ type: 'point', a, b: b!, at });
        pointCount++;
        changed = true;
        idx += 2;
        continue;
      }
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

  return { slots, changed, pointCount };
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

function spawnTile(
  tiles: Tile[],
  nextId: number,
  rngSeed: number,
): { tile: Tile; rngSeed: number; nextId: number } | null {
  const free = freeCells(tiles);
  if (free.length === 0) return null;

  const pickRoll = mulberry32Step(rngSeed);
  const idx = Math.min(free.length - 1, Math.floor(pickRoll.value * free.length));
  const valueRoll = mulberry32Step(pickRoll.nextState);
  const value: Value = valueRoll.value < 0.8 ? 15 : 30;
  const [row, col] = free[idx];

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
  const removed: { id: number; reason: 'merged' | 'point' }[] = [];
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
      slides.push({ id: slot.a.id, row: slot.at[0], col: slot.at[1] });
      slides.push({ id: slot.b.id, row: slot.at[0], col: slot.at[1] });
      removed.push({ id: slot.a.id, reason: 'point' });
      removed.push({ id: slot.b.id, reason: 'point' });
      // casella resta libera: nessuna tessera creata
    }
  }

  let gamesPlayer = state.gamesPlayer;
  let gamesOpponent = state.gamesOpponent;
  let pointsTo: 'player' | 'opponent' | null = null;
  let pointsCount = 0;

  if (plan.pointCount > 0) {
    const recipient = recipientFor(dir);
    if (recipient) {
      pointsTo = recipient;
      pointsCount = plan.pointCount;
      if (recipient === 'player') gamesPlayer = Math.min(7, gamesPlayer + pointsCount);
      else gamesOpponent = Math.min(7, gamesOpponent + pointsCount);
    }
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
