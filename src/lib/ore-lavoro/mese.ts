// Riassunto di un giorno per la vista mese: bollini delle ore fatte (uno per
// ora, mezzo per mezz'ora, nel colore del tipo) e note brevi sulle cose
// particolari ("sostituzione Ludo 4h", "no atletica", "assente 2h").
import { fmtDurata, type Fascia } from '../time-grid.ts';
import { ATTIVITA, COLORI, COLORI_IMPEGNO, type TurnoPrevisto } from './types.ts';
import type { Segmento } from './segmenti.ts';

export interface Bollini {
  colore: string;
  /** Numero di mezz'ore (arrotondato): 5 = due bollini e mezzo. */
  mezzi: number;
}

export interface NotaGiorno {
  testo: string;
  colore: string;
}

export interface RiassuntoGiorno {
  bollini: Bollini[];
  note: NotaGiorno[];
}

const durata = (f: Fascia) => f.fine - f.inizio;

/**
 * @param segmenti  i segmenti del giorno (di chiunque: si usano solo quelli
 *                  della persona, più gli impegni della persona affiancata)
 * @param previsti  i turni previsti del giorno della persona
 */
export function riassuntoGiorno(
  staffId: string,
  segmenti: Segmento[],
  previsti: TurnoPrevisto[],
  nomeDi: (id: string | null | undefined) => string,
  daVerificare = false,
): RiassuntoGiorno {
  const minuti = { lavorato: 0, extra: 0, privata: 0 };
  const note: NotaGiorno[] = [];
  if (daVerificare) note.push({ testo: 'da verificare', colore: COLORI.verifica });

  const miei = previsti.filter((p) => p.staff_id === staffId);
  // In ordine di orario, così le note seguono la giornata.
  for (const s of [...segmenti].sort((a, b) => a.inizio - b.inizio)) {
    if (s.staff_id !== staffId && s.tipo !== 'impegno-altrui') continue;
    const e = s.eccezione;
    if (s.tipo === 'lavorato') minuti.lavorato += durata(s);
    else if (s.tipo === 'extra') {
      if (e?.privata) {
        minuti.privata += durata(s);
        note.push({ testo: `privata ${fmtDurata(durata(s))}`, colore: COLORI.privata });
      } else {
        minuti.extra += durata(s);
        const testo = e?.assente_id ? `sostituzione ${nomeDi(e.assente_id)} ${fmtDurata(durata(s))}` : `extra ${fmtDurata(durata(s))}`;
        note.push({ testo, colore: COLORI.extra });
      }
    } else if (s.tipo === 'assente') {
      // Tutto un turno saltato: "no atletica"; se no le ore di assenza.
      const intero = miei.find((p) => {
        const [hi, mi] = p.ora_inizio.split(':').map(Number);
        const [hf, mf] = p.ora_fine.split(':').map(Number);
        return s.inizio <= hi * 60 + mi && s.fine >= hf * 60 + mf;
      });
      const chi = e?.sostituto_id ? `, sostituito da ${nomeDi(e.sostituto_id)}` : '';
      const testo = intero
        ? `no ${ATTIVITA[intero.attivita].toLowerCase()}${chi}`
        : e?.sostituto_id
          ? `sostituito da ${nomeDi(e.sostituto_id)} ${fmtDurata(durata(s))}`
          : `assente ${fmtDurata(durata(s))}`;
      note.push({ testo, colore: COLORI.assente });
    } else if ((s.tipo === 'impegno' || s.tipo === 'impegno-altrui') && s.impegno) {
      const di = s.tipo === 'impegno-altrui' ? `${nomeDi(s.staff_id)}: ` : '';
      note.push({ testo: `${di}${s.impegno.titolo}`, colore: COLORI_IMPEGNO[s.impegno.colore] });
    }
  }

  const bollini: Bollini[] = [
    { colore: daVerificare ? COLORI.verifica : COLORI.lavorato, mezzi: Math.round(minuti.lavorato / 30) },
    { colore: COLORI.extra, mezzi: Math.round(minuti.extra / 30) },
    { colore: COLORI.privata, mezzi: Math.round(minuti.privata / 30) },
  ].filter((b) => b.mezzi > 0);

  return { bollini, note };
}
