// CSV delle ore di lavoro: lettura delle fasce lavorate, piano di import
// (applicato poi in SQL da work_import_apply) ed export del riepilogo.
//
// Formato di import: una riga per fascia in cui si è stati in campo.
//   data,inizio,fine,ore,tipo,note
//   2026-10-06,15:30,16:30,1,sostituzione,Sostituzione altro maestro
// Separatore "," o ";". Data AAAA-MM-GG o GG/MM/AAAA. Orari 15:30 o 15.30.
// tipo: lavorato | da_verificare | sostituzione | extra (vuoto = lavorato).
// La colonna "ore" è facoltativa e si usa solo per controllo.
import { addGiorni, fmtOreDecimali, isIsoDate, isoDow, minutiToTime, GIORNI } from '../time-grid.ts';
import { sottraiFasce, fasciaDi } from './segmenti.ts';
import type { Attivita, Club, GiornoOre, RiepilogoOre, TurnoPrevisto } from './types';

export type TipoRiga = 'lavorato' | 'da_verificare' | 'sostituzione' | 'extra';

export interface RigaCsv {
  /** Numero di riga nel file (1 = intestazione). */
  riga: number;
  data: string;
  inizio: number;
  fine: number;
  tipo: TipoRiga;
  note: string;
}

// --- Lettura ------------------------------------------------------------------

