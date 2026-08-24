// Bot per "The Battle": gioca sempre come Giocatore B contro un umano (Giocatore A).
// Puro e sincrono, usa lo stesso EngineApi condiviso (variant.ts) quindi funziona
// con qualunque variante, anche se per ora è collegato in UI solo per la compatta.

import type { AnyGameState, AnyMoveLength, AnyPosition, EngineApi } from './variant';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Facile',
  medium: 'Medio',
  hard: 'Difficile',
};

export type BotAction =
  | { kind: 'place'; row: number; col: number }
  | { kind: 'move'; length: AnyMoveLength; row: number; col: number };

/** Il bot gioca sempre come B: semplifica valutazione e ricerca (niente bisogno di parametrizzare "per chi"). */
const BOT_PLAYER = 'B';
const HUMAN_PLAYER = 'A';

/** Profondità di ricerca (in mosse, non "ply" del bot soltanto) dopo la mossa candidata in esame. */
const SEARCH_DEPTH: Record<BotDifficulty, number> = { easy: 0, medium: 2, hard: 4 };
/** Tolleranza di punteggio entro cui una mossa "quasi ottima" può comunque essere scelta a caso, per non essere troppo prevedibile. */
const SCORE_TOLERANCE: Record<BotDifficulty, number> = { easy: 0, medium: 1.5, hard: 0 };

function legalPlacements(engine: EngineApi, state: AnyGameState, cols: number): AnyPosition[] {
  const [lo, hi] = engine.ownHalfRows(state.currentPlayer);
  const cells: AnyPosition[] = [];
  for (let row = lo; row <= hi; row++) {
    for (let col = 0; col < cols; col++) cells.push({ row, col });
  }
  return cells;
}

function legalMoves(engine: EngineApi, state: AnyGameState): { length: AnyMoveLength; row: number; col: number }[] {
  const moves: { length: AnyMoveLength; row: number; col: number }[] = [];
  for (const length of engine.MOVE_LENGTHS) {
    if (state.moveCounts[state.currentPlayer][length] <= 0) continue;
    for (const pos of engine.getReachableDestinations(state, length)) {
      moves.push({ length, row: pos.row, col: pos.col });
    }
  }
  return moves;
}

/** Quante destinazioni avrebbe `player` se toccasse a lui muovere ora, dalla posizione attuale del gettone. */
function mobility(engine: EngineApi, state: AnyGameState, player: 'A' | 'B'): number {
  if (state.status !== 'active') return 0;
  const asPlayer = { ...state, currentPlayer: player };
  let total = 0;
  for (const length of engine.MOVE_LENGTHS) {
    if (state.moveCounts[player][length] <= 0) continue;
    total += engine.getReachableDestinations(asPlayer, length).length;
  }
  return total;
}

/** Punteggio dal punto di vista del bot: alto = buono per B, basso = buono per A. */
function evaluate(engine: EngineApi, state: AnyGameState): number {
  if (state.status === 'finished') {
    if (state.winner === BOT_PLAYER) return 1000;
    if (state.winner === HUMAN_PLAYER) return -1000;
    return 0;
  }
  return mobility(engine, state, BOT_PLAYER) - mobility(engine, state, HUMAN_PLAYER);
}

function childStates(engine: EngineApi, state: AnyGameState, cols: number): AnyGameState[] {
  const children: AnyGameState[] = [];
  if (state.status === 'placement') {
    for (const pos of legalPlacements(engine, state, cols)) {
      const res = engine.placeStart(state, pos.row, pos.col);
      if (res.ok) children.push(res.state);
    }
  } else if (state.status === 'active') {
    for (const move of legalMoves(engine, state)) {
      const res = engine.applyMove(state, move.length, move.row, move.col);
      if (res.ok) children.push(res.state);
    }
  }
  return children;
}

function minimax(
  engine: EngineApi,
  state: AnyGameState,
  depth: number,
  cols: number,
  alpha: number,
  beta: number,
): number {
  if (state.status === 'finished' || depth <= 0) {
    return evaluate(engine, state);
  }
  const children = childStates(engine, state, cols);
  if (children.length === 0) return evaluate(engine, state);

  const maximizing = state.currentPlayer === BOT_PLAYER;
  let best = maximizing ? -Infinity : Infinity;
  for (const child of children) {
    const score = minimax(engine, child, depth - 1, cols, alpha, beta);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function pickAction<T>(candidates: T[], scoreOf: (c: T) => number, difficulty: BotDifficulty): T {
  if (difficulty === 'easy' || candidates.length === 1) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  const scored = candidates.map((c) => ({ c, score: scoreOf(c) }));
  const maxScore = Math.max(...scored.map((s) => s.score));
  const tolerance = SCORE_TOLERANCE[difficulty];
  const best = scored.filter((s) => s.score >= maxScore - tolerance);
  return best[Math.floor(Math.random() * best.length)].c;
}

/** Sceglie l'azione del bot (piazzamento o mossa) per lo stato corrente, dato che tocca a B. */
export function chooseBotAction(
  engine: EngineApi,
  state: AnyGameState,
  difficulty: BotDifficulty,
  cols: number,
): BotAction | null {
  const depth = SEARCH_DEPTH[difficulty];

  if (state.status === 'placement') {
    const candidates = legalPlacements(engine, state, cols);
    if (candidates.length === 0) return null;
    const choice = pickAction(
      candidates,
      (pos) => {
        const res = engine.placeStart(state, pos.row, pos.col);
        return res.ok ? minimax(engine, res.state, depth, cols, -Infinity, Infinity) : -Infinity;
      },
      difficulty,
    );
    return { kind: 'place', row: choice.row, col: choice.col };
  }

  const candidates = legalMoves(engine, state);
  if (candidates.length === 0) return null;
  const choice = pickAction(
    candidates,
    (move) => {
      const res = engine.applyMove(state, move.length, move.row, move.col);
      return res.ok ? minimax(engine, res.state, depth, cols, -Infinity, Infinity) : -Infinity;
    },
    difficulty,
  );
  return { kind: 'move', length: choice.length, row: choice.row, col: choice.col };
}
