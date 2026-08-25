// Logica pura del gioco "Chi l'ha vinto?" — nessuna dipendenza dal DOM o da Svelte.
// Modalità sopravvivenza: 100 finali Slam storiche in ordine curato, si va avanti
// finché si risponde giusto entro il tempo limite; il primo errore (o timeout) ferma
// la corsa. Il punteggio è il numero di livelli superati prima di fermarsi.

export interface SlamLevel {
  tournament: 'Australian Open' | 'Roland Garros' | 'Wimbledon' | 'US Open';
  year: number;
  gender: 'M' | 'F';
  winner: string;
  loser: string;
  score: string;
  note: string;
}

export interface RoundLevel {
  level: SlamLevel;
  /** I due nomi mostrati nelle tessere, in ordine casuale (rimescolato una volta a inizio partita). */
  options: [string, string];
}

export interface GameState {
  rounds: RoundLevel[];
  currentIndex: number;
  status: 'playing' | 'lost' | 'finished';
}

export const LEVEL_TIME_MS = 8000;

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function newGame(pool: SlamLevel[]): GameState {
  const rounds: RoundLevel[] = pool.map((level) => ({
    level,
    options: shuffle([level.winner, level.loser]) as [string, string],
  }));

  return {
    rounds,
    currentIndex: 0,
    status: rounds.length > 0 ? 'playing' : 'finished',
  };
}

export function currentRound(state: GameState): RoundLevel | null {
  return state.rounds[state.currentIndex] ?? null;
}

/**
 * Registra la risposta al livello corrente (il nome scelto, o null se il tempo
 * è scaduto senza risposta) e avanza al livello successivo solo se corretta.
 * Una risposta sbagliata o il timeout fermano subito la partita.
 */
export function submitAnswer(
  state: GameState,
  chosen: string | null,
): { state: GameState; correct: boolean } {
  const round = currentRound(state);
  if (!round || state.status !== 'playing') {
    return { state, correct: false };
  }

  const correct = chosen === round.level.winner;
  const nextIndex = correct ? state.currentIndex + 1 : state.currentIndex;
  const status: GameState['status'] = !correct ? 'lost' : nextIndex >= state.rounds.length ? 'finished' : 'playing';

  return { state: { ...state, currentIndex: nextIndex, status }, correct };
}
