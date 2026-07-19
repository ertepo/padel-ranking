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
 * Negativo = favorevole, positivo = sfavorevole. Intervallo [-3, +3].
 */
export function diffScore(me: Player, opp: Player, surface: Surface): number {
  let d = opp.strength - me.strength;
  if (BEATS[me.style] === opp.style) d -= 1;
  if (BEATS[opp.style] === me.style) d += 1;
  if (surface === me.surface) d -= 1;
  if (surface === opp.surface) d += 1;
  return Math.max(-3, Math.min(3, d));
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

/** Parametri del game dato il numero di game (1-based) e la difficoltà. */
export function gameParams(gameNumber: number, d: number): GameParams {
  return {
    seqLength: Math.max(6, 5 + gameNumber + d),
    showMs: d > 0 ? 360 : d < 0 ? 480 : 420,
    gapMs: 130,
    inputMsPerStep: d > 0 ? 950 : d < 0 ? 1300 : 1100,
  };
}

/**
 * Genera la sequenza dello scambio su una griglia 3x4 (indici 0-11).
 * Riquadri 0-5: metà campo sopra la rete; 6-11: metà campo sotto.
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
      cell = side * 6 + Math.floor(rng() * 6);
    } while (cell === prev);
    seq.push(cell);
    prev = cell;
    side = 1 - side;
  }
  return seq;
}
