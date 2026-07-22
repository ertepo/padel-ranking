// Ricostruisce la configurazione di una partita salvata (superficie,
// difficoltà, roster) a partire da una riga di legends_game_score, per
// poterla rigiocare o condividere come sfida. Nessun fallback silenzioso
// nascosto: se la riga è incompleta o pre-esistente alla migration che ha
// introdotto queste colonne, si ritorna null e chi chiama torna al flusso
// normale (draft casuale).

import type { Difficulty, Player, Surface } from './matchup';

export interface ReplayConfig {
  surface: Surface;
  difficulty: Difficulty;
  playerRoster: Player[];
  cpuRoster: Player[];
  challengerNickname: string;
  targetPoints: number;
}

export interface ReplaySourceRow {
  surface?: unknown;
  difficulty?: unknown;
  player_roster?: unknown;
  cpu_roster?: unknown;
  nickname?: unknown;
  points?: unknown;
}

const VALID_SURFACES = new Set<string>(['terra', 'erba', 'cemento']);
const VALID_DIFFICULTIES = new Set<string>(['1', '2', '3', '4', '5', 'ultra']);
const ROSTER_SIZE = 6;

function resolveRoster(names: unknown, allPlayers: Player[]): Player[] | null {
  if (!Array.isArray(names) || names.length !== ROSTER_SIZE) return null;
  const byName = new Map(allPlayers.map((p) => [p.name, p]));
  const resolved: Player[] = [];
  for (const n of names) {
    const player = typeof n === 'string' ? byName.get(n) : undefined;
    if (!player) return null;
    resolved.push(player);
  }
  return resolved;
}

export function buildReplayConfig(row: ReplaySourceRow | null | undefined, allPlayers: Player[]): ReplayConfig | null {
  if (!row) return null;

  const surface = typeof row.surface === 'string' && VALID_SURFACES.has(row.surface) ? (row.surface as Surface) : null;
  const difficulty =
    typeof row.difficulty === 'string' && VALID_DIFFICULTIES.has(row.difficulty) ? (row.difficulty as Difficulty) : null;
  const playerRoster = resolveRoster(row.player_roster, allPlayers);
  const cpuRoster = resolveRoster(row.cpu_roster, allPlayers);

  if (!surface || !difficulty || !playerRoster || !cpuRoster) return null;

  return {
    surface,
    difficulty,
    playerRoster,
    cpuRoster,
    challengerNickname: typeof row.nickname === 'string' ? row.nickname : '',
    targetPoints: typeof row.points === 'number' ? row.points : 0,
  };
}
