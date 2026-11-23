import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { isUuid } from '../../../lib/ore-lavoro/server';

export const prerender = false;

const COLONNE = 'id, nome, ruolo, colore, sono_io, attivo, note';
const RUOLI = ['maestro', 'collaboratore'];
const COLORE_RE = /^#[0-9a-f]{6}$/i;

function nomeValido(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80;
}

async function leggiJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

// Nuovo maestro o collaboratore.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();

  const body = await leggiJson(request);
  if (!body) return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  if (!nomeValido(body.nome)) return Response.json({ error: 'Nome non valido.' }, { status: 400 });

  const ruolo = body.ruolo ?? 'maestro';
  if (typeof ruolo !== 'string' || !RUOLI.includes(ruolo)) {
    return Response.json({ error: 'Ruolo non valido.' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('staff')
    .insert({ nome: body.nome.trim(), ruolo })
    .select(COLONNE)
    .single();

  if (error || !data) return Response.json({ error: error?.message || 'Errore nel salvataggio.' }, { status: 400 });
  return Response.json({ ok: true, staff: data });
};

// Modifica di nome, ruolo, colore, attivo, note. "sono_io" non si cambia da qui.
export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();

  const body = await leggiJson(request);
  if (!body || !isUuid(body.id)) return Response.json({ error: 'Persona non specificata.' }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (body.nome !== undefined) {
    if (!nomeValido(body.nome)) return Response.json({ error: 'Nome non valido.' }, { status: 400 });
    update.nome = body.nome.trim();
  }
  if (body.ruolo !== undefined) {
    if (typeof body.ruolo !== 'string' || !RUOLI.includes(body.ruolo)) {
      return Response.json({ error: 'Ruolo non valido.' }, { status: 400 });
    }
    update.ruolo = body.ruolo;
  }
  if (body.colore !== undefined) {
    if (typeof body.colore !== 'string' || !COLORE_RE.test(body.colore)) {
      return Response.json({ error: 'Colore non valido.' }, { status: 400 });
    }
    update.colore = body.colore;
  }
  if (body.attivo !== undefined) {
    if (typeof body.attivo !== 'boolean') return Response.json({ error: 'Valore non valido.' }, { status: 400 });
    update.attivo = body.attivo;
  }
  if (body.note !== undefined) {
    if (body.note !== null && typeof body.note !== 'string') {
      return Response.json({ error: 'Note non valide.' }, { status: 400 });
    }
    update.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  }

  if (Object.keys(update).length === 0) return Response.json({ error: 'Nessuna modifica.' }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from('staff')
    .update(update)
    .eq('id', body.id)
    .select(COLONNE)
    .single();

  if (error || !data) return Response.json({ error: error?.message || 'Errore nel salvataggio.' }, { status: 400 });
  return Response.json({ ok: true, staff: data });
};
