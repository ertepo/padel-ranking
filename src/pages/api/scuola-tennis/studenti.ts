import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const prerender = false;

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

  let body: { nome?: unknown; cognome?: unknown; gruppo_id?: unknown; note?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const cognome = typeof body.cognome === 'string' ? body.cognome.trim() : '';
  const gruppoId = typeof body.gruppo_id === 'string' && body.gruppo_id ? body.gruppo_id : null;
  const note = typeof body.note === 'string' ? body.note.trim() || null : null;

  if (!nome || !cognome) {
    return Response.json({ error: 'Nome e cognome sono obbligatori.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: studente, error } = await supabase
    .from('scuola_tennis_studenti')
    .insert({ nome, cognome, gruppo_id: gruppoId, note })
    .select('*')
    .single();

  if (error || !studente) {
    return Response.json({ error: error?.message || 'Errore nella creazione dello studente.' }, { status: 400 });
  }

  return Response.json({ ok: true, studente });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(request, cookies)) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: { id?: unknown; nome?: unknown; cognome?: unknown; gruppo_id?: unknown; note?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const cognome = typeof body.cognome === 'string' ? body.cognome.trim() : '';
  const gruppoId = typeof body.gruppo_id === 'string' && body.gruppo_id ? body.gruppo_id : null;
  const note = typeof body.note === 'string' ? body.note.trim() || null : null;

  if (!id) {
    return Response.json({ error: 'Studente non specificato.' }, { status: 400 });
  }
  if (!nome || !cognome) {
    return Response.json({ error: 'Nome e cognome sono obbligatori.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: studente, error } = await supabase
    .from('scuola_tennis_studenti')
    .update({ nome, cognome, gruppo_id: gruppoId, note })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !studente) {
    return Response.json({ error: error?.message || 'Errore nell\'aggiornamento dello studente.' }, { status: 400 });
  }

  return Response.json({ ok: true, studente });
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
    return Response.json({ error: 'Studente non specificato.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('scuola_tennis_studenti').delete().eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
};
