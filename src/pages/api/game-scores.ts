import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { verifyOrClaimNickname } from '../../lib/gameNickname';

export const prerender = false;

const NICKNAME_MAX_LENGTH = 20;
const MATCH_SCORE_PATTERN = /^\d{1,2}-\d{1,2}$/;
const VALID_DIFFICULTIES = new Set(['1', '2', '3', '4', '5', 'ultra']);
const VALID_SURFACES = new Set(['terra', 'erba', 'cemento']);
const ROSTER_SIZE = 6;

function parseRoster(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length !== ROSTER_SIZE) return null;
  const names = value.map((v) => (typeof v === 'string' ? v.trim() : ''));
  if (names.some((n) => !n)) return null;
  return names;
}

export const POST: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let body: {
    nickname?: unknown;
    nomecognome?: unknown;
    match_score?: unknown;
    points?: unknown;
    difficulty?: unknown;
    surface?: unknown;
    player_roster?: unknown;
    cpu_roster?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, NICKNAME_MAX_LENGTH) : '';
  const nomecognome = typeof body.nomecognome === 'string' ? body.nomecognome.trim() : '';
  const matchScore = typeof body.match_score === 'string' ? body.match_score.trim() : '';
  const points = typeof body.points === 'number' && Number.isFinite(body.points) ? Math.round(body.points) : NaN;
  const difficulty = typeof body.difficulty === 'string' ? body.difficulty.trim() : '';
  const surface = typeof body.surface === 'string' ? body.surface.trim() : '';
  const playerRoster = parseRoster(body.player_roster);
  const cpuRoster = parseRoster(body.cpu_roster);

  if (!nickname) {
    return Response.json({ error: 'Nickname mancante.' }, { status: 400 });
  }
  if (!MATCH_SCORE_PATTERN.test(matchScore)) {
    return Response.json({ error: 'Punteggio partita non valido.' }, { status: 400 });
  }
  if (!Number.isFinite(points)) {
    return Response.json({ error: 'Punteggio non valido.' }, { status: 400 });
  }
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return Response.json({ error: 'Difficoltà non valida.' }, { status: 400 });
  }
  if (!VALID_SURFACES.has(surface)) {
    return Response.json({ error: 'Superficie non valida.' }, { status: 400 });
  }
  if (!playerRoster || !cpuRoster) {
    return Response.json({ error: 'Roster non valido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // ricontrollo lato server (oltre a /api/game-nickname già passato prima
  // di scendere in campo): evita che un nickname diverso da quello
  // reclamato finisca comunque in classifica
  const verification = await verifyOrClaimNickname(supabase, nickname, nomecognome);
  if (!verification.ok) {
    return Response.json({ error: verification.error }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('legends_game_score')
    .insert({
      nickname,
      match_score: matchScore,
      points,
      difficulty,
      surface,
      player_roster: playerRoster,
      cpu_roster: cpuRoster,
    })
    .select('id')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, id: data.id });
};
