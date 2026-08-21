// Motore puro dell'Ultimate Tic-Tac-Toe ("Super Tris"): nessun I/O, così può
// essere importato sia lato client (modalità locale e client online, per
// highlight ottimistici) sia lato server (unica autorità che convalida le
// mosse della modalità online).

export type Player = 'X' | 'O';
export type Cell = Player | null;
export type SubResult = Player | 'draw' | null;

export interface GameState {
  boards: Cell[][];
  subResults: SubResult[];
  activeBoard: number | null;
  currentPlayer: Player;
  winner: Player | 'draw' | null;
}

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

export function createInitialState(): GameState {
  return {
    boards: Array.from({ length: 9 }, () => Array<Cell>(9).fill(null)),
    subResults: Array(9).fill(null),
    activeBoard: null,
    currentPlayer: 'X',
    winner: null,
  };
}

export function checkWinner(cells: (Player | null)[]): Player | null {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a];
    }
  }
  return null;
}

export function getActiveBoards(state: GameState): number[] {
  if (state.winner) return [];
  if (state.activeBoard !== null) {
    return state.subResults[state.activeBoard] === null ? [state.activeBoard] : [];
  }
  return state.subResults
    .map((result, index) => (result === null ? index : -1))
    .filter((index) => index !== -1);
}

export type MoveResult = { ok: true; state: GameState } | { ok: false; error: string };

export function tryMove(
  state: GameState,
  boardIndex: number,
  cellIndex: number,
  player: Player,
): MoveResult {
  if (state.winner) {
    return { ok: false, error: 'La partita è già terminata.' };
  }
  if (player !== state.currentPlayer) {
    return { ok: false, error: 'Non è il tuo turno.' };
  }
  if (!Number.isInteger(boardIndex) || boardIndex < 0 || boardIndex > 8) {
    return { ok: false, error: 'Riquadro non valido.' };
  }
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) {
    return { ok: false, error: 'Cella non valida.' };
  }
  if (state.activeBoard !== null && state.activeBoard !== boardIndex) {
    return { ok: false, error: 'Devi giocare nel riquadro evidenziato.' };
  }
  if (state.subResults[boardIndex] !== null) {
    return { ok: false, error: 'Questo riquadro è già stato deciso.' };
  }
  if (state.boards[boardIndex][cellIndex] !== null) {
    return { ok: false, error: 'Questa cella è già occupata.' };
  }

  const boards = state.boards.map((board, index) =>
    index === boardIndex ? board.map((cell, i) => (i === cellIndex ? player : cell)) : board,
  );

  const subResults = [...state.subResults];
  const subWinner = checkWinner(boards[boardIndex]);
  if (subWinner) {
    subResults[boardIndex] = subWinner;
  } else if (boards[boardIndex].every((cell) => cell !== null)) {
    subResults[boardIndex] = 'draw';
  }

  const metaCells = subResults.map((result) => (result === 'draw' ? null : result));
  const metaWinner = checkWinner(metaCells);
  let winner: Player | 'draw' | null = metaWinner;
  if (!winner && subResults.every((result) => result !== null)) {
    winner = 'draw';
  }

  const nextActiveBoard = subResults[cellIndex] === null ? cellIndex : null;

  return {
    ok: true,
    state: {
      boards,
      subResults,
      activeBoard: winner ? state.activeBoard : nextActiveBoard,
      currentPlayer: player === 'X' ? 'O' : 'X',
      winner,
    },
  };
}
