import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { verifyOrClaimNickname } from '../../lib/gameNickname';
import { QUESTIONS_PER_GAME } from '../../lib/trivia/engine';

export const prerender = false;

const NICKNAME_MAX_LENGTH = 20;

export const POST: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let body: {
    nickname?: unknown;
    nomecognome?: unknown;
    points?: unknown;
    correctCount?: unknown;
    totalQuestions?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, NICKNAME_MAX_LENGTH) : '';
  const nomecognome = typeof body.nomecognome === 'string' ? body.nomecognome.trim() : '';
  const points = typeof body.points === 'number' && Number.isFinite(body.points) ? Math.round(body.points) : NaN;
  const correctCount =
    typeof body.correctCount === 'number' && Number.isFinite(body.correctCount) ? Math.round(body.correctCount) : NaN;
  const totalQuestions =
    typeof body.totalQuestions === 'number' && Number.isFinite(body.totalQuestions)
      ? Math.round(body.totalQuestions)
      : NaN;

  if (!nickname) {
    return Response.json({ error: 'Nickname mancante.' }, { status: 400 });
  }
  if (!Number.isFinite(points) || points < 0) {
    return Response.json({ error: 'Punteggio non valido.' }, { status: 400 });
  }
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0 || totalQuestions > QUESTIONS_PER_GAME) {
    return Response.json({ error: 'Numero di domande non valido.' }, { status: 400 });
  }
  if (!Number.isFinite(correctCount) || correctCount < 0 || correctCount > totalQuestions) {
    return Response.json({ error: 'Numero di risposte corrette non valido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const verification = await verifyOrClaimNickname(supabase, nickname, nomecognome);
  if (!verification.ok) {
    return Response.json({ error: verification.error }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('trivia_game_score')
    .insert({ nickname, points, correct_count: correctCount, total_questions: totalQuestions })
    .select('id')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, id: data.id });
};
