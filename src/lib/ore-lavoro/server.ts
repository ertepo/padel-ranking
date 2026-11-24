// Lettura dei dati delle ore di lavoro, lato server (service role). Le ore
// vengono sempre dalle funzioni SQL della migrazione 20261123_ore_lavoro.sql.
import type { SupabaseClient } from '@supabase/supabase-js';
import { isIsoDate } from '../time-grid.ts';
import type { Club, DatiPeriodo, PeriodoOrario, Eccezione, GiornoOre, Impegno, RiepilogoOre, Staff, TurnoPrevisto } from './types';

export const MAX_GIORNI_PERIODO = 400;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isClub(value: unknown): value is Club {
  return value === 'cingoli' || value === 'poggio';
}

export function isAttivita(value: unknown): value is 'tennis' | 'atletica' {
  return value === 'tennis' || value === 'atletica';
}

/** "16:30" o "16:30:00" con minuti multipli di 5, fino a 24:00. */
export function isOrario(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = /^(\d{2}):(\d{2})(?::00)?$/.exec(value);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return (h < 24 && min < 60 && min % 5 === 0) || (h === 24 && min === 0);
}

export const COLONNE_STAFF = 'id, nome, ruolo, colore, sono_io, attivo, note, affiancato_id, tennis';
// Senza le migrazioni 20261128 e 20261127 queste colonne non ci sono ancora.
const COLONNE_STAFF_RIDOTTE = ['id, nome, ruolo, colore, sono_io, attivo, note, affiancato_id', 'id, nome, ruolo, colore, sono_io, attivo, note'];

export async function caricaStaff(supabase: SupabaseClient): Promise<Staff[]> {
  const leggi = (colonne: string) =>
    supabase
      .from('staff')
      .select(colonne)
      .order('sono_io', { ascending: false })
      .order('ruolo', { ascending: true })
      .order('nome', { ascending: true });
  let { data, error } = await leggi(COLONNE_STAFF);
  for (const colonne of COLONNE_STAFF_RIDOTTE) {
    if (!error || !/affiancato_id|tennis/.test(error.message)) break;
    ({ data, error } = await leggi(colonne));
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Staff[];
}

/** Valida un periodo [dal, al] (date ISO, al >= dal, non troppo lungo). */
export function periodoValido(dal: unknown, al: unknown): dal is string {
  if (typeof dal !== 'string' || typeof al !== 'string') return false;
  if (!isIsoDate(dal) || !isIsoDate(al) || al < dal) return false;
  const giorni = (Date.parse(al) - Date.parse(dal)) / 86_400_000;
  return giorni <= MAX_GIORNI_PERIODO;
}

export async function caricaPeriodo(
  supabase: SupabaseClient,
  staffId: string,
  dal: string,
  al: string,
  opzioni: { raggruppa?: 'week' | 'month'; club?: Club | null } = {},
): Promise<DatiPeriodo> {
  if (!isUuid(staffId)) throw new Error('Maestro non valido.');
  const raggruppa = opzioni.raggruppa ?? 'week';
  const club = opzioni.club ?? null;

  let queryEccezioni = supabase
    .from('work_exceptions')
    .select('id, data, ora_inizio, ora_fine, assente_id, sostituto_id, club, attivita, note')
    .gte('data', dal)
    .lte('data', al)
    .order('data')
    .order('ora_inizio');
  if (club) queryEccezioni = queryEccezioni.eq('club', club);

  const queryImpegni = supabase
    .from('impegni')
    .select('id, staff_id, data, ora_inizio, ora_fine, titolo, colore, note, gruppo_id')
    .gte('data', dal)
    .lte('data', al)
    .order('data')
    .order('ora_inizio');

  const [previsti, eccezioni, giorni, riepiloghi, settimane, impegni] = await Promise.all([
    supabase.rpc('work_planned_intervals', { p_staff: null, p_dal: dal, p_al: al, p_club: club }),
    queryEccezioni,
    supabase.rpc('work_hours_daily', { p_staff: staffId, p_dal: dal, p_al: al, p_club: club }),
    supabase.rpc('work_hours_summary', { p_staff: staffId, p_dal: dal, p_al: al, p_periodo: raggruppa, p_club: club }),
    raggruppa === 'month'
      ? supabase.rpc('work_hours_summary', { p_staff: staffId, p_dal: dal, p_al: al, p_periodo: 'week', p_club: club })
      : Promise.resolve({ data: null, error: null }),
    queryImpegni,
  ]);
  // Senza la migrazione 20261128 la tabella degli impegni non c'è ancora: si va avanti senza.
  const impegniMancanti = Boolean(impegni.error && /impegni/.test(impegni.error.message));
  if (impegni.error && !impegniMancanti) throw new Error(impegni.error.message);

  for (const r of [previsti, eccezioni, giorni, riepiloghi, settimane]) {
    if (r.error) throw new Error(r.error.message);
  }

  return {
    staff_id: staffId,
    dal,
    al,
    club,
    previsti: ((previsti.data ?? []) as TurnoPrevisto[]).map(({ data, ora_inizio, ora_fine, staff_id, club, attivita, slot_id }) => ({
      data, ora_inizio, ora_fine, staff_id, club, attivita, slot_id,
    })),
    eccezioni: (eccezioni.data ?? []) as Eccezione[],
    giorni: ((giorni.data ?? []) as (GiornoOre & Record<string, unknown>)[]).map((g) => ({
      data: g.data,
      minuti_previsti: g.minuti_previsti,
      minuti_lavorati: g.minuti_lavorati,
      minuti_assenza: g.minuti_assenza,
      minuti_sostituito: g.minuti_sostituito,
      minuti_assente_senza_sostituto: g.minuti_assente_senza_sostituto,
      minuti_sostituzioni: g.minuti_sostituzioni,
      minuti_differenza: g.minuti_differenza,
      da_verificare: g.da_verificare,
      nota_giorno: g.nota_giorno,
      sostituito_da: ((g.sostituito_da ?? []) as GiornoOre['sostituito_da']).map(({ sostituto_id, sostituto, minuti }) => ({
        sostituto_id, sostituto, minuti,
      })),
      sostituzioni: ((g.sostituzioni ?? []) as GiornoOre['sostituzioni']).map(({ assente_id, assente, minuti }) => ({
        assente_id, assente, minuti,
      })),
    })),
    riepiloghi: (riepiloghi.data ?? []) as RiepilogoOre[],
    settimane: raggruppa === 'month' ? ((settimane.data ?? []) as RiepilogoOre[]) : undefined,
    impegni: impegniMancanti ? [] : ((impegni.data ?? []) as Impegno[]),
  };
}

/** I periodi dell'orario di un maestro, dal più recente, con i turni ordinati. */
export async function caricaOrario(supabase: SupabaseClient, staffId: string): Promise<PeriodoOrario[]> {
  if (!isUuid(staffId)) throw new Error('Maestro non valido.');
  const { data, error } = await supabase
    .from('work_schedule')
    .select('id, valido_dal, valido_al, note, work_schedule_slots(id, giorno_settimana, ora_inizio, ora_fine, club, attivita)')
    .eq('staff_id', staffId)
    .order('valido_dal', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => {
    const { work_schedule_slots: slots, ...resto } = p as typeof p & { work_schedule_slots: PeriodoOrario['turni'] };
    return {
      ...(resto as Omit<PeriodoOrario, 'turni'>),
      turni: [...(slots ?? [])].sort((a, b) => a.giorno_settimana - b.giorno_settimana || a.ora_inizio.localeCompare(b.ora_inizio)),
    };
  });
}
