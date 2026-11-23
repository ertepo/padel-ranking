// Lettura dei dati delle ore di lavoro, lato server (service role). Le ore
// vengono sempre dalle funzioni SQL della migrazione 20261123_ore_lavoro.sql.
import type { SupabaseClient } from '@supabase/supabase-js';
import { isIsoDate } from '../time-grid.ts';
import type { DatiPeriodo, Eccezione, GiornoOre, RiepilogoOre, Staff, TurnoPrevisto } from './types';

export const MAX_GIORNI_PERIODO = 400;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
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
  raggruppa: 'week' | 'month' = 'week',
): Promise<DatiPeriodo> {
  // staffId finisce in un filtro PostgREST testuale: deve essere un uuid.
  if (!isUuid(staffId)) throw new Error('Maestro non valido.');
  const filtroPersona = `assente_id.eq.${staffId},sostituto_id.eq.${staffId}`;

  const [previsti, eccezioni, giorni, riepiloghi] = await Promise.all([
    supabase.rpc('work_planned_intervals', { p_staff: staffId, p_dal: dal, p_al: al }),
    supabase
      .from('work_exceptions')
      .select('id, data, ora_inizio, ora_fine, assente_id, sostituto_id, note')
      .gte('data', dal)
      .lte('data', al)
      .or(filtroPersona)
      .order('data')
      .order('ora_inizio'),
    supabase.rpc('work_hours_daily', { p_staff: staffId, p_dal: dal, p_al: al }),
    supabase.rpc('work_hours_summary', { p_staff: staffId, p_dal: dal, p_al: al, p_periodo: raggruppa }),
  ]);

  for (const r of [previsti, eccezioni, giorni, riepiloghi]) {
    if (r.error) throw new Error(r.error.message);
  }

  return {
    staff_id: staffId,
    dal,
    al,
    previsti: ((previsti.data ?? []) as TurnoPrevisto[]).map(({ data, ora_inizio, ora_fine }) => ({ data, ora_inizio, ora_fine })),
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
