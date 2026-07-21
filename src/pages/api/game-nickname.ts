import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { verifyOrClaimNickname } from '../../lib/gameNickname';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let body: { nickname?: unknown; nomecognome?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  const nomecognome = typeof body.nomecognome === 'string' ? body.nomecognome.trim() : '';

  const result = await verifyOrClaimNickname(getSupabaseAdmin(), nickname, nomecognome);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 409 });
  }

  return Response.json({ ok: true });
};
