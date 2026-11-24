import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { isOrario, isUuid } from '../../../lib/ore-lavoro/server';
import { isColoreImpegno } from '../../../lib/ore-lavoro/types';
import { isIsoDate } from '../../../lib/time-grid';

// Impegni personali: creazione su una o più date ("ripeti impegno"),
// modifica di uno, eliminazione di uno o di tutte le sue ripetizioni.

export const prerender = false;

const COLONNE = 'id, staff_id, data, ora_inizio, ora_fine, titolo, colore, note, gruppo_id';
const MAX_DATE = 60;

type Body = Record<string, unknown>;

async function leggiJson(request: Request): Promise<Body | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

const errore = (msg: string, status = 400) => Response.json({ error: msg }, { status });

/** Campi comuni a tutte le date; restituisce il messaggio d'errore o i campi. */
function campi(body: Body): string | Record<string, unknown> {
  if (!isUuid(body.staff_id)) return 'Persona non valida.';
  if (!isOrario(body.ora_inizio) || !isOrario(body.ora_fine)) return 'Orario non valido.';
  if (body.ora_fine <= body.ora_inizio) return "L'ora di fine deve venire dopo quella di inizio.";
  const titolo = typeof body.titolo === 'string' ? body.titolo.trim() : '';
  if (!titolo) return 'Scrivi un titolo.';
  if (titolo.length > 80) return 'Titolo troppo lungo (massimo 80 caratteri).';
  const colore = body.colore ?? 'azzurro';
  if (!isColoreImpegno(colore)) return 'Colore non valido.';
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') return 'Note non valide.';
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  return { staff_id: body.staff_id, ora_inizio: body.ora_inizio, ora_fine: body.ora_fine, titolo, colore, note };
}

// Nuovo impegno su una o più date. Con ripeti_di le date si aggiungono come
// ripetizioni di un impegno esistente (stesso gruppo).
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body) return errore('Richiesta non valida.');

  const c = campi(body);
  if (typeof c === 'string') return errore(c);

  const date = Array.isArray(body.date) ? [...new Set(body.date)] : [];
  if (date.length === 0 || date.length > MAX_DATE || !date.every((d) => typeof d === 'string' && isIsoDate(d))) {
    return errore('Date non valide.');
  }

  const supabase = getSupabaseAdmin();
  let gruppo: string | null = date.length > 1 ? randomUUID() : null;

  if (body.ripeti_di !== undefined) {
    if (!isUuid(body.ripeti_di)) return errore('Impegno da ripetere non valido.');
    const { data: originale, error } = await supabase.from('impegni').select('id, gruppo_id').eq('id', body.ripeti_di).single();
    if (error || !originale) return errore('Impegno da ripetere non trovato.');
    gruppo = originale.gruppo_id ?? randomUUID();
    if (!originale.gruppo_id) {
      const { error: e2 } = await supabase.from('impegni').update({ gruppo_id: gruppo }).eq('id', originale.id);
      if (e2) return errore(e2.message);
    }
  }

  const righe = date.map((data) => ({ ...c, data, gruppo_id: gruppo }));
  const { data, error } = await supabase.from('impegni').insert(righe).select(COLONNE);
  if (error || !data) return errore(error?.message || 'Errore nel salvataggio.');
  return Response.json({ ok: true, impegni: data });
};

// Modifica di un impegno (solo quello, non le sue ripetizioni).
export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.id)) return errore('Impegno non specificato.');

  const c = campi(body);
  if (typeof c === 'string') return errore(c);
  if (typeof body.data !== 'string' || !isIsoDate(body.data)) return errore('Data non valida.');

  const { data, error } = await getSupabaseAdmin()
    .from('impegni')
    .update({ ...c, data: body.data })
    .eq('id', body.id)
    .select(COLONNE)
    .single();
  if (error || !data) return errore(error?.message || 'Errore nel salvataggio.');
  return Response.json({ ok: true, impegno: data });
};

// Eliminazione di un impegno o, con tutte = true, di tutte le sue ripetizioni.
export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.id)) return errore('Impegno non specificato.');

  const supabase = getSupabaseAdmin();
  if (body.tutte === true) {
    const { data: imp } = await supabase.from('impegni').select('gruppo_id').eq('id', body.id).single();
    if (imp?.gruppo_id) {
      const { error } = await supabase.from('impegni').delete().eq('gruppo_id', imp.gruppo_id);
      if (error) return errore(error.message);
      return Response.json({ ok: true });
    }
  }
  const { error } = await supabase.from('impegni').delete().eq('id', body.id);
  if (error) return errore(error.message);
  return Response.json({ ok: true });
};
