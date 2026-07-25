import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { verifyOrClaimNickname } from '../../lib/gameNickname';

export const prerender = false;

const NICKNAME_MAX_LENGTH = 20;

export const POST: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let body: { nickname?: unknown; nomecognome?: unknown; points?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, NICKNAME_MAX_LENGTH) : '';
  const nomecognome = typeof body.nomecognome === 'string' ? body.nomecognome.trim() : '';
  const points = typeof body.points === 'number' && Number.isFinite(body.points) ? Math.round(body.points) : NaN;

  if (!nickname) {
    return Response.json({ error: 'Nickname mancante.' }, { status: 400 });
  }
  if (!Number.isFinite(points)) {
    return Response.json({ error: 'Punteggio non valido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const verification = await verifyOrClaimNickname(supabase, nickname, nomecognome);
  if (!verification.ok) {
    return Response.json({ error: verification.error }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('slice_game_score')
    .insert({ nickname, points })
    .select('id')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, id: data.id });
};
