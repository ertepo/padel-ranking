import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const prerender = false;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function checkAuth(request: Request, cookies: { get: (name: string) => { value: string } | undefined }) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return false;
  }

  return (
    Boolean(import.meta.env.ADMIN_PASSWORD) &&
    cookies.get('admin_password')?.value === import.meta.env.ADMIN_PASSWORD
  );
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(request, cookies)) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: { nome?: unknown; colore?: unknown; tipo?: unknown; eta?: unknown; livello?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const colore = typeof body.colore === 'string' ? body.colore.trim() : '';
  const tipo = typeof body.tipo === 'string' ? body.tipo.trim() || null : null;
  const eta = typeof body.eta === 'string' ? body.eta.trim() || null : null;
  const livello = typeof body.livello === 'string' ? body.livello.trim() || null : null;

  if (!nome) {
    return Response.json({ error: 'Il nome del gruppo è obbligatorio.' }, { status: 400 });
  }
  if (!HEX_COLOR_PATTERN.test(colore)) {
    return Response.json({ error: 'Colore non valido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: gruppo, error } = await supabase
    .from('scuola_tennis_gruppi')
    .insert({ nome, colore, tipo, eta, livello })
    .select('*')
    .single();

  if (error || !gruppo) {
    return Response.json({ error: error?.message || 'Errore nella creazione del gruppo.' }, { status: 400 });
  }

  return Response.json({ ok: true, gruppo });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(request, cookies)) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: { id?: unknown; nome?: unknown; colore?: unknown; tipo?: unknown; eta?: unknown; livello?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const colore = typeof body.colore === 'string' ? body.colore.trim() : '';
  const tipo = typeof body.tipo === 'string' ? body.tipo.trim() || null : null;
  const eta = typeof body.eta === 'string' ? body.eta.trim() || null : null;
  const livello = typeof body.livello === 'string' ? body.livello.trim() || null : null;

  if (!id) {
    return Response.json({ error: 'Gruppo non specificato.' }, { status: 400 });
  }
  if (!nome) {
    return Response.json({ error: 'Il nome del gruppo è obbligatorio.' }, { status: 400 });
  }
  if (!HEX_COLOR_PATTERN.test(colore)) {
    return Response.json({ error: 'Colore non valido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: gruppo, error } = await supabase
    .from('scuola_tennis_gruppi')
    .update({ nome, colore, tipo, eta, livello })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !gruppo) {
    return Response.json({ error: error?.message || 'Errore nell\'aggiornamento del gruppo.' }, { status: 400 });
  }

  return Response.json({ ok: true, gruppo });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(request, cookies)) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: { id?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';

  if (!id) {
    return Response.json({ error: 'Gruppo non specificato.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('scuola_tennis_gruppi').delete().eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
};
