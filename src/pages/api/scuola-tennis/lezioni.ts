import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const prerender = false;

const MIN_DURATA = 30;
const MAX_DURATA = 480;

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

function isValidGiorno(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

function isValidOraInizio(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1439;
}

function isValidDurata(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_DURATA && value <= MAX_DURATA;
}

function parseStudenteIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === 'string' && v)) return null;
  return Array.from(new Set(value));
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(request, cookies)) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: {
    gruppo_id?: unknown;
    giorno_settimana?: unknown;
    ora_inizio_minuti?: unknown;
    durata_minuti?: unknown;
    studente_ids?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const gruppoId = typeof body.gruppo_id === 'string' ? body.gruppo_id : '';

  if (!gruppoId) {
    return Response.json({ error: 'Gruppo non specificato.' }, { status: 400 });
  }
  if (!isValidGiorno(body.giorno_settimana)) {
    return Response.json({ error: 'Giorno della settimana non valido.' }, { status: 400 });
  }
  if (!isValidOraInizio(body.ora_inizio_minuti)) {
    return Response.json({ error: 'Orario di inizio non valido.' }, { status: 400 });
  }
  if (!isValidDurata(body.durata_minuti)) {
    return Response.json({ error: 'Durata non valida.' }, { status: 400 });
  }

  const studenteIds = parseStudenteIds(body.studente_ids ?? []);

  if (studenteIds === null) {
    return Response.json({ error: 'Elenco studenti non valido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: lezione, error } = await supabase
    .from('scuola_tennis_lezioni')
    .insert({
      gruppo_id: gruppoId,
      giorno_settimana: body.giorno_settimana,
      ora_inizio_minuti: body.ora_inizio_minuti,
      durata_minuti: body.durata_minuti,
    })
    .select('*')
    .single();

  if (error || !lezione) {
    return Response.json({ error: error?.message || 'Errore nella creazione della lezione.' }, { status: 400 });
  }

  if (studenteIds.length > 0) {
    const { error: rosterError } = await supabase
      .from('scuola_tennis_lezione_studenti')
      .insert(studenteIds.map((studenteId) => ({ lezione_id: lezione.id, studente_id: studenteId })));

    if (rosterError) {
      await supabase.from('scuola_tennis_lezioni').delete().eq('id', lezione.id);
      return Response.json({ error: rosterError.message }, { status: 400 });
    }
  }

  return Response.json({ ok: true, lezione, studente_ids: studenteIds });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!checkAuth(request, cookies)) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: {
    id?: unknown;
    gruppo_id?: unknown;
    giorno_settimana?: unknown;
    ora_inizio_minuti?: unknown;
    durata_minuti?: unknown;
    studente_ids?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';

  if (!id) {
    return Response.json({ error: 'Lezione non specificata.' }, { status: 400 });
  }
  if (!isValidGiorno(body.giorno_settimana)) {
    return Response.json({ error: 'Giorno della settimana non valido.' }, { status: 400 });
  }
  if (!isValidOraInizio(body.ora_inizio_minuti)) {
    return Response.json({ error: 'Orario di inizio non valido.' }, { status: 400 });
  }
  if (!isValidDurata(body.durata_minuti)) {
    return Response.json({ error: 'Durata non valida.' }, { status: 400 });
  }

  const studenteIds = body.studente_ids === undefined ? null : parseStudenteIds(body.studente_ids);

  if (body.studente_ids !== undefined && studenteIds === null) {
    return Response.json({ error: 'Elenco studenti non valido.' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    giorno_settimana: body.giorno_settimana,
    ora_inizio_minuti: body.ora_inizio_minuti,
    durata_minuti: body.durata_minuti,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.gruppo_id === 'string' && body.gruppo_id) {
    update.gruppo_id = body.gruppo_id;
  }

  const supabase = getSupabaseAdmin();

  const { data: lezione, error } = await supabase
    .from('scuola_tennis_lezioni')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !lezione) {
    return Response.json({ error: error?.message || 'Errore nell\'aggiornamento della lezione.' }, { status: 400 });
  }

  if (studenteIds !== null) {
    const { error: deleteRosterError } = await supabase
      .from('scuola_tennis_lezione_studenti')
      .delete()
      .eq('lezione_id', id);

    if (deleteRosterError) {
      return Response.json({ error: deleteRosterError.message }, { status: 400 });
    }

    if (studenteIds.length > 0) {
      const { error: rosterError } = await supabase
        .from('scuola_tennis_lezione_studenti')
        .insert(studenteIds.map((studenteId) => ({ lezione_id: id, studente_id: studenteId })));

      if (rosterError) {
        return Response.json({ error: rosterError.message }, { status: 400 });
      }
    }
  }

  return Response.json({ ok: true, lezione, studente_ids: studenteIds ?? undefined });
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
    return Response.json({ error: 'Lezione non specificata.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('scuola_tennis_lezioni').delete().eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
};
