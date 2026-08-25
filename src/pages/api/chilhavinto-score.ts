import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { verifyOrClaimNickname } from '../../lib/gameNickname';

export const prerender = false;

const NICKNAME_MAX_LENGTH = 20;
const MAX_LEVEL = 100;

export const POST: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let body: { nickname?: unknown; nomecognome?: unknown; levelReached?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, NICKNAME_MAX_LENGTH) : '';
  const nomecognome = typeof body.nomecognome === 'string' ? body.nomecognome.trim() : '';
  const levelReached =
    typeof body.levelReached === 'number' && Number.isFinite(body.levelReached) ? Math.round(body.levelReached) : NaN;

  if (!nickname) {
    return Response.json({ error: 'Nickname mancante.' }, { status: 400 });
  }
  if (!Number.isFinite(levelReached) || levelReached < 0 || levelReached > MAX_LEVEL) {
    return Response.json({ error: 'Livello raggiunto non valido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const verification = await verifyOrClaimNickname(supabase, nickname, nomecognome);
  if (!verification.ok) {
    return Response.json({ error: verification.error }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('chilhavinto_game_score')
    .insert({ nickname, level_reached: levelReached })
    .select('id')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, id: data.id });
};