function dividi(riga: string, sep: string): string[] {
  const out: string[] = [];
  let campo = '';
  let virgolette = false;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (virgolette) {
      if (c === '"' && riga[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') virgolette = false;
      else campo += c;
    } else if (c === '"') virgolette = true;
    else if (c === sep) {
      out.push(campo);
      campo = '';
    } else campo += c;
  }
  out.push(campo);
  return out.map((x) => x.trim());
}

function leggiData(v: string): string | null {
  if (isIsoDate(v)) return v;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

function leggiOra(v: string): number | null {
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?$/.exec(v);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

function leggiTipo(v: string): TipoRiga | null {
  const t = v.toLowerCase().replace(/[\s-]+/g, '_');
  if (t === '' || t === 'lavorato' || t === 'lavorata') return 'lavorato';
  if (t === 'da_verificare' || t === 'verificare') return 'da_verificare';
  if (t === 'sostituzione' || t === 'sostituzioni') return 'sostituzione';
  if (t === 'extra' || t === 'ore_extra') return 'extra';
  return null;
}

export function leggiCsvOre(testo: string): { righe: RigaCsv[]; errori: string[] } {
  const linee = testo.replace(/^﻿/, '').split(/\r?\n/);
  const errori: string[] = [];
  const righe: RigaCsv[] = [];
  const intestazione = linee[0] ?? '';
  const sep = (intestazione.match(/;/g)?.length ?? 0) > (intestazione.match(/,/g)?.length ?? 0) ? ';' : ',';
  const colonne = dividi(intestazione, sep).map((c) => c.toLowerCase());
  const idx = (nome: string) => colonne.indexOf(nome);
  const [iData, iInizio, iFine, iTipo, iNote, iOre] = ['data', 'inizio', 'fine', 'tipo', 'note', 'ore'].map(idx);
  if (iData < 0 || iInizio < 0 || iFine < 0) {
    return { righe, errori: ['Intestazione non valida: servono almeno le colonne data, inizio, fine.'] };
  }

  linee.slice(1).forEach((linea, i) => {
    const n = i + 2;
    if (!linea.trim()) return;
    const c = dividi(linea, sep);
    const data = leggiData(c[iData] ?? '');
    const inizio = leggiOra(c[iInizio] ?? '');
    const fine = leggiOra(c[iFine] ?? '');
    const tipo = leggiTipo(iTipo >= 0 ? (c[iTipo] ?? '') : '');
    if (!data) return errori.push(`Riga ${n}: data non valida (${c[iData] ?? ''}).`);
    if (inizio === null || fine === null) return errori.push(`Riga ${n}: orario non valido.`);
    if (fine <= inizio) return errori.push(`Riga ${n}: la fine deve venire dopo l'inizio.`);
    if (!tipo) return errori.push(`Riga ${n}: tipo sconosciuto (${c[iTipo]}).`);
    if (iOre >= 0 && c[iOre]) {
      const ore = Number(c[iOre].replace(',', '.'));
      if (Number.isFinite(ore) && Math.abs(ore * 60 - (fine - inizio)) > 1) {
        errori.push(`Riga ${n}: le ore (${c[iOre]}) non corrispondono a ${minutiToTime(inizio)}-${minutiToTime(fine)}.`);
        return;
      }
    }
    righe.push({ riga: n, data, inizio, fine, tipo, note: iNote >= 0 ? (c[iNote] ?? '') : '' });
  });

  // Fasce sovrapposte nello stesso giorno: quasi sempre un errore di trascrizione.
  const perData = new Map<string, RigaCsv[]>();
  for (const r of righe) perData.set(r.data, [...(perData.get(r.data) ?? []), r]);
  for (const [data, lista] of perData) {
    const ord = [...lista].sort((a, b) => a.inizio - b.inizio);
    for (let i = 1; i < ord.length; i++) {
      if (ord[i].inizio < ord[i - 1].fine) errori.push(`Righe ${ord[i - 1].riga} e ${ord[i].riga}: fasce sovrapposte il ${data}.`);
    }
  }
  return { righe: righe.sort((a, b) => a.data.localeCompare(b.data) || a.inizio - b.inizio), errori };
}

// --- Piano di import ------------------------------------------------------------

export interface OpzioniImport {
  staffId: string;
  dal: string;
  al: string;
  /** Fino a questa data (compresa) i turni previsti sono le fasce del CSV. null = si usa l'orario esistente. */
  orarioFino: string | null;
  /** Sostituto da indicare nelle assenze dedotte (null = senza sostituto). */
  sostitutoAssenze: string | null;
  /** Collega sostituito nelle righe "sostituzione" (null = chi aveva il turno in quella fascia, se c'è). */
  collegaSostituzioni: string | null;
  /** Club e attività per le fasce del CSV che non cadono in un turno. */
  club?: Club;
  attivita?: Attivita;
}

export interface TurnoPiano {
  giorno_settimana: number;
  ora_inizio: string;
  ora_fine: string;
  club: Club;
  attivita: Attivita;
}

export interface EccezionePiano {
  data: string;
  ora_inizio: string;
  ora_fine: string;
  assente_id: string | null;
  sostituto_id: string | null;
  club: Club;
  attivita: Attivita;
  note: string | null;
}

export interface PianoImport {
  dal: string;
  al: string;
  orario: { dal: string; al: string } | null;
  periodi: { valido_dal: string; valido_al: string; turni: TurnoPiano[]; note: string }[];
  eccezioni: EccezionePiano[];
  giorni: { data: string; da_verificare: true; note: string | null }[];
  /** Righe del CSV fuori dal periodo, ignorate. */
  ignorate: number;
}

const NOTA_ASSENZA = 'Assenza dedotta dal CSV';

export function pianificaImport(righe: RigaCsv[], previsti: TurnoPrevisto[], o: OpzioniImport): PianoImport {
  const club = o.club ?? 'cingoli';
  const attivita = o.attivita ?? 'tennis';
  const dentro = righe.filter((r) => r.data >= o.dal && r.data <= o.al);
  const fino = o.orarioFino && o.orarioFino >= o.dal ? (o.orarioFino > o.al ? o.al : o.orarioFino) : null;
  const inCampo = (r: RigaCsv) => r.tipo === 'lavorato' || r.tipo === 'da_verificare';

  // 1. Orario ricostruito dal CSV fino a "fino": un periodo per settimana
  //    (le settimane consecutive identiche si uniscono), turni = fasce in campo.
  const periodi: PianoImport['periodi'] = [];
  if (fino) {
    for (let da = o.dal; da <= fino; ) {
      const domenica = addGiorni(da, 7 - isoDow(da));
      const a = domenica > fino ? fino : domenica;
      const turni = dentro
        .filter((r) => r.data >= da && r.data <= a && inCampo(r))
        .map((r) => ({ giorno_settimana: isoDow(r.data), ora_inizio: minutiToTime(r.inizio), ora_fine: minutiToTime(r.fine), club, attivita }))
        .sort((x, y) => x.giorno_settimana - y.giorno_settimana || x.ora_inizio.localeCompare(y.ora_inizio));
      const ultimo = periodi[periodi.length - 1];
      if (turni.length) {
        if (ultimo && ultimo.valido_al === addGiorni(da, -1) && JSON.stringify(ultimo.turni) === JSON.stringify(turni)) {
          ultimo.valido_al = a;
        } else {
          periodi.push({ valido_dal: da, valido_al: a, turni, note: 'Dal CSV' });
        }
      }
      da = addGiorni(a, 1);
    }
  }

  // 2. Eccezioni, giorno per giorno.
  const eccezioni: EccezionePiano[] = [];
  const giorni: PianoImport['giorni'] = [];
  const ecc = (data: string, inizio: number, fine: number, x: Omit<EccezionePiano, 'data' | 'ora_inizio' | 'ora_fine'>) =>
    eccezioni.push({ data, ora_inizio: minutiToTime(inizio), ora_fine: minutiToTime(fine), ...x });

  for (let data = o.dal; data <= o.al; data = addGiorni(data, 1)) {
    const delGiorno = dentro.filter((r) => r.data === data);
    const lavorate = delGiorno.map((r) => ({ inizio: r.inizio, fine: r.fine }));
    const ricostruito = fino !== null && data <= fino;
    const miei = ricostruito
      ? delGiorno.filter(inCampo).map((r) => ({ inizio: r.inizio, fine: r.fine, club, attivita }))
      : previsti.filter((p) => p.data === data && p.staff_id === o.staffId).map((p) => ({ ...fasciaDi(p), club: p.club, attivita: p.attivita }));

    // Assenze: parti dei miei turni senza nessuna fascia nel CSV.
    if (!ricostruito) {
      for (const t of miei) {
        for (const f of sottraiFasce([t], lavorate)) {
          ecc(data, f.inizio, f.fine, {
            assente_id: o.staffId,
            sostituto_id: o.sostitutoAssenze,
            club: t.club,
            attivita: t.attivita,
            note: NOTA_ASSENZA,
          });
        }
      }
    }

    // Fasce fuori dai miei turni: sostituzioni (del collega indicato o di chi
    // aveva il turno) oppure ore extra.
    for (const r of delGiorno) {
      for (const f of sottraiFasce([r], miei)) {
        let assente: string | null = null;
        if (r.tipo === 'sostituzione') {
          assente =
            o.collegaSostituzioni ??
            previsti.find((p) => p.data === data && p.staff_id !== o.staffId && fasciaDi(p).inizio <= f.inizio && fasciaDi(p).fine >= f.fine)
              ?.staff_id ??
            null;
        }
        const turnoCollega = assente ? previsti.find((p) => p.data === data && p.staff_id === assente) : undefined;
        ecc(data, f.inizio, f.fine, {
          assente_id: assente,
          sostituto_id: o.staffId,
          club: turnoCollega?.club ?? club,
          attivita: turnoCollega?.attivita ?? attivita,
          note: r.note || null,
        });
      }
    }

    const verifiche = delGiorno.filter((r) => r.tipo === 'da_verificare');
    if (verifiche.length) {
      giorni.push({ data, da_verificare: true, note: verifiche.map((r) => r.note).filter(Boolean).join(' · ') || null });
    }
  }

  return {
    dal: o.dal,
    al: o.al,
    orario: fino ? { dal: o.dal, al: fino } : null,
    periodi,
    eccezioni,
    giorni,
    ignorate: righe.length - dentro.length,
  };
}

// --- Export --------------------------------------------------------------------

function campo(v: string): string {
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Riepilogo giorno per giorno (e totale) nel formato del foglio di calcolo
 * italiano: separatore ";" e ore decimali con la virgola.
 */
export function csvRiepilogo(giorni: GiornoOre[], totale: RiepilogoOre | null): string {
  const intestazione = [
    'data', 'giorno', 'ore previste', 'ore lavorate', 'differenza', 'sostituito', 'sostituito da',
    'assente senza sostituto', 'sostituzioni ed extra fatte', 'per chi', 'da verificare', 'nota del giorno',
  ];
  const righe = giorni
    .filter((g) => g.minuti_previsti || g.minuti_lavorati || g.minuti_assenza || g.da_verificare || g.nota_giorno)
    .map((g) => [
      g.data,
      GIORNI[isoDow(g.data) - 1],
      fmtOreDecimali(g.minuti_previsti),
      fmtOreDecimali(g.minuti_lavorati),
      fmtOreDecimali(g.minuti_differenza),
      fmtOreDecimali(g.minuti_sostituito),
      [...new Set(g.sostituito_da.map((s) => s.sostituto).filter(Boolean))].join(', '),
      fmtOreDecimali(g.minuti_assente_senza_sostituto),
      fmtOreDecimali(g.minuti_sostituzioni),
      [...new Set(g.sostituzioni.map((s) => s.assente ?? 'extra'))].join(', '),
      g.da_verificare ? 'sì' : '',
      g.nota_giorno ?? '',
    ]);
  if (totale) {
    righe.push([
      'TOTALE', '',
      fmtOreDecimali(totale.minuti_previsti),
      fmtOreDecimali(totale.minuti_lavorati),
      fmtOreDecimali(totale.minuti_differenza),
      fmtOreDecimali(totale.minuti_sostituito),
      totale.sostituito_da.map((s) => `${s.sostituto} ${fmtOreDecimali(s.minuti)}`).join(', '),
      fmtOreDecimali(totale.minuti_assente_senza_sostituto),
      fmtOreDecimali(totale.minuti_sostituzioni),
      '',
      totale.giorni_da_verificare ? String(totale.giorni_da_verificare) : '',
      '',
    ]);
  }
  return '﻿' + [intestazione, ...righe].map((r) => r.map(campo).join(';')).join('\r\n') + '\r\n';
}
