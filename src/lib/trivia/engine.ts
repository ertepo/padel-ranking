// Logica pura del gioco "Trivia" — nessuna dipendenza dal DOM o da Svelte.
// Quiz a tempo: 15 domande pescate a caso dal mazzo (mix di tutte le
// categorie), un timer per domanda, punteggio che premia velocità e streak.

export interface TriviaQuestion {
  category: string;
  domanda: string;
  opzioni: string[];
  corretta: number;
}

export interface RoundQuestion {
  question: TriviaQuestion;
  /** Indici di question.opzioni nell'ordine mostrato in campo (opzioni rimescolate ad ogni partita). */
  optionOrder: number[];
}

export interface AnsweredQuestion {
  question: TriviaQuestion;
  /** Indice (in question.opzioni) scelto dal giocatore, o null se il tempo è scaduto senza risposta. */
  chosen: number | null;
  correct: boolean;
  points: number;
}

export interface GameState {
  questions: RoundQuestion[];
  currentIndex: number;
  score: number;
  streak: number;
  answered: AnsweredQuestion[];
  status: 'playing' | 'finished';
}

export const QUESTIONS_PER_GAME = 15;
export const QUESTION_TIME_MS = 15000;

const BASE_POINTS = 100;
const SPEED_BONUS_MAX = 50;
// Dal 3° corretto consecutivo in poi il punteggio della domanda vale 1.5x:
// premia le serie senza far esplodere il punteggio massimo (resta nell'ordine
// di ~2000-2500 su un giro perfetto di 15 domande).
const STREAK_BONUS_FROM = 3;
const STREAK_MULTIPLIER = 1.5;

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickQuestions(pool: TriviaQuestion[], count: number): TriviaQuestion[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

export function newGame(pool: TriviaQuestion[], count: number = QUESTIONS_PER_GAME): GameState {
  const picked = pickQuestions(pool, count);
  const questions: RoundQuestion[] = picked.map((question) => ({
    question,
    optionOrder: shuffle(question.opzioni.map((_, i) => i)),
  }));

  return {
    questions,
    currentIndex: 0,
    score: 0,
    streak: 0,
    answered: [],
    status: questions.length > 0 ? 'playing' : 'finished',
  };
}

export function currentQuestion(state: GameState): RoundQuestion | null {
  return state.questions[state.currentIndex] ?? null;
}

/** Punti di una risposta corretta: base + bonus velocità (proporzionale al tempo rimasto) + moltiplicatore streak. */
function pointsFor(timeLeftMs: number, streakBeforeAnswer: number): number {
  const clampedTimeLeft = Math.max(0, Math.min(QUESTION_TIME_MS, timeLeftMs));
  const speedBonus = Math.round(SPEED_BONUS_MAX * (clampedTimeLeft / QUESTION_TIME_MS));
  const base = BASE_POINTS + speedBonus;
  const onStreak = streakBeforeAnswer + 1 >= STREAK_BONUS_FROM;
  return onStreak ? Math.round(base * STREAK_MULTIPLIER) : base;
}

/**
 * Registra la risposta alla domanda corrente (optionIndex nell'ordine
 * mostrato in campo, cioè un indice in optionOrder; null = tempo scaduto) e
 * avanza alla prossima domanda. Ritorna il nuovo stato più l'esito, per
 * pilotare l'animazione/feedback in UI senza dover ricalcolare nulla.
 */
export function submitAnswer(
  state: GameState,
  chosenOrderIndex: number | null,
  timeLeftMs: number,
): { state: GameState; correct: boolean; points: number } {
  const round = currentQuestion(state);
  if (!round || state.status !== 'playing') {
    return { state, correct: false, points: 0 };
  }

  const chosen = chosenOrderIndex === null ? null : round.optionOrder[chosenOrderIndex];
  const correct = chosen === round.question.corretta;
  const points = correct ? pointsFor(timeLeftMs, state.streak) : 0;

  const answered: AnsweredQuestion = { question: round.question, chosen, correct, points };
  const nextIndex = state.currentIndex + 1;

  const newState: GameState = {
    ...state,
    currentIndex: nextIndex,
    score: state.score + points,
    streak: correct ? state.streak + 1 : 0,
    answered: [...state.answered, answered],
    status: nextIndex >= state.questions.length ? 'finished' : 'playing',
  };

  return { state: newState, correct, points };
}

/** Riepilogo per categoria a fine partita: corrette/totale per ciascuna categoria incontrata. */
export function categoryBreakdown(state: GameState): { category: string; correct: number; total: number }[] {
  const byCategory = new Map<string, { correct: number; total: number }>();
  for (const a of state.answered) {
    const entry = byCategory.get(a.question.category) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (a.correct) entry.correct += 1;
    byCategory.set(a.question.category, entry);
  }
  return Array.from(byCategory.entries()).map(([category, v]) => ({ category, ...v }));
}
