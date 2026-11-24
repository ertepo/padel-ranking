// Geometria dei blocchi del calendario di un maestro, giorno per giorno.
// Solo disegno: i minuti e i totali vengono dalle funzioni SQL.
//   lavorato        suo turno previsto, tolte le fasce in cui è assente
//   assente         ogni sua assenza (con o senza sostituto), per intero
//   extra           ogni sostituzione o ora extra fatta da lui, per intero
//   collega         turno previsto di un collega, tolte le sue assenze
//   collega-assente assenza di un collega non coperta da lui (scoperta o
//                   coperta da un terzo)
//   impegno         suo impegno personale (non conta nelle ore)
//   impegno-altrui  impegno personale di un collega mostrato (es. il partner)
import { timeToMinuti, type Fascia } from '../time-grid.ts';
import type { Attivita, Club, Eccezione, Impegno, Staff, TurnoPrevisto } from './types';

export type TipoSegmento = 'lavorato' | 'assente' | 'extra' | 'collega' | 'collega-assente' | 'impegno' | 'impegno-altrui';

export interface Segmento extends Fascia {
  id: string;
  data: string;
  tipo: TipoSegmento;
  /** Di chi è il turno (per collega / collega-assente è il collega). */
  staff_id: string;
  club: Club;
  attivita: Attivita;
  /** Il turno previsto da cui nasce (lavorato, collega) e il suo id nell'orario. */
  turno?: Fascia;
  slot_id?: string;
  /** L'eccezione da cui nasce (assente, extra, collega-assente). */
  eccezione?: Eccezione;
  /** L'impegno personale da cui nasce (impegno, impegno-altrui). */
  impegno?: Impegno;
}

/** Sottrae da ogni fascia di base tutte le fasce da togliere. */
export function sottraiFasce(base: Fascia[], togli: Fascia[]): Fascia[] {
  let resto = base.map((f) => ({ inizio: f.inizio, fine: f.fine }));
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

export const fasciaDi = (x: { ora_inizio: string; ora_fine: string }): Fascia => ({
  inizio: timeToMinuti(x.ora_inizio),
  fine: timeToMinuti(x.ora_fine),
});

/** I turni (già tolte le assenze) di una persona in un giorno, con i loro attributi. */
function turniMenoAssenze(
  data: string,
  staffId: string,
  previsti: TurnoPrevisto[],
  assenze: Eccezione[],
  tipo: 'lavorato' | 'collega',
): Segmento[] {
  const out: Segmento[] = [];
  previsti
    .filter((p) => p.data === data && p.staff_id === staffId)
    .forEach((p, i) => {
      const turno = fasciaDi(p);
      sottraiFasce([turno], assenze.map(fasciaDi)).forEach((f, j) => {
        out.push({
          id: `${tipo}-${staffId}-${data}-${i}-${j}`,
          data,
          tipo,
          staff_id: staffId,
          club: p.club,
          attivita: p.attivita,
          turno,
          slot_id: p.slot_id,
          ...f,
        });
      });
    });
  return out;
}

/** La persona affiancata a staffId (es. il partner), in un senso o nell'altro. */
export function affiancatoDi(staff: Staff[], staffId: string | null): Staff | null {
  if (!staffId) return null;
  const io = staff.find((s) => s.id === staffId);
  return staff.find((s) => s.id !== staffId && (s.id === io?.affiancato_id || s.affiancato_id === staffId)) ?? null;
}

export function segmentiPeriodo(
  staffId: string,
  previsti: TurnoPrevisto[],
  eccezioni: Eccezione[],
  /** true: tutti i colleghi; false: nessuno; funzione: solo quelli per cui dà true. */
  conColleghi: boolean | ((id: string) => boolean) = true,
  impegni: Impegno[] = [],
): Segmento[] {
  const out: Segmento[] = [];
  const date = new Set([...previsti.map((p) => p.data), ...eccezioni.map((e) => e.data)]);
  const mostraAltrui = (id: string) => (typeof conColleghi === 'function' ? conColleghi(id) : conColleghi);
  for (const i of impegni) {
    if (i.staff_id !== staffId && !mostraAltrui(i.staff_id)) continue;
    out.push({
      id: `impegno-${i.id}`,
      data: i.data,
      tipo: i.staff_id === staffId ? 'impegno' : 'impegno-altrui',
      staff_id: i.staff_id,
      club: 'cingoli',
      attivita: 'tennis',
      impegno: i,
      ...fasciaDi(i),
    });
  }

  for (const data of [...date].sort()) {
    const delGiorno = eccezioni.filter((e) => e.data === data);
    const mieAssenze = delGiorno.filter((e) => e.assente_id === staffId);

    out.push(...turniMenoAssenze(data, staffId, previsti, mieAssenze, 'lavorato'));
    for (const e of mieAssenze) {
      out.push({ id: e.id, data, tipo: 'assente', staff_id: staffId, club: e.club, attivita: e.attivita, eccezione: e, ...fasciaDi(e) });
    }
    for (const e of delGiorno.filter((x) => x.sostituto_id === staffId)) {
      out.push({ id: e.id, data, tipo: 'extra', staff_id: staffId, club: e.club, attivita: e.attivita, eccezione: e, ...fasciaDi(e) });
    }

    if (!conColleghi) continue;
    const colleghi = new Set(previsti.filter((p) => p.data === data && p.staff_id !== staffId).map((p) => p.staff_id));
    for (const e of delGiorno) if (e.assente_id && e.assente_id !== staffId) colleghi.add(e.assente_id);
    // Ore extra dei colleghi (senza un assente): sono impegni loro anche se non nell'orario.
    const extraColleghi = delGiorno.filter((e) => !e.assente_id && e.sostituto_id && e.sostituto_id !== staffId);
    for (const e of extraColleghi) colleghi.add(e.sostituto_id!);
    if (typeof conColleghi === 'function') for (const c of colleghi) if (!conColleghi(c)) colleghi.delete(c);

    for (const c of colleghi) {
      const assenzeCollega = delGiorno.filter((e) => e.assente_id === c);
      out.push(...turniMenoAssenze(data, c, previsti, assenzeCollega, 'collega'));
      for (const e of assenzeCollega.filter((x) => x.sostituto_id !== staffId)) {
        out.push({ id: e.id, data, tipo: 'collega-assente', staff_id: c, club: e.club, attivita: e.attivita, eccezione: e, ...fasciaDi(e) });
      }
      for (const e of extraColleghi.filter((x) => x.sostituto_id === c)) {
        out.push({ id: e.id, data, tipo: 'collega', staff_id: c, club: e.club, attivita: e.attivita, eccezione: e, ...fasciaDi(e) });
      }
    }
  }
  return out;
}
