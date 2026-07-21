// Logica pura del "gioco dello scambio" — nessuna dipendenza dal DOM.
// Da usare sia nel componente Svelte sia, in futuro, lato server.

export type Style = 'att' | 'sv' | 'reg';
export type Surface = 'terra' | 'erba' | 'cemento';

export interface Player {
  name: string;
  style: Style;
  strength: number; // 1-5
  surface: Surface; // superficie preferita
}

// sv batte reg, reg batte att, att batte sv
const BEATS: Record<Style, Style> = { sv: 'reg', reg: 'att', att: 'sv' };

export const STYLE_LABELS: Record<Style, string> = {
  att: 'Attaccante',
  sv: 'Serve&volley',
  reg: 'Regolarista',
};

/**
 * Difficoltà del game dal punto di vista di `me`.
 * Negativo = favorevole, positivo = sfavorevole. Non limitato: rispecchia
 * per intero la differenza di forza tra i due tennisti.
 */
export function diffScore(me: Player, opp: Player, surface: Surface): number {
  let d = opp.strength - me.strength;
  if (BEATS[me.style] === opp.style) d -= 1;
  if (BEATS[opp.style] === me.style) d += 1;
  if (surface === me.surface) d -= 1;
  if (surface === opp.surface) d += 1;
  return d;
}

export function diffLabel(d: number): string {
  if (d <= -2) return 'Molto favorevole';
  if (d === -1) return 'Favorevole';
  if (d === 0) return 'Equilibrato';
  if (d === 1) return 'Difficile';
  return 'Durissimo';
}

export interface GameParams {
  seqLength: number; // numero di colpi
  showMs: number; // durata accensione di ogni riquadro
  gapMs: number; // pausa tra un colpo e il successivo
  inputMsPerStep: number; // tempo concesso per colpo in fase di risposta
}

/**
 * Formula originale, non più usata dai 3 livelli standard (cresceva senza
 * limite col numero di game). Conservata per una futura "modalità
 * impossibile" (Sinner): la difficoltà del match-up incide sia sulla
 * lunghezza sequenza sia sulla velocità, e la sequenza si allunga game dopo
 * game.
 */
export function gameParams(gameNumber: number, d: number): GameParams {
  return {
    seqLength: Math.max(5, 4 + gameNumber + d),
    showMs: d > 0 ? 360 : d < 0 ? 480 : 420,
    gapMs: 130,
    inputMsPerStep: d > 0 ? 950 : d < 0 ? 1300 : 1100,
  };
}

export type Difficulty = '1' | '2' | '3' | '4' | '5' | 'ultra';

type FixedTier = '1' | '2' | '3' | '4' | '5';

// range di colpi raggiungibile ad ogni livello: si parte dal minimo e il
// match-up (superficie + stile + forza, vedi diffScore) sposta verso il massimo
const SEQ_RANGE: Record<FixedTier, { min: number; max: number }> = {
  '1': { min: 3, max: 6 },
  '2': { min: 4, max: 8 },
  '3': { min: 5, max: 10 },
  '4': { min: 6, max: 12 },
  '5': { min: 8, max: 16 },
};

// velocità fissa per livello, indipendente dal match-up (dal 3 in su resta
// quella di "difficile": a salire cambia solo la lunghezza sequenza)
const SPEED_BY_TIER: Record<Difficulty, { showMs: number; inputMsPerStep: number }> = {
  '1': { showMs: 480, inputMsPerStep: 1300 },
  '2': { showMs: 420, inputMsPerStep: 1100 },
  '3': { showMs: 360, inputMsPerStep: 950 },
  '4': { showMs: 360, inputMsPerStep: 950 },
  '5': { showMs: 360, inputMsPerStep: 950 },
  ultra: { showMs: 360, inputMsPerStep: 950 },
};

/**
 * Parametri del game per i livelli standard (1-5): sequenza modulata dal
 * match-up entro il range del livello, velocità fissa. Il livello "ultra" è
 * come il 5 ma la sequenza si allunga di un colpo ad ogni game (come la
 * formula originale in `gameParams`), senza un massimo.
 */
export function matchParams(
  tier: Difficulty,
  me: Player,
  opp: Player,
  surface: Surface,
  gameNumber: number,
): GameParams {
  const modifier = diffScore(me, opp, surface);
  const speed = SPEED_BY_TIER[tier];

  const seqLength =
    tier === 'ultra'
      ? Math.max(8, 7 + gameNumber + modifier)
      : Math.max(SEQ_RANGE[tier].min, Math.min(SEQ_RANGE[tier].max, SEQ_RANGE[tier].min + modifier));

  return { seqLength, showMs: speed.showMs, gapMs: 130, inputMsPerStep: speed.inputMsPerStep };
}

/**
 * Genera la sequenza dello scambio su una griglia con 5 riquadri per metà campo (indici 0-9).
 * Riquadri 0-4: metà campo sopra la rete; 5-9: metà campo sotto.
 * I colpi si alternano sempre tra i due lati; il lato iniziale è casuale.
 * Due colpi consecutivi non cadono mai sullo stesso riquadro.
 */
export function generateRally(
  length: number,
  rng: () => number = Math.random,
): number[] {
  const seq: number[] = [];
  let side = rng() < 0.5 ? 0 : 1;
  let prev = -1;
  for (let k = 0; k < length; k++) {
    let cell: number;
    do {
      cell = side * 5 + Math.floor(rng() * 5);
    } while (cell === prev);
    seq.push(cell);
    prev = cell;
    side = 1 - side;
  }
  return seq;
}
