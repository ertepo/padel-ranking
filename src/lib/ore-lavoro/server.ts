// Lettura dei dati delle ore di lavoro, lato server (service role). Le ore
// vengono sempre dalle funzioni SQL della migrazione 20261123_ore_lavoro.sql.
import type { SupabaseClient } from '@supabase/supabase-js';
import { isIsoDate } from '../time-grid.ts';
import type { Club, DatiPeriodo, Eccezione, GiornoOre, RiepilogoOre, Staff, TurnoPrevisto } from './types';

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

export async function caricaStaff(supabase: SupabaseClient): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, nome, ruolo, colore, sono_io, attivo, note')
    .order('sono_io', { ascending: false })
    .order('ruolo', { ascending: true })
    .order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Staff[];
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

  const [previsti, eccezioni, giorni, riepiloghi] = await Promise.all([
    supabase.rpc('work_planned_intervals', { p_staff: null, p_dal: dal, p_al: al, p_club: club }),
    queryEccezioni,
    supabase.rpc('work_hours_daily', { p_staff: staffId, p_dal: dal, p_al: al, p_club: club }),
    supabase.rpc('work_hours_summary', { p_staff: staffId, p_dal: dal, p_al: al, p_periodo: raggruppa, p_club: club }),
  ]);

  for (const r of [previsti, eccezioni, giorni, riepiloghi]) {
    if (r.error) throw new Error(r.error.message);
  }

  return {
    staff_id: staffId,
    dal,
    al,
    club,
    previsti: ((previsti.data ?? []) as TurnoPrevisto[]).map(({ data, ora_inizio, ora_fine, staff_id, club, attivita }) => ({
      data, ora_inizio, ora_fine, staff_id, club, attivita,
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
    })),
    riepiloghi: (riepiloghi.data ?? []) as RiepilogoOre[],
  };
}
