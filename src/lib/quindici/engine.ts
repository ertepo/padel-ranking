// Logica pura del gioco "Quindici" — nessuna dipendenza dal DOM o da Svelte.
// Vedi docs/quindici/quindici-spec.md per le regole complete.

/**
 * Un "livello" è un ciclo completo di gioco: parte da un seme (`0`, tranne
 * per il livello base) e sale 15 -> 30 -> 40 -> AD. Completare AD (o farlo
 * completare al jolly 0) fa nascere il seme del livello successivo.
 */
export type Step = 0 | 15 | 30 | 40 | 'AD';

export interface Value {
  level: number; // 0..MAX_LEVEL
  step: Step;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  value: Value;
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
}

/** Esito di una mossa: descrive l'animazione, non solo il risultato. */
export interface MoveResult {
  moved: boolean;
  /** posizioni verso cui animare le tessere prima di risolvere le fusioni */
  slides: { id: number; row: number; col: number }[];
  /** tessere che spariscono (fuse in una nuova, o nella fusione finale di vittoria) */
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

const SIZE = 4;
export const MAX_LEVEL = 5;

/** Etichetta mostrata sulla tessera: "15" per il livello base, "2.40" dal livello 1 in su. */
export function valueLabel(v: Value): string {
  return v.level === 0 ? String(v.step) : `${v.level}.${v.step}`;
}

/**
 * Le tessere interagiscono solo con quelle dello stesso livello. Il jolly di
 * ogni livello è `0`: si somma con qualsiasi altra tessera dello stesso
 * livello e la fa avanzare (0+15->30, 0+30->40, 0+40 e 0+AD completano il
 * livello). `15/30/40/AD` si sommano invece solo se uguali fra loro, come
 * doppioni normali — 15 non è più jolly, si comporta come 30/40/AD.
 * Completare la scala (via jolly o via AD+AD) fa nascere il seme del livello
 * successivo, o vince la partita al livello massimo.
 */
export function mergeRule(a: Value, b: Value): Value | 'WIN' | null {
  if (a.level !== b.level) return null;
  const level = a.level;
  const nextLevel = (): Value | 'WIN' => (level >= MAX_LEVEL ? 'WIN' : { level: level + 1, step: 0 });

  if (a.step === 0 || b.step === 0) {
    if (a.step === 0 && b.step === 0) return { level, step: 15 };
    const other: Step = a.step === 0 ? b.step : a.step;
    switch (other) {
      case 15: return { level, step: 30 };
      case 30: return { level, step: 40 };
      case 40: return nextLevel();
      case 'AD': return nextLevel();
      default: return null;
    }
  }

  const key = [String(a.step), String(b.step)].sort().join('|');
  switch (key) {
    case '15|15': return { level, step: 30 };
    case '30|30': return { level, step: 40 };
    case '40|40': return { level, step: 'AD' };
    case 'AD|AD': return nextLevel();
    default: return null;
  }
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

function buildPlan(tiles: Tile[], dir: Dir): Plan {
  const occ = new Map<string, Tile>();
  for (const t of tiles) occ.set(`${t.row},${t.col}`, t);

  const slots: PlanSlot[] = [];
  let changed = false;

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

      if (res === 'WIN') {
        slots.push({ type: 'win', a, b: b!, at });
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
  const step: Step = valueRoll.value < 0.8 ? 0 : 15;
  const [row, col] = candidates[idx];

  return {
    tile: { id: nextId, value: { level: 0, step }, row, col },
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
    highestLevel: 0,
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
      const tile: Tile = { id: nextId++, value: slot.value, row: slot.at[0], col: slot.at[1] };
      created.push(tile);
      keptTiles.push(tile);
      if (slot.value.level > highestLevel) {
        highestLevel = slot.value.level;
        levelUp = slot.value.level;
      }
    } else {
      // win: le due tessere convergono e spariscono, non nasce nessuna tessera
      slides.push({ id: slot.a.id, row: slot.at[0], col: slot.at[1] });
      slides.push({ id: slot.b.id, row: slot.at[0], col: slot.at[1] });
      removed.push({ id: slot.a.id, reason: 'merged' });
      removed.push({ id: slot.b.id, reason: 'merged' });
      won = true;
    }
  }

  if (won) {
    const newState: GameState = { tiles: keptTiles, highestLevel, status: 'won', rngSeed: state.rngSeed };
    return { moved: true, slides, removed, created, spawned: null, levelUp, won: true, gameOver: false, state: newState };
  }

  let rngSeed = state.rngSeed;
  let spawned: Tile | null = null;
  let finalTiles = keptTiles;

  const spawnResult = spawnTile(keptTiles, nextId, rngSeed);
  if (spawnResult) {
    spawned = spawnResult.tile;
    finalTiles = [...keptTiles, spawned];
    rngSeed = spawnResult.rngSeed;
  }

  let status: GameState['status'] = 'playing';
  let gameOver = false;
  if (!canMove({ tiles: finalTiles, highestLevel, status, rngSeed })) {
    status = 'over';
    gameOver = true;
  }

  const newState: GameState = { tiles: finalTiles, highestLevel, status, rngSeed };

  return { moved: true, slides, removed, created, spawned, levelUp, won: false, gameOver, state: newState };
}
