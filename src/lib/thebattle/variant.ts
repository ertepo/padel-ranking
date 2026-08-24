// Elenco delle varianti di "The Battle" e le dimensioni della loro scacchiera.
// Le regole di gioco vere e proprie (lunghezze mosse, conteggi, metà campo)
// restano nei rispettivi moduli engine (engine.ts / engine3x8.ts): qui c'è
// solo ciò che serve a UI e API per scegliere quale motore usare, dimensionare
// la board, e un tipo condiviso (AnyGameState) per maneggiare lo stato senza
// doversi legare all'union esatta di MoveLength della variante classica.

import * as engineClassic from './engine';
import * as engineCompact from './engine3x8';

export type Variant = 'classic' | 'compact';

export const VARIANT_BOARD: Record<Variant, { rows: number; cols: number }> = {
  classic: { rows: 10, cols: 4 },
  compact: { rows: 8, cols: 3 },
};

export const VARIANT_LABEL: Record<Variant, string> = {
  classic: 'Estesa',
  compact: 'Compatta',
};

export type AnyMoveLength = 10 | 8 | 5 | 3 | 2;
export type AnyPosition = { row: number; col: number };

export type AnyGameState = {
  occupied: string[];
  position: AnyPosition | null;
  currentPlayer: 'A' | 'B';
  moveCounts: Record<'A' | 'B', Record<AnyMoveLength, number>>;
  status: 'placement' | 'active' | 'finished';
  winner: 'A' | 'B' | null;
};

export type AnyActionResult = { ok: true; state: AnyGameState } | { ok: false; error: string };

export interface EngineApi {
  MOVE_LENGTHS: AnyMoveLength[];
  newGame: () => AnyGameState;
  ownHalfRows: (player: 'A' | 'B') => [number, number];
  getReachableDestinations: (state: AnyGameState, length: AnyMoveLength) => AnyPosition[];
  placeStart: (state: AnyGameState, row: number, col: number) => AnyActionResult;
  applyMove: (state: AnyGameState, length: AnyMoveLength, row: number, col: number) => AnyActionResult;
}

/** Ricava il motore delle regole giuste (stessa forma per entrambe le varianti, cambiano solo dimensioni/numeri). */
export function engineFor(variant: Variant): EngineApi {
  return (variant === 'compact' ? engineCompact : engineClassic) as unknown as EngineApi;
}

/** Legge la variante da uno stato salvato, con fallback su "classic" per le partite create prima di questa modalità. */
export function variantOf(state: { variant?: unknown } | null | undefined): Variant {
  return state?.variant === 'compact' ? 'compact' : 'classic';
}
