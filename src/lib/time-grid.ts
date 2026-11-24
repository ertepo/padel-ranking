// Utility condivise per i calendari a griglia (scuola tennis, ore di lavoro):
// orari come minuti dalla mezzanotte e date come stringhe ISO "AAAA-MM-GG"
// nel fuso Europe/Rome. Le date si manipolano a mezzogiorno UTC, così i
// cambi d'ora legale non spostano mai il giorno.

export const FUSO = 'Europe/Rome';

export const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- Orari -------------------------------------------------------------------

/** 990 -> "16:30". Accetta anche 1440 ("24:00"). */
export function minutiToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "16:30" o "16:30:00" -> 990. Restituisce NaN se il formato non è valido. */
export function timeToMinuti(value: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return NaN;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return NaN;
  return h * 60 + m;
}

export function snapToSlot(min: number, slotMin = 30): number {
  return Math.round(min / slotMin) * slotMin;
}

/** (990, 1110) -> "16:30–18:30" */
export function fmtFascia(inizio: number, fine: number): string {
  return `${minutiToTime(inizio)}–${minutiToTime(fine)}`;
}

/** 330 -> "5h30", 120 -> "2h", 45 -> "0h45", -90 -> "−1h30" (con segno se richiesto). */
export function fmtDurata(minuti: number, conSegno = false): string {
  const segno = minuti < 0 ? '−' : conSegno && minuti > 0 ? '+' : '';
  const abs = Math.abs(Math.round(minuti));
  const ore = Math.floor(abs / 60);
  const min = abs % 60;
  return `${segno}${ore}h${min ? String(min).padStart(2, '0') : ''}`;
}

/** Ore decimali con la virgola, per CSV ed export: 330 -> "5,5". */
export function fmtOreDecimali(minuti: number): string {
  return (Math.round((minuti / 60) * 100) / 100).toString().replace('.', ',');
}

// --- Date (ISO "AAAA-MM-GG", fuso Europe/Rome) --------------------------------

function toUtcNoon(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtcNoon(value)) === value;
}

