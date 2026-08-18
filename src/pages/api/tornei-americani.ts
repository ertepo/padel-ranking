import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let body: { stato?: unknown; nome?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 120) : '';
  if (!nome) {
    return Response.json({ error: 'Nome del torneo mancante.' }, { status: 400 });
  }
  if (!body.stato || typeof body.stato !== 'object') {
    return Response.json({ error: 'Stato del torneo mancante.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('tornei_americani')
    .insert({ nome, stato: body.stato })
    .select('id')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, id: data.id });
};
