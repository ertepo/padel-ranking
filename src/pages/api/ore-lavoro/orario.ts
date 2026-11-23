import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { caricaOrario, isAttivita, isClub, isOrario, isUuid } from '../../../lib/ore-lavoro/server';
import { isIsoDate } from '../../../lib/time-grid';

export const prerender = false;

const errore = (msg: string, status = 400) => Response.json({ error: msg }, { status });

async function leggiJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

/** Valida le operazioni sull'orario; restituisce il messaggio d'errore o le operazioni. */
function operazioni(value: unknown): string | Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return 'Nessuna modifica da applicare.';
  const out: Record<string, unknown>[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return 'Operazione non valida.';
    const o = raw as Record<string, unknown>;
    const orari = (inizio: unknown, fine: unknown, obbligatori: boolean) => {
      if (obbligatori || inizio !== undefined) if (!isOrario(inizio)) return false;
      if (obbligatori || fine !== undefined) if (!isOrario(fine)) return false;
      return !(typeof inizio === 'string' && typeof fine === 'string' && fine <= inizio);
    };
    if (o.club !== undefined && !isClub(o.club)) return 'Club non valido.';
    if (o.attivita !== undefined && !isAttivita(o.attivita)) return 'Attività non valida.';

    if (o.op === 'add') {
      const g = o.giorno_settimana;
      if (typeof g !== 'number' || !Number.isInteger(g) || g < 1 || g > 7) return 'Giorno non valido.';
      if (!orari(o.ora_inizio, o.ora_fine, true)) return 'Orario non valido.';
      out.push({ op: 'add', giorno_settimana: g, ora_inizio: o.ora_inizio, ora_fine: o.ora_fine, club: o.club ?? 'cingoli', attivita: o.attivita ?? 'tennis' });
    } else if (o.op === 'update') {
      if (!isUuid(o.slot_id)) return 'Turno non specificato.';
      if (!orari(o.ora_inizio, o.ora_fine, false)) return 'Orario non valido.';
      out.push({ op: 'update', slot_id: o.slot_id, ora_inizio: o.ora_inizio, ora_fine: o.ora_fine, club: o.club, attivita: o.attivita });
    } else if (o.op === 'delete') {
      if (!isUuid(o.slot_id)) return 'Turno non specificato.';
      out.push({ op: 'delete', slot_id: o.slot_id });
    } else {
      return 'Operazione non valida.';
    }
  }
  return out;
}

// GET ?staff=<uuid>: i periodi dell'orario di un maestro.
export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const staff = url.searchParams.get('staff');
  if (!isUuid(staff)) return errore('Maestro non valido.');
  try {
    return Response.json({ periodi: await caricaOrario(getSupabaseAdmin(), staff) });
  } catch (err) {
    return errore(err instanceof Error ? err.message : 'Errore nel caricamento.', 500);
  }
};

// POST { staff_id, dal, ops }: cambia l'orario da quella data in poi (work_schedule_apply).
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.staff_id)) return errore('Maestro non valido.');
  if (typeof body.dal !== 'string' || !isIsoDate(body.dal)) return errore('Data non valida.');
  const ops = operazioni(body.ops);
  if (typeof ops === 'string') return errore(ops);

  const { data, error } = await getSupabaseAdmin().rpc('work_schedule_apply', {
    p_staff: body.staff_id,
    p_dal: body.dal,
    p_ops: ops,
  });
  if (error) return errore(error.message);
  return Response.json({ ok: true, schedule_id: data });
};

// PATCH { schedule_id, valido_al }: chiude un periodo (o lo riapre con null).
export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.schedule_id)) return errore('Periodo non specificato.');
  if (body.valido_al !== null && (typeof body.valido_al !== 'string' || !isIsoDate(body.valido_al))) {
    return errore('Data non valida.');
  }
  const { error } = await getSupabaseAdmin()
    .from('work_schedule')
    .update({ valido_al: body.valido_al, updated_at: new Date().toISOString() })
    .eq('id', body.schedule_id);
  if (error) {
    const msg = /periodi_disgiunti/.test(error.message)
      ? 'Il periodo si sovrapporrebbe a un altro orario dello stesso maestro.'
      : /periodo_valido/.test(error.message)
        ? 'La fine deve venire dopo l\'inizio.'
        : error.message;
    return errore(msg);
  }
  return Response.json({ ok: true });
};

// DELETE { schedule_id }: elimina un periodo con i suoi turni.
export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.schedule_id)) return errore('Periodo non specificato.');
  const { error } = await getSupabaseAdmin().from('work_schedule').delete().eq('id', body.schedule_id);
  if (error) return errore(error.message);
  return Response.json({ ok: true });
};
