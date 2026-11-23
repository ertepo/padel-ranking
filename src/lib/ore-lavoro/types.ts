// Tipi condivisi tra API e componenti delle ore di lavoro. Date "AAAA-MM-GG",
// orari "HH:MM" o "HH:MM:SS" come li restituisce Postgres.

export type Ruolo = 'maestro' | 'collaboratore';

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
}

export interface Eccezione {
  id: string;
  data: string;
  ora_inizio: string;
  ora_fine: string;
  assente_id: string | null;
  sostituto_id: string | null;
  note: string | null;
}

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
  previsti: TurnoPrevisto[];
  /** Eccezioni in cui il maestro è assente o sostituto. */
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
} as const;
