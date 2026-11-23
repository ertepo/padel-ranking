// Geometria dei blocchi del calendario di un maestro, giorno per giorno.
// Solo disegno: i minuti e i totali vengono dalle funzioni SQL.
//   verde/azzurro  turno previsto, tolte le fasce in cui è assente
//   giallo         ogni assenza (con o senza sostituto), per intero
//   fucsia         ogni sostituzione o ora extra fatta da lui, per intero
import { timeToMinuti, type Fascia } from '../time-grid.ts';
import type { Eccezione, TurnoPrevisto } from './types';

export type TipoSegmento = 'lavorato' | 'assente' | 'extra';

export interface Segmento extends Fascia {
  id: string;
  data: string;
  tipo: TipoSegmento;
  /** L'eccezione da cui nasce (assente, extra). */
  eccezione?: Eccezione;
}

/** Sottrae da ogni fascia di base tutte le fasce da togliere. */
export function sottraiFasce(base: Fascia[], togli: Fascia[]): Fascia[] {
  let resto = base.map((f) => ({ ...f }));
  for (const t of togli) {
    const prossimo: Fascia[] = [];
    for (const f of resto) {
      if (t.fine <= f.inizio || t.inizio >= f.fine) {
        prossimo.push(f);
        continue;
      }
      if (t.inizio > f.inizio) prossimo.push({ inizio: f.inizio, fine: t.inizio });
      if (t.fine < f.fine) prossimo.push({ inizio: t.fine, fine: f.fine });
    }
    resto = prossimo;
  }
  return resto.sort((a, b) => a.inizio - b.inizio);
}

const fasciaDi = (x: { ora_inizio: string; ora_fine: string }): Fascia => ({
  inizio: timeToMinuti(x.ora_inizio),
  fine: timeToMinuti(x.ora_fine),
});

export function segmentiPeriodo(staffId: string, previsti: TurnoPrevisto[], eccezioni: Eccezione[]): Segmento[] {
  const out: Segmento[] = [];
  const date = new Set([...previsti.map((p) => p.data), ...eccezioni.map((e) => e.data)]);

  for (const data of [...date].sort()) {
    const turni = previsti.filter((p) => p.data === data).map(fasciaDi);
    const delGiorno = eccezioni.filter((e) => e.data === data);
    const assenze = delGiorno.filter((e) => e.assente_id === staffId);
    const sostituzioni = delGiorno.filter((e) => e.sostituto_id === staffId);

    sottraiFasce(turni, assenze.map(fasciaDi)).forEach((f, i) => {
      out.push({ id: `turno-${data}-${i}`, data, tipo: 'lavorato', ...f });
    });
    for (const e of assenze) out.push({ id: e.id, data, tipo: 'assente', eccezione: e, ...fasciaDi(e) });
    for (const e of sostituzioni) out.push({ id: e.id, data, tipo: 'extra', eccezione: e, ...fasciaDi(e) });
  }
  return out;
}
