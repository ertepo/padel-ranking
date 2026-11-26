<script lang="ts">
  // Ore di lavoro: settimana di un maestro (turni previsti, assenze,
  // sostituzioni, colleghi in trasparenza) e totali della settimana. I minuti
  // vengono dalle funzioni SQL; qui si disegna e si raccolgono le eccezioni.
  import WeekGrid, { type BloccoGriglia } from '../shared/WeekGrid.svelte';
  import StaffPanel from './StaffPanel.svelte';
  import OrarioPanel from './OrarioPanel.svelte';
  import MonthGrid from './MonthGrid.svelte';
  import Riepilogo from './Riepilogo.svelte';
  import ImportPanel from './ImportPanel.svelte';
  import WeekAgenda from './WeekAgenda.svelte';
  import EccezioneModal, { type ProspettoEccezione } from './EccezioneModal.svelte';
  import ImpegnoModal, { type ProspettoImpegno } from './ImpegnoModal.svelte';
  import {
    GIORNI_BREVI, addGiorni, addMesi, fmtData, fmtDurata, fmtFascia, fmtGiornoMese, fmtMese, fmtSettimana, fmtSettimanaBreve, giorniSettimana, lunediDi,
    minutiToTime, oggiRoma, primoDelMese, timeToMinuti, ultimoDelMese,
  } from '../../lib/time-grid';
  import { affiancatoDi, segmentiPeriodo, type Segmento } from '../../lib/ore-lavoro/segmenti';
  import { riassuntoGiorno, type RiassuntoGiorno } from '../../lib/ore-lavoro/mese';
  import {
    ATTIVITA, CLUB, COLORI, COLORI_IMPEGNO, coloreDi, type Club, type DatiPeriodo, type Eccezione, type Impegno, type Staff,
  } from '../../lib/ore-lavoro/types';

  interface Props {
    staffIniziale: Staff[];
    staffSelezionatoIniziale: string | null;
    settimanaIniziale: string;
    clubIniziale?: Club | null;
    vistaIniziale?: 'settimana' | 'mese';
    datiIniziali: DatiPeriodo | null;
    erroreIniziale?: string;
    /** Schermo da parete: solo la griglia della settimana, senza pannelli. */
    kiosk?: boolean;
  }

  let {
    staffIniziale,
    staffSelezionatoIniziale,
    settimanaIniziale,
    clubIniziale = null,
    vistaIniziale = 'settimana',
    datiIniziali,
    erroreIniziale = '',
    kiosk = false,
  }: Props = $props();

  let staff = $state(staffIniziale);
  let staffId = $state(staffSelezionatoIniziale);
  let lunedi = $state(lunediDi(settimanaIniziale));
  let vista: 'settimana' | 'mese' = $state(vistaIniziale);
  let mese = $state(primoDelMese(settimanaIniziale));
  let club: Club | null = $state(clubIniziale);
  let conColleghi = $state(true);
  /** Turni della persona affiancata (es. il partner), anche senza tutti i colleghi. */
  let conAffiancato = $state(true);
  let dati: DatiPeriodo | null = $state(datiIniziali);
  let caricamento = $state(false);
  let errore = $state(erroreIniziale);
  let erroreTimer: ReturnType<typeof setTimeout> | undefined;
  let prospetto: ProspettoEccezione | null = $state(null);
  let impegno: ProspettoImpegno | null = $state(null);
  // Su telefono la settimana si può vedere come agenda o come griglia: la
  // scelta resta nel browser (solo una comodità, se manca si parte dall'agenda).
  const CHIAVE_VISTA_MOBILE = 'ore-lavoro:vista-mobile';
  let vistaMobile: 'agenda' | 'griglia' = $state('agenda');
  let stretto = $state(false);

  // Le caselle "colleghi" e della persona affiancata restano come le si è lasciate (in questo browser).
  const CHIAVE_COLLEGHI = 'ore-lavoro:colleghi';
  const CHIAVE_AFFIANCATO = 'ore-lavoro:affiancato';
  let preferenzeLette = $state(false);

  $effect(() => {
    try {
      if (localStorage.getItem(CHIAVE_VISTA_MOBILE) === 'griglia') vistaMobile = 'griglia';
      if (localStorage.getItem(CHIAVE_COLLEGHI) === '0') conColleghi = false;
      if (localStorage.getItem(CHIAVE_AFFIANCATO) === '0') conAffiancato = false;
    } catch {
      /* archiviazione non disponibile */
    }
    preferenzeLette = true;
    const mq = window.matchMedia('(max-width: 767px)');
    const aggiorna = () => (stretto = mq.matches);
    aggiorna();
    mq.addEventListener('change', aggiorna);
    return () => mq.removeEventListener('change', aggiorna);
  });

  $effect(() => {
    const valori = [conColleghi, conAffiancato];
    if (!preferenzeLette) return;
    try {
      localStorage.setItem(CHIAVE_COLLEGHI, valori[0] ? '1' : '0');
      localStorage.setItem(CHIAVE_AFFIANCATO, valori[1] ? '1' : '0');
    } catch {
      /* archiviazione non disponibile */
    }
  });

  function scegliVistaMobile(v: 'agenda' | 'griglia') {
    vistaMobile = v;
    try {
      localStorage.setItem(CHIAVE_VISTA_MOBILE, v);
    } catch {
      /* archiviazione non disponibile */
    }
  }

  // --- Kiosk: schermo intero, schermo sempre acceso, aggiornamento automatico ---

  let schermoIntero = $state(false);
  /** Aperta dall'icona della schermata Home come app a schermo intero: il pulsante non serve. */
  let comeApp = $state(false);
  /** Uscito dallo schermo intero col pulsante: il tocco successivo non ci rientra. */
  let uscitaVoluta = false;

  function entraSchermoIntero() {
    return document.documentElement.requestFullscreen?.() ?? Promise.reject();
  }

  function alternaSchermoIntero() {
    if (document.fullscreenElement) {
      uscitaVoluta = true;
      document.exitFullscreen?.().catch(() => {});
    } else {
      uscitaVoluta = false;
      entraSchermoIntero().catch(() => flashErrore('Schermo intero non disponibile.'));
    }
  }

  $effect(() => {
    if (!kiosk) return;
    const aggiornaSchermo = () => {
      comeApp = matchMedia('(display-mode: fullscreen)').matches;
      schermoIntero = Boolean(document.fullscreenElement) || comeApp;
    };
    aggiornaSchermo();
    document.addEventListener('fullscreenchange', aggiornaSchermo);

    // Il browser non lascia entrare nello schermo intero senza un gesto: lo si
    // fa al primo tocco sulla pagina (e di nuovo se si è usciti senza volerlo,
    // per esempio dopo lo spegnimento dello schermo).
    const alTocco = (ev: Event) => {
      if (comeApp || document.fullscreenElement || uscitaVoluta) return;
      if ((ev.target as Element | null)?.closest?.('[data-schermo-intero]')) return;
      entraSchermoIntero().catch(() => {});
    };
    document.addEventListener('pointerup', alTocco, true);

    // Lo schermo resta acceso finché la pagina è visibile (dove il browser lo permette).
    let wakeLock: { release: () => Promise<void> } | null = null;
    const tieniAcceso = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        wakeLock = await (navigator as any).wakeLock?.request('screen');
      } catch {
        /* non disponibile */
      }
    };
    tieniAcceso();

    // Ogni 5 minuti ricarica i dati; a cambio giorno torna alla settimana di oggi.
    let giorno = oggiRoma();
    const controlla = () => {
      const adesso = oggiRoma();
      if (adesso !== giorno) {
        giorno = adesso;
        window.location.reload();
      } else if (!prospetto && !impegno) carica(true);
    };
    const timer = setInterval(controlla, 5 * 60 * 1000);
    const alRitorno = () => {
      if (document.visibilityState !== 'visible') return;
      tieniAcceso();
      controlla();
    };
    document.addEventListener('visibilitychange', alRitorno);

    return () => {
      document.removeEventListener('fullscreenchange', aggiornaSchermo);
      document.removeEventListener('pointerup', alTocco, true);
      document.removeEventListener('visibilitychange', alRitorno);
      clearInterval(timer);
      wakeLock?.release().catch(() => {});
    };
  });

  /** Cresce a ogni salvataggio, per far ricaricare il riquadro dell'orario. */
  let versione = $state(0);

  function aggiorna() {
    versione++;
    carica();
  }

  const oggi = oggiRoma();
  const giorni = $derived(giorniSettimana(lunedi));
  const nomeDi = $derived(new Map(staff.map((s) => [s.id, s.nome])));
  const selezionato = $derived(staff.find((s) => s.id === staffId) ?? null);
  const affiancato = $derived(affiancatoDi(staff, staffId));
  /** Chi si guarda lavora al tennis (se no ha solo impegni personali). */
  const tennista = $derived(selezionato?.tennis !== false);
  /** A chi può appartenere un impegno creato da qui. */
  const personeImpegno = $derived([selezionato, affiancato].filter((x): x is Staff => Boolean(x)));
  // Quali colleghi mostrare: tutti, nessuno o solo la persona affiancata.
  const filtroColleghi = $derived.by((): boolean | ((id: string) => boolean) => {
    if (conColleghi) return true;
    const a = conAffiancato ? affiancato : null;
    return a ? (id: string) => id === a.id : false;
  });
  // Dati validi solo se sono proprio della settimana, del maestro e del club
  // mostrati (durante un caricamento o dopo un errore non si mostrano quelli vecchi).
  const periodo = $derived(
    vista === 'mese' ? { dal: mese, al: ultimoDelMese(mese) } : { dal: lunedi, al: addGiorni(lunedi, 6) },
  );
  const correnti = $derived(
    dati && dati.staff_id === staffId && dati.dal === periodo.dal && dati.al === periodo.al && dati.club === club ? dati : null,
  );
  const giornoOre = $derived(new Map((correnti?.giorni ?? []).map((g) => [g.data, g])));
  const totale = $derived(correnti?.riepiloghi[0] ?? null);
  /** Ore private del periodo mostrato (non contano: le paga il cliente). */
  const minutiPrivate = $derived(
    (correnti?.eccezioni ?? [])
      .filter((e) => e.privata && e.sostituto_id === staffId)
      .reduce((t, e) => t + timeToMinuti(e.ora_fine) - timeToMinuti(e.ora_inizio), 0),
  );

  // --- Pagamenti del datore di lavoro ------------------------------------------

  let dataPagamento = $state(oggiRoma());

  // Compenso orario (fisse ed extra): resta salvato in questo browser, di base 12 €.
  const CHIAVE_TARIFFA = 'ore-lavoro:tariffa';
  let tariffa = $state(12);

  $effect(() => {
    try {
      const t = Number(localStorage.getItem(CHIAVE_TARIFFA));
      if (t > 0) tariffa = t;
    } catch {
      /* archiviazione non disponibile */
    }
  });

  function salvaTariffa() {
    try {
      if (tariffa > 0) localStorage.setItem(CHIAVE_TARIFFA, String(tariffa));
    } catch {
      /* archiviazione non disponibile */
    }
  }

  const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  let salvandoPagamento = $state(false);

  async function chiamaPagamenti(method: 'POST' | 'DELETE', body: Record<string, unknown>) {
    salvandoPagamento = true;
    try {
      const res = await fetch('/api/ore-lavoro/pagamenti', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio.');
      carica();
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
    } finally {
      salvandoPagamento = false;
    }
  }

  function segnaPagamento() {
    if (!staffId || !dataPagamento) return;
    if (!confirm(`Segnare il pagamento ricevuto il ${fmtData(dataPagamento)}? Le ore da farsi pagare ripartono da quel giorno.`)) return;
    chiamaPagamenti('POST', { staff_id: staffId, data: dataPagamento });
  }

  function togliPagamento(id: string, data: string) {
    if (!confirm(`Togliere il pagamento del ${fmtData(data)}?`)) return;
    chiamaPagamenti('DELETE', { id });
  }

  function flashErrore(msg: string) {
    errore = msg;
    clearTimeout(erroreTimer);
    erroreTimer = setTimeout(() => (errore = ''), 6000);
  }

  // --- Caricamento -----------------------------------------------------------

  let richiesta = 0;

  async function carica(silenzioso = false) {
    if (!staffId) return;
    const id = ++richiesta;
    const params = new URLSearchParams({ staff: staffId, dal: periodo.dal, al: periodo.al });
    if (vista === 'mese') params.set('raggruppa', 'month');
    if (club) params.set('club', club);
    caricamento = true;
    try {
      const res = await fetch(`/api/ore-lavoro/periodo?${params}`);
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore nel caricamento.');
      if (id === richiesta) dati = result as DatiPeriodo;
    } catch (err) {
      if (id === richiesta && !silenzioso) flashErrore(err instanceof Error ? err.message : 'Errore nel caricamento.');
    } finally {
      if (id === richiesta) caricamento = false;
    }
  }

  $effect(() => {
    // Ricarica quando cambiano maestro, periodo o club (non al primo giro,
    // se il server ha già fornito quei dati) e aggiorna l'URL.
    const chiave = `${staffId}|${periodo.dal}|${periodo.al}|${club}`;
    if (!(dati && `${dati.staff_id}|${dati.dal}|${dati.al}|${dati.club}` === chiave)) carica();
    const url = new URL(window.location.href);
    url.searchParams.set('settimana', vista === 'mese' ? mese : lunedi);
    if (vista === 'mese') url.searchParams.set('vista', 'mese');
    else url.searchParams.delete('vista');
    if (staffId) url.searchParams.set('staff', staffId);
    if (club) url.searchParams.set('club', club);
    else url.searchParams.delete('club');
    history.replaceState(null, '', url);
  });

  // Pranzo e cena: sfondo un po' più scuro nella settimana.
  // Da lunedì a venerdì i giorni si vedono sempre; sabato e domenica solo se hanno ore.
  const FERIALI = [0, 1, 2, 3, 4];
  const FASCE_PASTI = [{ inizio: 14 * 60, fine: 15 * 60 }, { inizio: 20 * 60, fine: 21 * 60 }];

  // --- Blocchi ----------------------------------------------------------------

  type Blocco = BloccoGriglia & { segmento: Segmento; sottotitolo?: string };

  function etichettaAttivita(s: Segmento) {
    const a = ATTIVITA[s.attivita];
    return !club && s.club !== 'cingoli' ? `${a} · ${CLUB[s.club]}` : a;
  }

  const blocchi: Blocco[] = $derived.by(() => {
    // Anche nella vista mese: lì servono per le miniature dei giorni.
    if (!correnti || !staffId) return [];
    return segmentiPeriodo(staffId, correnti.previsti, correnti.eccezioni, filtroColleghi, correnti.impegni ?? []).map((s) => {
      const e = s.eccezione;
      const daVerificare = giornoOre.get(s.data)?.da_verificare ?? false;
      let titolo = etichettaAttivita(s);
      let colore: string = COLORI.lavorato;
      let classe = '';
      // La persona affiancata si vede come i propri blocchi (non tratteggiata), nel suo colore fisso.
      const diAffiancato = s.staff_id === affiancato?.id;
      if (s.impegno) {
        const imp = s.impegno;
        const chi = nomeDi.get(s.staff_id) ?? '?';
        titolo = s.tipo === 'impegno' ? imp.titolo : `${chi} · ${imp.titolo}`;
        colore = s.tipo === 'impegno' ? COLORI_IMPEGNO[imp.colore] : coloreDi(staff.find((x) => x.id === s.staff_id));
        if (s.tipo === 'impegno-altrui' && !diAffiancato) classe = 'wg-block-tratteggiato';
        return {
          id: s.id, colonna: giorni.indexOf(s.data), inizio: s.inizio, fine: s.fine, colore, classe, titolo,
          sottotitolo: imp.note ?? undefined, segmento: s,
        };
      }
      if (s.tipo === 'lavorato' && daVerificare) {
        titolo = `${titolo} · da verificare`;
        colore = COLORI.verifica;
      } else if (s.tipo === 'assente') {
        titolo = e?.sostituto_id ? `Sostituito da ${nomeDi.get(e.sostituto_id) ?? '?'}` : 'Assente';
        colore = COLORI.assente;
      } else if (s.tipo === 'extra') {
        titolo = e?.privata ? 'Ora privata' : e?.assente_id ? `Sostituisco ${nomeDi.get(e.assente_id) ?? '?'}` : 'Ore extra';
        colore = e?.privata ? COLORI.privata : COLORI.extra;
      } else if (s.tipo === 'collega') {
        titolo = `${nomeDi.get(s.staff_id) ?? '?'} · ${etichettaAttivita(s)}`;
        colore = diAffiancato ? coloreDi(affiancato) : COLORI.collega;
        classe = diAffiancato ? '' : 'wg-block-tratteggiato';
      } else if (s.tipo === 'collega-assente') {
        const chi = nomeDi.get(s.staff_id) ?? '?';
        titolo = e?.sostituto_id ? `${chi} → ${nomeDi.get(e.sostituto_id) ?? '?'}` : `${chi} assente, scoperto`;
        colore = '#fef9c3';
        classe = 'wg-block-tratteggiato';
      }
      return {
        id: s.id,
        colonna: giorni.indexOf(s.data),
        inizio: s.inizio,
        fine: s.fine,
        colore,
        classe,
        titolo,
        sottotitolo: e?.note ?? undefined,
        segmento: s,
      };
    });
  });

  // Vista mese: bollini delle ore e note di ogni giorno.
  const riassuntiMese = $derived.by(() => {
    const out = new Map<string, RiassuntoGiorno>();
    if (vista !== 'mese' || !correnti || !staffId) return out;
    const perData = new Map<string, Segmento[]>();
    for (const b of blocchi) {
      const lista = perData.get(b.segmento.data) ?? [];
      lista.push(b.segmento);
      perData.set(b.segmento.data, lista);
    }
    const nome = (id: string | null | undefined) => (id ? (nomeDi.get(id) ?? '?') : '?');
    for (const [data, segmenti] of perData) {
      const previstiGiorno = correnti.previsti.filter((p) => p.data === data);
      out.set(data, riassuntoGiorno(staffId, segmenti, previstiGiorno, nome, giornoOre.get(data)?.da_verificare ?? false));
    }
    return out;
  });

  const colonne = $derived(
    giorni.map((g, i) => {
      const ore = giornoOre.get(g);
      const lavorate = tennista && ore && (ore.minuti_previsti || ore.minuti_lavorati) ? ` · ${fmtDurata(ore.minuti_lavorati)}` : '';
      const verifica = ore?.da_verificare ? ' · ?' : '';
      return { key: g, label: GIORNI_BREVI[i], sublabel: `${fmtGiornoMese(g)}${lavorate}${verifica}`, evidenziata: g === oggi };
    }),
  );

  const attivi = $derived(staff.filter((s) => s.attivo || s.id === staffId));

  // --- Eccezioni: dalla griglia al modale ---------------------------------------

  function daEccezione(e: Eccezione): ProspettoEccezione {
    const [hi, mi] = e.ora_inizio.split(':').map(Number);
    const [hf, mf] = e.ora_fine.split(':').map(Number);
    return {
      id: e.id,
      data: e.data,
      inizio: hi * 60 + mi,
      fine: hf * 60 + mf,
      assente_id: e.assente_id,
      sostituto_id: e.sostituto_id,
      club: e.club,
      attivita: e.attivita,
      note: e.note,
      privata: e.privata,
      gruppo_id: e.gruppo_id ?? null,
    };
  }

  /** Proposta per un turno (mio o di un collega) e una fascia scelta dentro o attorno. */
  function daTurno(s: Segmento, inizio: number, fine: number, turnoNuovo?: { inizio: number; fine: number }): ProspettoEccezione {
    const mio = s.tipo === 'lavorato';
    const turno = s.turno ?? s;
    return {
      data: s.data,
      inizio,
      fine,
      assente_id: s.staff_id,
      sostituto_id: mio ? null : staffId,
      club: s.club,
      attivita: s.attivita,
      note: null,
      turno: s.turno ? { ...s.turno, staff_id: s.staff_id } : undefined,
      daTurno: mio,
      ricorrente: s.slot_id
        ? {
            staff_id: s.staff_id,
            slot_id: s.slot_id,
            ...(turnoNuovo ?? turno),
            club: s.club,
            attivita: s.attivita,
            attuale: { inizio: turno.inizio, fine: turno.fine },
            // Una fascia scelta dentro il turno (non tutto il turno) va tolta dall'orario.
            togliere: !turnoNuovo && (inizio !== turno.inizio || fine !== turno.fine) ? { inizio, fine } : undefined,
          }
        : undefined,
    };
  }

  function nuovaExtra(data: string, inizio: number, fine: number): ProspettoEccezione {
    const c = club ?? 'cingoli';
    return {
      data,
      inizio,
      fine,
      assente_id: null,
      sostituto_id: staffId,
      club: c,
      attivita: 'tennis',
      note: null,
      ricorrente: staffId ? { staff_id: staffId, inizio, fine, club: c, attivita: 'tennis' } : undefined,
    };
  }

  // --- Impegni personali ---------------------------------------------------------

  function nuovoImpegno(data: string, inizio: number, fine: number): ProspettoImpegno | null {
    if (!staffId) return null;
    return { staff_id: staffId, data, inizio, fine, titolo: '', colore: 'azzurro', note: null };
  }

  function daImpegno(i: Impegno): ProspettoImpegno {
    const [hi, mi] = i.ora_inizio.split(':').map(Number);
    const [hf, mf] = i.ora_fine.split(':').map(Number);
    return {
      id: i.id, staff_id: i.staff_id, data: i.data, inizio: hi * 60 + mi, fine: hf * 60 + mf,
      titolo: i.titolo, colore: i.colore, note: i.note, gruppo_id: i.gruppo_id,
    };
  }

  /** Spazio libero (o blocco della persona affiancata): nuovo impegno, con la scheda Tennis per chi ci lavora. */
  function apriVuoto(data: string, inizio: number, fine: number) {
    impegno = nuovoImpegno(data, inizio, fine);
  }

  /** Blocchi su cui toccare vale come spazio libero: quelli della persona affiancata, o tutto il tennis per chi non ci lavora. */
  function comeVuoto(b: Blocco) {
    const s = b.segmento;
    if (s.tipo === 'impegno-altrui' || s.tipo === 'impegno') return false;
    return !tennista || s.staff_id === affiancato?.id;
  }

  function apriDaBlocco(b: Blocco, inizio = b.inizio, fine = b.fine) {
    const s = b.segmento;
    if (s.impegno) impegno = daImpegno(s.impegno);
    else if (comeVuoto(b)) apriVuoto(s.data, inizio, fine);
    else if (s.eccezione) prospetto = daEccezione(s.eccezione);
    else prospetto = daTurno(s, inizio, fine);
  }

  function onSelezione(colonna: number, inizio: number, fine: number, b: Blocco | null) {
    // Trascinando sopra un impegno se ne crea uno nuovo in quella fascia.
    if (b && !b.segmento.impegno && !comeVuoto(b)) apriDaBlocco(b, inizio, fine);
    else apriVuoto(giorni[colonna], inizio, fine);
  }

  async function onResize(b: Blocco, inizio: number, fine: number) {
    const s = b.segmento;
    if (s.impegno) {
      // Impegni: si salvano subito i nuovi orari.
      const i = s.impegno;
      try {
        const res = await fetch('/api/ore-lavoro/impegni', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...i, ora_inizio: minutiToTime(inizio), ora_fine: minutiToTime(fine) }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio.');
      } catch (err) {
        flashErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
      }
      carica();
      return;
    }
    if (s.eccezione) {
      // Assenze e sostituzioni: si salvano subito i nuovi orari.
      const e = s.eccezione;
      try {
        const res = await fetch('/api/ore-lavoro/eccezioni', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...e, ora_inizio: minutiToTime(inizio), ora_fine: minutiToTime(fine) }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio.');
      } catch (err) {
        flashErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
      }
      carica();
      return;
    }
    // Turno previsto: per "solo questo giorno" la parte tolta diventa un'assenza
    // e quella aggiunta ore extra; per "da qui in poi" il turno prende i nuovi orari.
    const turno = s.turno ?? s;
    const turnoNuovo = {
      inizio: b.inizio === turno.inizio ? inizio : turno.inizio,
      fine: b.fine === turno.fine ? fine : turno.fine,
    };
    const ricorrente = s.slot_id
      ? {
          staff_id: s.staff_id,
          slot_id: s.slot_id,
          ...turnoNuovo,
          club: s.club,
          attivita: s.attivita,
          attuale: { inizio: turno.inizio, fine: turno.fine },
        }
      : undefined;
    if (inizio > b.inizio) prospetto = daTurno(s, b.inizio, inizio, turnoNuovo);
    else if (fine < b.fine) prospetto = daTurno(s, fine, b.fine, turnoNuovo);
    else if (inizio < b.inizio) prospetto = { ...nuovaExtra(s.data, inizio, b.inizio), club: s.club, attivita: s.attivita, ricorrente };
    else if (fine > b.fine) prospetto = { ...nuovaExtra(s.data, b.fine, fine), club: s.club, attivita: s.attivita, ricorrente };
  }

  const linkExport = $derived.by(() => {
    if (!staffId) return '';
    const params = new URLSearchParams({ staff: staffId, dal: periodo.dal, al: periodo.al });
    if (club) params.set('club', club);
    return `/api/ore-lavoro/export?${params}`;
  });

  const ridimensionabile = (b: Blocco) =>
    ['impegno', 'impegno-altrui'].includes(b.segmento.tipo) || (tennista && ['lavorato', 'assente', 'extra'].includes(b.segmento.tipo));

  // --- Navigazione -----------------------------------------------------------

  function sposta(passi: number) {
    if (vista === 'mese') mese = addMesi(mese, passi);
    else lunedi = addGiorni(lunedi, 7 * passi);
  }

  function vaiAOggi() {
    lunedi = lunediDi(oggiRoma());
    mese = primoDelMese(oggiRoma());
  }

  function mostra(v: 'settimana' | 'mese') {
    // Passando da una vista all'altra si resta sullo stesso periodo: la
    // settimana mostrata resta quella se cade nel mese, se no la prima del mese.
    if (v === 'mese') mese = primoDelMese(lunedi);
    else if (vista === 'mese' && primoDelMese(lunedi) !== mese && primoDelMese(addGiorni(lunedi, 6)) !== mese) {
      lunedi = lunediDi(mese);
    }
    vista = v;
  }

  /** Agenda (smartphone): "+" su un giorno propone un'ora dopo l'ultimo turno, o dalle 16. */
  function aggiungiNelGiorno(colonna: number) {
    const miei = blocchi.filter((b) => b.colonna === colonna && !b.segmento.tipo.startsWith('collega'));
    const inizio = miei.length ? Math.min(Math.max(...miei.map((b) => b.fine)), 23 * 60) : 16 * 60;
    apriVuoto(giorni[colonna], inizio, inizio + 60);
  }

  /** Etichetta di una settimana dentro il mese: "1–6/9", "28/9–4/10" tagliata al mese. */
  function etichettaSettimana(inizio: string) {
    const a = inizio < periodo.dal ? periodo.dal : inizio;
    const fine = addGiorni(inizio, 6);
    const b = fine > periodo.al ? periodo.al : fine;
    return `${fmtGiornoMese(a)}–${fmtGiornoMese(b)}`;
  }
</script>

{#if errore}
  <div class="fixed inset-x-4 top-20 z-[9999] border-2 border-black bg-white p-3 font-black text-red-700 shadow-[-4px_4px_0_black] sm:left-auto sm:right-4 sm:top-24 sm:max-w-sm" role="alert" onclick={() => (errore = '')}>
    {errore}
  </div>
{/if}

{#if staff.length === 0}
  <section class="club-card bg-white p-5">
    <h2 class="text-2xl font-black">Nessun maestro</h2>
    <p class="mt-2 font-medium text-slate-700">
      Applica le migrazioni <code>20261123_ore_lavoro.sql</code> e <code>20261123_ore_lavoro_seed.sql</code> su Supabase.
    </p>
  </section>
{:else}
  <div class={kiosk ? '' : 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'}>
    <section class={kiosk ? 'bg-white' : 'ol-cal club-card bg-white px-2 py-3 sm:p-5'}>
      <div class="mb-3 flex flex-wrap items-center gap-2 px-1 sm:mb-4 sm:gap-3 sm:px-0" class:ol-kiosk-barra={kiosk}>
        {#if kiosk}
          <a href="/admin/ore-lavoro" class="club-btn px-3 py-2 text-sm" title="Pagina completa delle ore di lavoro">← Ore</a>
        {/if}
        <div class="flex border-2 border-black text-xs font-black uppercase" class:hidden={kiosk}>
          <button type="button" class="px-3 py-2" class:bg-black={vista === 'settimana'} class:text-white={vista === 'settimana'}
            onclick={() => mostra('settimana')}>Settimana</button>
          <button type="button" class="border-l-2 border-black px-3 py-2" class:bg-black={vista === 'mese'} class:text-white={vista === 'mese'}
            onclick={() => mostra('mese')}>Mese</button>
        </div>
        <div class="flex gap-2">
          <button type="button" class="club-btn px-3 py-1.5 sm:py-2" aria-label={vista === 'mese' ? 'Mese precedente' : 'Settimana precedente'} onclick={() => sposta(-1)}>‹</button>
          <button type="button" class="club-btn px-3 py-1.5 sm:py-2" onclick={vaiAOggi}>Oggi</button>
          <button type="button" class="club-btn px-3 py-1.5 sm:py-2" aria-label={vista === 'mese' ? 'Mese successivo' : 'Settimana successiva'} onclick={() => sposta(1)}>›</button>
        </div>
        <h2 class="w-full text-xl font-black first-letter:uppercase sm:w-auto sm:text-2xl">
          {vista === 'mese' ? fmtMese(mese) : kiosk ? fmtSettimanaBreve(lunedi) : fmtSettimana(lunedi)}
          {#if caricamento}<span class="ml-1 text-sm font-bold text-slate-500">caricamento…</span>{/if}
        </h2>
        {#if linkExport && tennista && !kiosk}
          <a href={linkExport} class="club-btn hidden px-3 py-2 text-sm md:inline-block" download title="Riepilogo giorno per giorno del periodo mostrato">
            Esporta CSV
          </a>
        {/if}

        <div class="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:gap-3" class:ol-kiosk-destra={kiosk}>
          <label class="flex items-center gap-1.5 text-xs font-black uppercase sm:gap-2 sm:text-sm">
            <span class:sr-only={kiosk}>Maestro</span>
            <select class="border-2 border-black px-2 py-1 text-sm font-bold normal-case sm:text-base" bind:value={staffId}>
              {#each attivi as s (s.id)}
                <option value={s.id}>{s.nome}{s.sono_io ? ' (io)' : ''}</option>
              {/each}
            </select>
          </label>
          <label class="flex items-center gap-1.5 text-xs font-black uppercase sm:gap-2 sm:text-sm">
            <span class:sr-only={kiosk}>Club</span>
            <select class="border-2 border-black px-2 py-1 text-sm font-bold normal-case sm:text-base" bind:value={club}>
              <option value={null}>{kiosk ? 'Tutti i club' : 'Tutti'}</option>
              {#each Object.entries(CLUB) as [k, v] (k)}<option value={k}>{v}</option>{/each}
            </select>
          </label>
          <label class="flex items-center gap-1 text-sm font-bold">
            <input type="checkbox" bind:checked={conColleghi} />
            colleghi
          </label>
          {#if affiancato}
            <label class="flex items-center gap-1 text-sm font-bold" title={`Mostra sempre i turni di ${affiancato.nome}`}>
              <input type="checkbox" bind:checked={conAffiancato} disabled={conColleghi} />
              {affiancato.nome}
            </label>
          {/if}
          {#if kiosk && !comeApp}
            <button
              type="button"
              class="club-btn px-2.5 py-2"
              data-schermo-intero
              aria-label={schermoIntero ? 'Esci dallo schermo intero' : 'Schermo intero'}
              title={schermoIntero ? 'Esci dallo schermo intero' : 'Schermo intero'}
              onclick={alternaSchermoIntero}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" aria-hidden="true">
                {#if schermoIntero}
                  <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
                {:else}
                  <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
                {/if}
              </svg>
            </button>
          {/if}
        </div>
      </div>

      <div class="mb-3 flex flex-wrap gap-1 text-[10px] font-black sm:mb-4 sm:gap-2 sm:text-xs" class:hidden={kiosk}>
{#if tennista}
        {#each [['lavorato', 'Lavorato'], ['extra', 'Extra / sostituzioni fatte'], ['privata', 'Ore private'], ['assente', 'Assente'], ['verifica', 'Da verificare']] as [chiave, etichetta] (chiave)}
          <span class="inline-flex items-center gap-1 border-2 border-black bg-white px-1.5 py-0.5 sm:px-2 sm:py-1">
            <span class="h-3 w-3 border border-black" style={`background:${COLORI[chiave as keyof typeof COLORI]}`}></span>
            {etichetta}
          </span>
        {/each}
        {/if}
        {#if conColleghi}
          <span class="inline-flex items-center gap-1 border-2 border-dashed border-black bg-white px-1.5 py-0.5 sm:px-2 sm:py-1">
            <span class="h-3 w-3 border border-dashed border-black" style={`background:${COLORI.collega}`}></span>
            Colleghi
          </span>
        {/if}
        {#if affiancato && (conColleghi || conAffiancato)}
          <span class="inline-flex items-center gap-1 border-2 border-black bg-white px-1.5 py-0.5 sm:px-2 sm:py-1">
            <span class="h-3 w-3 border border-black" style={`background:${coloreDi(affiancato)}`}></span>
            {affiancato.nome}
          </span>
        {/if}
      </div>

      {#if vista === 'mese'}
        <p class="mb-3 text-sm font-medium text-slate-600">Tocca un giorno per aprirne la settimana.</p>
        <MonthGrid
          {mese}
          giorni={correnti?.giorni ?? []}
          riassunti={riassuntiMese}
          onGiorno={(data) => {
            lunedi = lunediDi(data);
            vista = 'settimana';
          }}
        />
      {:else}
      <p class={`mb-3 hidden text-sm font-medium text-slate-600 ${kiosk ? '' : 'md:block'}`}>
        Clic su un turno: assenza o sostituzione per tutto il turno; trascina dentro il turno per una parte sola.
        Le maniglie sopra e sotto accorciano o allungano. Clic o trascinamento su celle vuote: ore extra.
      </p>
      <div class="mb-3 flex items-center gap-3 px-1 md:hidden" class:hidden={kiosk}>
        <div class="flex border-2 border-black text-xs font-black uppercase">
          <button type="button" class="px-3 py-1.5" class:bg-black={vistaMobile === 'agenda'} class:text-white={vistaMobile === 'agenda'}
            onclick={() => scegliVistaMobile('agenda')}>Agenda</button>
          <button type="button" class="border-l-2 border-black px-3 py-1.5" class:bg-black={vistaMobile === 'griglia'}
            class:text-white={vistaMobile === 'griglia'} onclick={() => scegliVistaMobile('griglia')}>Griglia</button>
        </div>
        <p class="text-xs font-medium leading-snug text-slate-600">
          {vistaMobile === 'agenda' ? 'Tocca un turno, o "+" per aggiungere ore.' : 'Tocca un turno o una cella vuota.'}
        </p>
      </div>

      <div class={vistaMobile === 'agenda' && !kiosk ? 'md:hidden' : 'hidden'}>
        <WeekAgenda
          {colonne}
          {blocchi}
          secondario={(b) => b.segmento.tipo.startsWith('collega')}
          sottotitolo={(b) => b.sottotitolo}
          onBlocco={(b) => apriDaBlocco(b)}
          onAggiungi={aggiungiNelGiorno}
        />
      </div>

      <div class={vistaMobile === 'griglia' || kiosk ? '' : 'hidden md:block'}>
      <WeekGrid
        {colonne}
        {blocchi}
        fasceScure={FASCE_PASTI}
        nascondiGiorniVuoti
        sempreVisibili={FERIALI}
        toccoDiretto={kiosk}
        adattaAltezza={kiosk}
        stretta={stretto}
        timeColPx={stretto ? 34 : 52}
        slotPx={32}
        limiteInizio={8 * 60}
        minimoVisibile={{ inizio: 15 * 60, fine: 22 * 60 }}
        onBlockClick={(b) => apriDaBlocco(b)}
        {onSelezione}
        {onResize}
        {ridimensionabile}
      >
        {#snippet blocco(b)}
          <p class="wg-block-title">{b.titolo}</p>
          <p class="wg-block-time">{fmtFascia(b.inizio, b.fine)}</p>
          {#if b.sottotitolo}<p class="ol-nota">{b.sottotitolo}</p>{/if}
        {/snippet}
      </WeekGrid>
      </div>
      {/if}

      {#if linkExport && tennista && !kiosk}
        <a href={linkExport} class="club-btn mt-4 block py-2 text-center text-sm md:hidden" download>Esporta CSV del periodo</a>
      {/if}
    </section>

    {#if !kiosk}
    <div class="space-y-5">
      {#if tennista}
      <section class="club-card bg-white p-4 sm:p-5">
        <h2 class="mb-1 text-2xl font-black">{vista === 'mese' ? 'Mese' : 'Settimana'}</h2>
        <p class="mb-4 text-sm font-bold text-slate-600">
          {selezionato?.nome ?? ''}{club ? ` · ${CLUB[club]}` : ''}
        </p>

        {#if totale}
          <Riepilogo {totale} {minutiPrivate} />
        {:else}
          <p class="font-bold text-slate-500">{caricamento ? 'Caricamento…' : 'Dati non disponibili.'}</p>
        {/if}
      </section>
      {/if}

      {#if tennista && correnti?.daPagare}
        {@const dp = correnti.daPagare}
        <section class="club-card bg-white p-4 sm:p-5">
          <h2 class="mb-1 text-2xl font-black">Da farsi pagare</h2>
          <p class="mb-3 text-sm font-bold text-slate-600">
            Dall'ultimo pagamento, {fmtData(dp.dal)}, a oggi{club ? ` · ${CLUB[club]}` : ''}
          </p>
          <dl class="space-y-1 font-bold">
            <div class="ol-riga text-lg font-black"><dt>Lavorate</dt><span class="ol-dots"></span><dd>{fmtDurata(dp.minuti_lavorati)}</dd></div>
            <div class="ol-riga text-sm"><dt>di cui sostituzioni ed extra</dt><span class="ol-dots"></span><dd>{fmtDurata(dp.minuti_sostituzioni)}</dd></div>
            <div class="ol-riga text-sm text-slate-600"><dt>Previste</dt><span class="ol-dots"></span><dd>{fmtDurata(dp.minuti_previsti)}</dd></div>
            <div class="ol-riga text-sm text-slate-600"><dt>Assenze</dt><span class="ol-dots"></span><dd>{fmtDurata(dp.minuti_assenza)}</dd></div>
          </dl>

          <div class="mt-4 flex items-end gap-3 border-t-2 border-black pt-3">
            <div class="w-28">
              <label for="ol-tariffa" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">€ all'ora</label>
              <input id="ol-tariffa" type="number" min="0" step="0.5" inputmode="decimal" class="w-full border-2 border-black p-2 font-bold"
                bind:value={tariffa} onchange={salvaTariffa} />
            </div>
            <div class="flex-1 text-right">
              <p class="text-xs font-black uppercase text-slate-600">Totale da ricevere</p>
              <p class="text-2xl font-black">{euro.format(((dp.minuti_lavorati / 60) * (Number(tariffa) || 0)))}</p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-end gap-2 border-t-2 border-black pt-3">
            <div class="min-w-0 flex-1">
              <label for="ol-pagamento" class="mb-1 block text-xs font-black uppercase text-slate-600">Pagamento ricevuto il</label>
              <input id="ol-pagamento" type="date" class="w-full border-2 border-black p-2 font-bold" bind:value={dataPagamento} />
            </div>
            <button type="button" class="club-btn-yellow px-4 py-2" disabled={salvandoPagamento || !dataPagamento} onclick={segnaPagamento}>
              Segna pagamento
            </button>
          </div>

          {#if correnti.pagamenti?.length}
            <ul class="mt-3 space-y-1 text-sm font-bold">
              {#each correnti.pagamenti as pg (pg.id)}
                <li class="flex items-center justify-between gap-2">
                  <span>Pagato il {fmtData(pg.data)}{pg.note ? ` · ${pg.note}` : ''}</span>
                  <button type="button" class="px-2 text-slate-500 underline" disabled={salvandoPagamento}
                    aria-label={`Togli il pagamento del ${fmtData(pg.data)}`} onclick={() => togliPagamento(pg.id, pg.data)}>togli</button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}

      {#if tennista && vista === 'mese' && correnti?.settimane?.length}
        <section class="club-card bg-white p-5">
          <h2 class="mb-3 text-2xl font-black">Settimane</h2>
          <table class="w-full text-sm font-bold">
            <thead>
              <tr class="border-b-2 border-black text-left text-xs uppercase text-slate-600">
                <th class="py-1">Settimana</th>
                <th class="py-1 text-right" title="Previste">Prev.</th>
                <th class="py-1 text-right" title="Lavorate">Lav.</th>
                <th class="py-1 text-right" title="Sostituzioni ed extra fatte">Sost.</th>
                <th class="py-1 text-right" title="Sostituito o assente">Ass.</th>
                <th class="py-1 text-right" title="Differenza">Diff.</th>
              </tr>
            </thead>
            <tbody>
              {#each correnti.settimane as s (s.periodo_inizio)}
                <tr class="border-b border-black/20">
                  <td class="py-1">
                    <button type="button" class="underline" onclick={() => { lunedi = s.periodo_inizio; vista = 'settimana'; }}>
                      {etichettaSettimana(s.periodo_inizio)}
                    </button>
                  </td>
                  <td class="py-1 text-right">{fmtDurata(s.minuti_previsti)}</td>
                  <td class="py-1 text-right font-black">{fmtDurata(s.minuti_lavorati)}</td>
                  <td class="py-1 text-right">{fmtDurata(s.minuti_sostituzioni)}</td>
                  <td class="py-1 text-right">{fmtDurata(s.minuti_assenza)}</td>
                  <td class="py-1 text-right">{fmtDurata(s.minuti_differenza, true)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>
      {/if}

      {#if selezionato && tennista}
        <OrarioPanel staffId={selezionato.id} nome={selezionato.nome} {versione} onChanged={aggiorna} onErrore={flashErrore} />
      {/if}

      {#if selezionato && tennista}
        <ImportPanel {staff} persona={selezionato} onImported={aggiorna} onErrore={flashErrore} />
      {/if}

      <StaffPanel {staff} onChange={(s) => (staff = s)} onErrore={flashErrore} />
    </div>
    {/if}
  </div>
{/if}

{#if prospetto && selezionato}
  <EccezioneModal
    {staff}
    persona={selezionato}
    {prospetto}
    daVerificare={giornoOre.get(prospetto.data)?.da_verificare ?? false}
    onClose={() => (prospetto = null)}
    onSaved={() => {
      prospetto = null;
      aggiorna();
    }}
    onErrore={flashErrore}
    largo={kiosk}
    onImpegno={!prospetto.id && !prospetto.assente_id && !prospetto.daTurno
      ? (x) => {
          prospetto = null;
          apriVuoto(x.data, x.inizio, x.fine);
        }
      : undefined}
  />
{/if}

{#if impegno}
  <ImpegnoModal
    prospetto={impegno}
    persone={personeImpegno.some((x) => x.id === impegno?.staff_id)
      ? personeImpegno
      : [...staff.filter((x) => x.id === impegno?.staff_id), ...personeImpegno]}
    largo={kiosk}
    onTennis={tennista && !impegno.id
      ? (x) => {
          impegno = null;
          prospetto = nuovaExtra(x.data, x.inizio, x.fine);
        }
      : undefined}
    onClose={() => (impegno = null)}
    onSaved={() => {
      impegno = null;
      aggiorna();
    }}
    onErrore={flashErrore}
  />
{/if}

<style>
  /* Su telefono il calendario va da bordo a bordo: niente ombra né bordi
     laterali, e recupera il margine della pagina. */
  @media (max-width: 767px) {
    .ol-cal {
      box-shadow: none;
      border-left-width: 0;
      border-right-width: 0;
      margin-left: -1rem;
      margin-right: -1rem;
    }
  }

  /* Kiosk (tablet in orizzontale): tutta la barra su una riga. */
  .ol-kiosk-barra,
  .ol-kiosk-destra {
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  .ol-kiosk-barra {
    gap: 0.6rem;
  }

  .ol-kiosk-barra h2 {
    font-size: 1.35rem;
    width: auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ol-kiosk-destra {
    width: auto;
    margin-left: auto;
    gap: 0.6rem;
  }

  .ol-riga {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .ol-dots {
    flex: 1;
    min-width: 0.5rem;
    border-bottom: 2px dotted rgba(0, 0, 0, 0.35);
  }

  .ol-nota {
    margin-top: 0.1rem;
    font-size: 0.6rem;
    font-weight: 600;
    line-height: 1.2;
    opacity: 0.85;
  }
</style>
