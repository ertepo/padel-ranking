// Bot per "Super Tris" (Ultimate Tic-Tac-Toe): gioca sempre come O contro un
// umano che gioca X e muove per primo. Puro e sincrono, usa lo stesso motore
// condiviso (engine.ts) usato per la modalità locale e online.

import { tryMove, getActiveBoards, type GameState, type Player, type Cell } from './engine';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: 'Facile',
  medium: 'Medio',
  hard: 'Difficile',
};

export type BotMove = { boardIndex: number; cellIndex: number };

/** Profondità di ricerca (in ply, alternando bot/umano) usata dal minimax. */
const SEARCH_DEPTH: Record<BotDifficulty, number> = { easy: 0, medium: 2, hard: 3 };
/** Tolleranza di punteggio entro cui una mossa "quasi ottima" può comunque essere scelta a caso. */
const SCORE_TOLERANCE: Record<BotDifficulty, number> = { easy: 0, medium: 15, hard: 0 };

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function legalMoves(state: GameState): BotMove[] {
  const moves: BotMove[] = [];
  for (const boardIndex of getActiveBoards(state)) {
    state.boards[boardIndex].forEach((cell, cellIndex) => {
      if (cell === null) moves.push({ boardIndex, cellIndex });
    });
  }
  return moves;
}

function scoreLine(cells: Cell[], player: Player, opponent: Player): number {
  const mine = cells.filter((c) => c === player).length;
  const theirs = cells.filter((c) => c === opponent).length;
  if (mine > 0 && theirs > 0) return 0;
  if (mine === 3) return 100;
  if (mine === 2) return 10;
  if (mine === 1) return 1;
  if (theirs === 3) return -100;
  if (theirs === 2) return -10;
  if (theirs === 1) return -1;
  return 0;
}

function scoreBoard(cells: Cell[], player: Player, opponent: Player): number {
  let total = 0;
  for (const line of LINES) total += scoreLine(line.map((i) => cells[i]), player, opponent);
  return total;
}

/** Punteggio dal punto di vista di `botPlayer`: alto = buono per il bot, basso = buono per l'umano. */
function evaluate(state: GameState, botPlayer: Player, humanPlayer: Player): number {
  if (state.winner === botPlayer) return 100000;
  if (state.winner === humanPlayer) return -100000;
  if (state.winner === 'draw') return 0;

  const metaCells: Cell[] = state.subResults.map((result) => (result === 'draw' ? null : result));
  let score = scoreBoard(metaCells, botPlayer, humanPlayer) * 15;

  state.boards.forEach((board, index) => {
    if (state.subResults[index] !== null) return;
    score += scoreBoard(board, botPlayer, humanPlayer) * (index === 4 ? 2 : 1);
  });

  if (metaCells[4] === botPlayer) score += 20;
  else if (metaCells[4] === humanPlayer) score -= 20;

  return score;
}

function minimax(
  state: GameState,
  depth: number,
  botPlayer: Player,
  humanPlayer: Player,
  alpha: number,
  beta: number,
): number {
  if (state.winner || depth <= 0) return evaluate(state, botPlayer, humanPlayer);
  const moves = legalMoves(state);
  if (moves.length === 0) return evaluate(state, botPlayer, humanPlayer);

  const maximizing = state.currentPlayer === botPlayer;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const res = tryMove(state, move.boardIndex, move.cellIndex, state.currentPlayer);
    if (!res.ok) continue;
    const score = minimax(res.state, depth - 1, botPlayer, humanPlayer, alpha, beta);
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

function pickMove(candidates: BotMove[], scoreOf: (move: BotMove) => number, difficulty: BotDifficulty): BotMove {
  if (difficulty === 'easy' || candidates.length === 1) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  const scored = candidates.map((move) => ({ move, score: scoreOf(move) }));
  const maxScore = Math.max(...scored.map((s) => s.score));
  const tolerance = SCORE_TOLERANCE[difficulty];
  const best = scored.filter((s) => s.score >= maxScore - tolerance);
  return best[Math.floor(Math.random() * best.length)].move;
}

/** Sceglie la mossa del bot per lo stato corrente, dato che tocca a `botPlayer`. */
export function chooseBotMove(state: GameState, difficulty: BotDifficulty, botPlayer: Player): BotMove | null {
  const humanPlayer: Player = botPlayer === 'X' ? 'O' : 'X';
  const candidates = legalMoves(state);
  if (candidates.length === 0) return null;
  const depth = SEARCH_DEPTH[difficulty];
  return pickMove(
    candidates,
    (move) => {
      const res = tryMove(state, move.boardIndex, move.cellIndex, state.currentPlayer);
      return res.ok ? minimax(res.state, depth, botPlayer, humanPlayer, -Infinity, Infinity) : -Infinity;
    },
    difficulty,
  );
}
