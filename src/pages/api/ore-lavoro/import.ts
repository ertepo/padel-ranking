import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { isUuid, periodoValido } from '../../../lib/ore-lavoro/server';
import { leggiCsvOre, pianificaImport } from '../../../lib/ore-lavoro/csv';
import { isIsoDate } from '../../../lib/time-grid';
import type { TurnoPrevisto } from '../../../lib/ore-lavoro/types';

export const prerender = false;

const MAX_CSV = 500_000;
const errore = (msg: string, status = 400) => Response.json({ error: msg }, { status });

// POST { staff_id, csv, dal, al, orario_fino?, sostituto_id?, collega_id?, sostituisci, conferma }
//   conferma false -> anteprima del piano (nulla viene scritto)
//   conferma true  -> applica il piano con work_import_apply (tutto o niente)
// Il piano si ricalcola ogni volta dal CSV e dall'orario attuale.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errore('Richiesta non valida.');
  }

  if (!isUuid(body.staff_id)) return errore('Maestro non valido.');
  if (typeof body.csv !== 'string' || !body.csv.trim()) return errore('File CSV vuoto.');
  if (body.csv.length > MAX_CSV) return errore('File CSV troppo grande.');
  if (!periodoValido(body.dal, body.al)) return errore('Periodo non valido.');
  const dal = body.dal as string;
  const al = body.al as string;
  const fino = body.orario_fino ?? null;
  if (fino !== null && (typeof fino !== 'string' || !isIsoDate(fino) || fino < dal || fino > al)) {
    return errore("La data fino a cui l'orario viene dal CSV deve stare nel periodo.");
  }
  for (const k of ['sostituto_id', 'collega_id'] as const) {
    if (body[k] != null && !isUuid(body[k])) return errore('Persona non valida.');
  }
  if (body.sostituto_id && body.sostituto_id === body.staff_id) return errore('Il sostituto deve essere un\'altra persona.');
  if (body.collega_id && body.collega_id === body.staff_id) return errore('Il collega deve essere un\'altra persona.');

  const { righe, errori } = leggiCsvOre(body.csv);
  if (errori.length) return Response.json({ error: 'Il CSV contiene errori.', errori }, { status: 400 });
  if (righe.length === 0) return errore('Il CSV non contiene righe.');

  const supabase = getSupabaseAdmin();
  const previsti = await supabase.rpc('work_planned_intervals', { p_staff: null, p_dal: dal, p_al: al, p_club: null });
  if (previsti.error) return errore(previsti.error.message, 500);

  const piano = pianificaImport(righe, (previsti.data ?? []) as TurnoPrevisto[], {
    staffId: body.staff_id,
    dal,
    al,
    orarioFino: fino as string | null,
    sostitutoAssenze: (body.sostituto_id as string | null) ?? null,
    collegaSostituzioni: (body.collega_id as string | null) ?? null,
  });
  const sostituisci = body.sostituisci !== false;

  if (body.conferma !== true) {
    // Anteprima: cosa verrebbe tolto e creato.
    const daTogliere = sostituisci
      ? await supabase
          .from('work_exceptions')
          .select('id', { count: 'exact', head: true })
          .gte('data', dal)
          .lte('data', al)
          .or(`assente_id.eq.${body.staff_id},sostituto_id.eq.${body.staff_id}`)
      : { count: 0, error: null };
    if (daTogliere.error) return errore(daTogliere.error.message, 500);
    return Response.json({ ok: true, anteprima: true, righe: righe.length, piano, eccezioni_da_togliere: daTogliere.count ?? 0 });
  }

  const { data, error } = await supabase.rpc('work_import_apply', {
    p_staff: body.staff_id,
    p_dal: dal,
    p_al: al,
    p_sostituisci: sostituisci,
    p_orario_dal: piano.orario?.dal ?? null,
    p_orario_al: piano.orario?.al ?? null,
    p_periodi: piano.periodi,
    p_eccezioni: piano.eccezioni,
    p_giorni: piano.giorni,
  });
  if (error) return errore(error.message);
  return Response.json({ ok: true, risultato: data });
};
