// Motore puro di "The Battle" (Tie-Break Chase) — variante compatta: nessun
// I/O, così può essere importato sia lato client (modalità locale e client
// online, per validazioni ottimistiche) sia lato server (unica autorità che
// convalida mosse online).
// Regolamento: scacchiera 3x8 (colonne a-c, righe 0-7), un solo gettone
// condiviso, ogni mossa percorre N caselle con al massimo un cambio di
// direzione a 90°, deve atterrare nella metà avversaria rispetto a chi si
// muove, su una casella libera. Perde chi resta senza mosse valide.

export type PlayerId = 'A' | 'B';
export type MoveLength = 8 | 5 | 3 | 2;

export const MOVE_LENGTHS: MoveLength[] = [8, 5, 3, 2];
export const INITIAL_MOVE_COUNT = 3;
export const ROWS = 8;
export const COLS = 3;

export interface Position {
  row: number;
  col: number;
}

export type MoveCounts = Record<MoveLength, number>;

export interface GameState {
  /** id delle celle occupate (casella di partenza + ogni casella di arrivo). */
  occupied: string[];
  position: Position | null;
  currentPlayer: PlayerId;
  moveCounts: Record<PlayerId, MoveCounts>;
  status: 'placement' | 'active' | 'finished';
  winner: PlayerId | null;
}

const COLUMN_LETTERS = 'abc';

export function cellId(row: number, col: number): string {
  return `${COLUMN_LETTERS[col]}${row}`;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/** Righe della metà "di casa" del giocatore. */
export function ownHalfRows(player: PlayerId): [number, number] {
  return player === 'A' ? [0, 3] : [4, 7];
}

/** Righe della metà avversaria rispetto al giocatore (dove deve atterrare una sua mossa). */
export function opponentHalfRows(player: PlayerId): [number, number] {
  return player === 'A' ? [4, 7] : [0, 3];
}

export function isInHalf(row: number, [lo, hi]: [number, number]): boolean {
  return row >= lo && row <= hi;
}

function freshMoveCounts(): MoveCounts {
  return { 8: INITIAL_MOVE_COUNT, 5: INITIAL_MOVE_COUNT, 3: INITIAL_MOVE_COUNT, 2: INITIAL_MOVE_COUNT };
}

export function newGame(): GameState {
  return {
    occupied: [],
    position: null,
    currentPlayer: Math.random() < 0.5 ? 'A' : 'B',
    moveCounts: { A: freshMoveCounts(), B: freshMoveCounts() },
    status: 'placement',
    winner: null,
  };
}

type Dir = 'up' | 'down' | 'left' | 'right';

const DIRS: Record<Dir, [number, number]> = {
  up: [1, 0],
  down: [-1, 0],
  left: [0, -1],
  right: [0, 1],
};

const PERPENDICULARS: Record<Dir, Dir[]> = {
  up: ['left', 'right'],
  down: ['left', 'right'],
  left: ['up', 'down'],
  right: ['up', 'down'],
};

/**
 * Tutte le destinazioni geometricamente raggiungibili da `pos` con una mossa
 * da `length` caselle e al massimo un cambio di direzione (a 90°), scartando
 * quelle fuori dai bordi della scacchiera. Non applica ancora i vincoli di
 * metà/casella libera: quelli dipendono dallo stato di gioco.
 */
export function destinationsForLength(pos: Position, length: MoveLength): Position[] {
  const seen = new Set<string>();
  const results: Position[] = [];

  const add = (row: number, col: number) => {
    if (!inBounds(row, col)) return;
    const key = `${row},${col}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ row, col });
  };

  (['up', 'down', 'left', 'right'] as Dir[]).forEach((d1) => {
    const [dr1, dc1] = DIRS[d1];

    // Tutto dritto: nessun cambio di direzione.
    add(pos.row + dr1 * length, pos.col + dc1 * length);

    // Dritto per x caselle, poi svolta di 90° per le restanti (length - x).
    for (const d2 of PERPENDICULARS[d1]) {
      const [dr2, dc2] = DIRS[d2];
      for (let x = 1; x < length; x++) {
        const rest = length - x;
        add(pos.row + dr1 * x + dr2 * rest, pos.col + dc1 * x + dc2 * rest);
      }
    }
  });

  return results;
}

/** Destinazioni valide per il giocatore di turno con una mossa da `length`, dato lo stato attuale. */
export function getReachableDestinations(state: GameState, length: MoveLength): Position[] {
  if (state.status !== 'active' || !state.position) return [];
  const half = opponentHalfRows(state.currentPlayer);
  const occupiedSet = new Set(state.occupied);
  return destinationsForLength(state.position, length).filter(
    ({ row, col }) => isInHalf(row, half) && !occupiedSet.has(cellId(row, col)),
  );
}

/** Il giocatore di turno ha almeno una mossa (di una lunghezza ancora disponibile) giocabile? */
export function hasAnyValidMove(state: GameState): boolean {
  if (state.status !== 'active') return false;
  return MOVE_LENGTHS.some(
    (length) =>
      state.moveCounts[state.currentPlayer][length] > 0 &&
      getReachableDestinations(state, length).length > 0,
  );
}

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };

/** Il giocatore sorteggiato per iniziare sceglie la casella di partenza nella propria metà; poi tocca sempre a lui muovere per primo. */
export function placeStart(state: GameState, row: number, col: number): ActionResult {
  if (state.status !== 'placement') {
    return { ok: false, error: 'La partita è già iniziata.' };
  }
  if (!inBounds(row, col)) {
    return { ok: false, error: 'Casella non valida.' };
  }
  if (!isInHalf(row, ownHalfRows(state.currentPlayer))) {
    return { ok: false, error: 'La casella di partenza deve stare nella tua metà.' };
  }

  return {
    ok: true,
    state: {
      ...state,
      position: { row, col },
      occupied: [cellId(row, col)],
      status: 'active',
    },
  };
}

export function applyMove(state: GameState, length: MoveLength, row: number, col: number): ActionResult {
  if (state.status !== 'active' || !state.position) {
    return { ok: false, error: 'La partita non è attiva.' };
  }
  if (state.moveCounts[state.currentPlayer][length] <= 0) {
    return { ok: false, error: 'Non hai più mosse di questa lunghezza.' };
  }

  const valid = getReachableDestinations(state, length).some((d) => d.row === row && d.col === col);
  if (!valid) {
    return { ok: false, error: 'Mossa non valida.' };
  }

  const mover = state.currentPlayer;
  const nextPlayer: PlayerId = mover === 'A' ? 'B' : 'A';

  let nextState: GameState = {
    occupied: [...state.occupied, cellId(row, col)],
    position: { row, col },
    currentPlayer: nextPlayer,
    moveCounts: {
      ...state.moveCounts,
      [mover]: { ...state.moveCounts[mover], [length]: state.moveCounts[mover][length] - 1 },
    },
    status: 'active',
    winner: null,
  };

  if (!hasAnyValidMove(nextState)) {
    nextState = { ...nextState, status: 'finished', winner: mover };
  }

  return { ok: true, state: nextState };
}
