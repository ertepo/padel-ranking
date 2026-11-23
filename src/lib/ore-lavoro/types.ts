// Tipi condivisi tra API e componenti delle ore di lavoro. Date "AAAA-MM-GG",
// orari "HH:MM" o "HH:MM:SS" come li restituisce Postgres.

export type Ruolo = 'maestro' | 'collaboratore';
export type Club = 'cingoli' | 'poggio';
export type Attivita = 'tennis' | 'atletica';

export const CLUB: Record<Club, string> = { cingoli: 'Cingoli', poggio: 'Poggio' };
export const ATTIVITA: Record<Attivita, string> = { tennis: 'Tennis', atletica: 'Atletica' };

export interface Staff {
  id: string;
  nome: string;
  ruolo: Ruolo;
  colore: string;
  sono_io: boolean;
  attivo: boolean;
  note: string | null;
}

export interface TurnoPrevisto {
  data: string;
  ora_inizio: string;
  ora_fine: string;
  staff_id: string;
  club: Club;
  attivita: Attivita;
  /** Il turno dell'orario ricorrente da cui nasce. */
  slot_id: string;
}

export interface Eccezione {
  id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  assente_id: string | null;
  sostituto_id: string | null;
  club: Club;
  attivita: Attivita;
  note: string | null;
}

/** Un turno dell'orario ricorrente. giorno_settimana: 1=lunedì ... 7=domenica. */
export interface TurnoOrario {
  id: string;
  giorno_settimana: number;
  ora_inizio: string;
  ora_fine: string;
  club: Club;
  attivita: Attivita;
}

/** Un periodo di validità dell'orario di un maestro (valido_al null = in corso). */
export interface PeriodoOrario {
  id: string;
  valido_dal: string;
  valido_al: string | null;
  note: string | null;
  turni: TurnoOrario[];
}

export type OperazioneOrario =
  | { op: 'add'; giorno_settimana: number; ora_inizio: string; ora_fine: string; club: Club; attivita: Attivita }
  | { op: 'update'; slot_id: string; ora_inizio?: string; ora_fine?: string; club?: Club; attivita?: Attivita }
  | { op: 'delete'; slot_id: string };

export interface SostitutoMinuti {
  sostituto_id: string;
  sostituto: string;
  minuti: number;
}

export interface GiornoOre {
  data: string;
  minuti_previsti: number;
  minuti_lavorati: number;
  minuti_assenza: number;
  minuti_sostituito: number;
  minuti_assente_senza_sostituto: number;
  minuti_sostituzioni: number;
  minuti_differenza: number;
  da_verificare: boolean;
  nota_giorno: string | null;
}

export interface RiepilogoOre {
  periodo_inizio: string;
  minuti_previsti: number;
  minuti_lavorati: number;
  minuti_assenza: number;
  minuti_sostituito: number;
  minuti_assente_senza_sostituto: number;
  minuti_sostituzioni: number;
  minuti_differenza: number;
  giorni_da_verificare: number;
  sostituito_da: SostitutoMinuti[];
}

/** Tutto quello che serve per disegnare un periodo di un maestro. */
export interface DatiPeriodo {
  staff_id: string;
  dal: string;
  al: string;
  /** Filtro per club (null = tutti). */
  club: Club | null;
  /** Turni previsti di tutti i maestri (per mostrare anche i colleghi). */
  previsti: TurnoPrevisto[];
  /** Tutte le eccezioni del periodo (anche tra colleghi). */
  eccezioni: Eccezione[];
  giorni: GiornoOre[];
  /** Totali per settimana o per mese, calcolati in SQL (work_hours_summary). */
  riepiloghi: RiepilogoOre[];
}

export const COLORI = {
  lavorato: '#86efac',
  extra: '#f0abfc',
  assente: '#fde047',
  verifica: '#7dd3fc',
  collega: '#e2e8f0',
} as const;