/** La data di oggi a Roma. */
export function oggiRoma(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addGiorni(iso: string, giorni: number): string {
  const d = toUtcNoon(iso);
  d.setUTCDate(d.getUTCDate() + giorni);
  return fromUtc(d);
}

/** 1 = lunedì ... 7 = domenica. */
export function isoDow(iso: string): number {
  const dow = toUtcNoon(iso).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function lunediDi(iso: string): string {
  return addGiorni(iso, 1 - isoDow(iso));
}

/** I 7 giorni (lun–dom) della settimana che contiene iso. */
export function giorniSettimana(iso: string): string[] {
  const lun = lunediDi(iso);
  return Array.from({ length: 7 }, (_, i) => addGiorni(lun, i));
}

export function primoDelMese(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function ultimoDelMese(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return fromUtc(new Date(Date.UTC(y, m, 0, 12)));
}

export function addMesi(iso: string, mesi: number): string {
  const [y, m] = iso.split('-').map(Number);
  return fromUtc(new Date(Date.UTC(y, m - 1 + mesi, 1, 12)));
}

/** "23/11" */
export function fmtGiornoMese(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "23/11/2026" */
export function fmtData(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** "novembre 2026" */
export function fmtMese(iso: string): string {
  return `${MESI[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** "23–29 novembre 2026", "30 novembre – 6 dicembre 2026", "28 dicembre 2026 – 3 gennaio 2027" */
/** Settimana senza anno, per spazi stretti: "23–29 novembre", "28 set – 4 ott". */
export function fmtSettimanaBreve(iso: string): string {
  const giorni = giorniSettimana(iso);
  const [a, b] = [giorni[0], giorni[6]];
  const g = (x: string) => Number(x.slice(8, 10));
  const mese = (x: string) => MESI[Number(x.slice(5, 7)) - 1];
  if (mese(a) === mese(b)) return `${g(a)}–${g(b)} ${mese(b)}`;
  return `${g(a)} ${mese(a).slice(0, 3)} – ${g(b)} ${mese(b).slice(0, 3)}`;
}

export function fmtSettimana(iso: string): string {
  const giorni = giorniSettimana(iso);
  const [a, b] = [giorni[0], giorni[6]];
  const g = (x: string) => Number(x.slice(8, 10));
  const mese = (x: string) => MESI[Number(x.slice(5, 7)) - 1];
  const anno = (x: string) => x.slice(0, 4);
  if (anno(a) !== anno(b)) return `${g(a)} ${mese(a)} ${anno(a)} – ${g(b)} ${mese(b)} ${anno(b)}`;
  if (mese(a) !== mese(b)) return `${g(a)} ${mese(a)} – ${g(b)} ${mese(b)} ${anno(b)}`;
  return `${g(a)}–${g(b)} ${mese(b)} ${anno(b)}`;
}

// --- Griglia -------------------------------------------------------------------

export interface Fascia {
  inizio: number;
  fine: number;
}

/**
 * La fascia oraria da mostrare: dalla prima all'ultima ora occupata
 * (arrotondate alle ore piene), allargata almeno a [minInizio, minFine] se
 * dati, e sempre dentro [limiteInizio, limiteFine].
 */
export function fasciaVisibile(
  fasce: Fascia[],
  limiteInizio: number,
  limiteFine: number,
  minimo?: Partial<Fascia>,
): Fascia {
  let inizio = minimo?.inizio ?? Infinity;
  let fine = minimo?.fine ?? -Infinity;
  for (const f of fasce) {
    inizio = Math.min(inizio, f.inizio);
    fine = Math.max(fine, f.fine);
  }
  if (!Number.isFinite(inizio) || !Number.isFinite(fine)) return { inizio: limiteInizio, fine: limiteFine };
  const a = clamp(Math.floor(inizio / 60) * 60, limiteInizio, limiteFine - 60);
  const b = clamp(Math.ceil(fine / 60) * 60, a + 60, limiteFine);
  return { inizio: a, fine: b };
}

/**
 * Distribuisce in corsie affiancate i blocchi che si sovrappongono nella
 * stessa colonna: restituisce per ogni blocco l'indice di corsia e il numero
 * di corsie del suo gruppo di sovrapposizioni.
 */
export function assegnaCorsie<T extends Fascia & { colonna: number }>(
  blocchi: T[],
): Map<T, { corsia: number; corsie: number }> {
  const out = new Map<T, { corsia: number; corsie: number }>();
  const perColonna = new Map<number, T[]>();
  for (const b of blocchi) {
    const lista = perColonna.get(b.colonna) ?? [];
    lista.push(b);
    perColonna.set(b.colonna, lista);
  }
  for (const lista of perColonna.values()) {
    lista.sort((x, y) => x.inizio - y.inizio || y.fine - x.fine);
    let gruppo: T[] = [];
    let fineGruppo = -Infinity;
    const chiudi = () => {
      const fineCorsie: number[] = [];
      const corsiaDi = new Map<T, number>();
      for (const b of gruppo) {
        let c = fineCorsie.findIndex((f) => f <= b.inizio);
        if (c === -1) {
          c = fineCorsie.length;
          fineCorsie.push(b.fine);
        } else {
          fineCorsie[c] = b.fine;
        }
        corsiaDi.set(b, c);
      }
      for (const b of gruppo) out.set(b, { corsia: corsiaDi.get(b)!, corsie: fineCorsie.length });
    };
    for (const b of lista) {
      if (gruppo.length && b.inizio >= fineGruppo) {
        chiudi();
        gruppo = [];
        fineGruppo = -Infinity;
      }
      gruppo.push(b);
      fineGruppo = Math.max(fineGruppo, b.fine);
    }
    if (gruppo.length) chiudi();
  }
  return out;
}
