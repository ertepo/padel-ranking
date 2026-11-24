import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { isAttivita, isClub, isOrario, isUuid } from '../../../lib/ore-lavoro/server';
import { isIsoDate } from '../../../lib/time-grid';

export const prerender = false;

// '*': la colonna privata c'è solo dopo la migrazione 20261129.
const COLONNE = '*';

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

/** Valida e normalizza i campi di un'eccezione; restituisce il messaggio d'errore o la riga. */
function riga(body: Body): string | Record<string, unknown> {
  if (typeof body.data !== 'string' || !isIsoDate(body.data)) return 'Data non valida.';
  if (!isOrario(body.ora_inizio) || !isOrario(body.ora_fine)) return 'Orario non valido.';
  if (body.ora_fine <= body.ora_inizio) return "L'ora di fine deve venire dopo quella di inizio.";

  const assente = body.assente_id ?? null;
  const sostituto = body.sostituto_id ?? null;
  if (assente !== null && !isUuid(assente)) return 'Assente non valido.';
  if (sostituto !== null && !isUuid(sostituto)) return 'Sostituto non valido.';
  if (assente === null && sostituto === null) return 'Indica chi è assente o chi lavora.';
  if (assente !== null && assente === sostituto) return 'Assente e sostituto devono essere persone diverse.';

  const club = body.club ?? 'cingoli';
  const attivita = body.attivita ?? 'tennis';
  if (!isClub(club)) return 'Club non valido.';
  if (!isAttivita(attivita)) return 'Attività non valida.';

  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') return 'Note non valide.';
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  // Ora privata (pagata dal cliente): solo chi la fa, nessun assente. Il campo
  // si manda solo se c'è, così prima della migrazione 20261129 il resto funziona.
  if (body.privata !== undefined && typeof body.privata !== 'boolean') return 'Valore non valido.';
  if (body.privata === true && (assente !== null || sostituto === null)) return "Un'ora privata ha solo chi la fa, senza assente.";
  const privata = body.privata === undefined ? {} : { privata: body.privata };

  return {
    ...privata,
    data: body.data,
    ora_inizio: body.ora_inizio,
    ora_fine: body.ora_fine,
    assente_id: assente,
    sostituto_id: sostituto,
    club,
    attivita,
    note,
  };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body) return errore('Richiesta non valida.');

  const r = riga(body);
  if (typeof r === 'string') return errore(r);

  const { data, error } = await getSupabaseAdmin().from('work_exceptions').insert(r).select(COLONNE).single();
  if (error || !data) return errore(error?.message || 'Errore nel salvataggio.');
  return Response.json({ ok: true, eccezione: data });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.id)) return errore('Eccezione non specificata.');

  const r = riga(body);
  if (typeof r === 'string') return errore(r);

  const { data, error } = await getSupabaseAdmin()
    .from('work_exceptions')
    .update({ ...r, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select(COLONNE)
    .single();
  if (error || !data) return errore(error?.message || 'Errore nel salvataggio.');
  return Response.json({ ok: true, eccezione: data });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.id)) return errore('Eccezione non specificata.');

  const { error } = await getSupabaseAdmin().from('work_exceptions').delete().eq('id', body.id);
  if (error) return errore(error.message);
  return Response.json({ ok: true });
};
