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
  import {
    GIORNI_BREVI, addGiorni, addMesi, fmtDurata, fmtFascia, fmtGiornoMese, fmtMese, fmtSettimana, fmtSettimanaBreve, giorniSettimana, lunediDi,
    minutiToTime, oggiRoma, primoDelMese, ultimoDelMese,
  } from '../../lib/time-grid';
  import { segmentiPeriodo, type Segmento } from '../../lib/ore-lavoro/segmenti';
  import { ATTIVITA, CLUB, COLORI, type Club, type DatiPeriodo, type Eccezione, type Staff } from '../../lib/ore-lavoro/types';

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
  let dati: DatiPeriodo | null = $state(datiIniziali);
  let caricamento = $state(false);
  let errore = $state(erroreIniziale);
  let erroreTimer: ReturnType<typeof setTimeout> | undefined;
  let prospetto: ProspettoEccezione | null = $state(null);
  // Su telefono la settimana si può vedere come agenda o come griglia: la
  // scelta resta nel browser (solo una comodità, se manca si parte dall'agenda).
  const CHIAVE_VISTA_MOBILE = 'ore-lavoro:vista-mobile';
  let vistaMobile: 'agenda' | 'griglia' = $state('agenda');
  let stretto = $state(false);

  $effect(() => {
    try {
      if (localStorage.getItem(CHIAVE_VISTA_MOBILE) === 'griglia') vistaMobile = 'griglia';
    } catch {
      /* archiviazione non disponibile */
    }
    const mq = window.matchMedia('(max-width: 767px)');
    const aggiorna = () => (stretto = mq.matches);
    aggiorna();
    mq.addEventListener('change', aggiorna);
    return () => mq.removeEventListener('change', aggiorna);
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
      } else if (!prospetto) carica(true);
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

  // --- Blocchi ----------------------------------------------------------------

  type Blocco = BloccoGriglia & { segmento: Segmento; sottotitolo?: string };

  function etichettaAttivita(s: Segmento) {
    const a = ATTIVITA[s.attivita];
    return !club && s.club !== 'cingoli' ? `${a} · ${CLUB[s.club]}` : a;
  }

  const blocchi: Blocco[] = $derived.by(() => {
    if (!correnti || !staffId || vista !== 'settimana') return [];
    return segmentiPeriodo(staffId, correnti.previsti, correnti.eccezioni, conColleghi).map((s) => {
      const e = s.eccezione;
      const daVerificare = giornoOre.get(s.data)?.da_verificare ?? false;
      let titolo = etichettaAttivita(s);
      let colore: string = COLORI.lavorato;
      let classe = '';
      if (s.tipo === 'lavorato' && daVerificare) {
        titolo = `${titolo} · da verificare`;
        colore = COLORI.verifica;
      } else if (s.tipo === 'assente') {
        titolo = e?.sostituto_id ? `Sostituito da ${nomeDi.get(e.sostituto_id) ?? '?'}` : 'Assente';
        colore = COLORI.assente;
      } else if (s.tipo === 'extra') {
        titolo = e?.assente_id ? `Sostituisco ${nomeDi.get(e.assente_id) ?? '?'}` : 'Ore extra';
        colore = COLORI.extra;
      } else if (s.tipo === 'collega') {
        titolo = `${nomeDi.get(s.staff_id) ?? '?'} · ${etichettaAttivita(s)}`;
        colore = COLORI.collega;
        classe = 'wg-block-tratteggiato';
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

  const colonne = $derived(
    giorni.map((g, i) => {
      const ore = giornoOre.get(g);
      const lavorate = ore && (ore.minuti_previsti || ore.minuti_lavorati) ? ` · ${fmtDurata(ore.minuti_lavorati)}` : '';
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

  function apriDaBlocco(b: Blocco, inizio = b.inizio, fine = b.fine) {
    const s = b.segmento;
    if (s.eccezione) prospetto = daEccezione(s.eccezione);
    else prospetto = daTurno(s, inizio, fine);
  }

  function onSelezione(colonna: number, inizio: number, fine: number, b: Blocco | null) {
    if (b) apriDaBlocco(b, inizio, fine);
    else prospetto = nuovaExtra(giorni[colonna], inizio, fine);
  }

  async function onResize(b: Blocco, inizio: number, fine: number) {
    const s = b.segmento;
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

  const ridimensionabile = (b: Blocco) => ['lavorato', 'assente', 'extra'].includes(b.segmento.tipo);

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
    prospetto = nuovaExtra(giorni[colonna], inizio, inizio + 60);
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
        {#if linkExport && !kiosk}
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
          {#if vista === 'settimana'}
            <label class="flex items-center gap-1 text-sm font-bold">
              <input type="checkbox" bind:checked={conColleghi} />
              colleghi
            </label>
          {/if}
          {#if kiosk && !comeApp}
            <button type="button" class="club-btn px-3 py-2 text-sm" data-schermo-intero onclick={alternaSchermoIntero}>
              {schermoIntero ? 'Esci' : 'Schermo intero'}
            </button>
          {/if}
        </div>
      </div>

      <div class="mb-3 flex flex-wrap gap-1 text-[10px] font-black sm:mb-4 sm:gap-2 sm:text-xs" class:hidden={kiosk}>
        {#each [['lavorato', 'Lavorato'], ['extra', 'Extra / sostituzioni fatte'], ['assente', 'Assente'], ['verifica', 'Da verificare']] as [chiave, etichetta] (chiave)}
          <span class="inline-flex items-center gap-1 border-2 border-black bg-white px-1.5 py-0.5 sm:px-2 sm:py-1">
            <span class="h-3 w-3 border border-black" style={`background:${COLORI[chiave as keyof typeof COLORI]}`}></span>
            {etichetta}
          </span>
        {/each}
        {#if conColleghi && vista === 'settimana'}
          <span class="inline-flex items-center gap-1 border-2 border-dashed border-black bg-white px-1.5 py-0.5 sm:px-2 sm:py-1">
            <span class="h-3 w-3 border border-dashed border-black" style={`background:${COLORI.collega}`}></span>
            Colleghi
          </span>
        {/if}
      </div>

      {#if vista === 'mese'}
        <p class="mb-3 text-sm font-medium text-slate-600">Tocca un giorno per aprirne la settimana.</p>
        <MonthGrid
          {mese}
          giorni={correnti?.giorni ?? []}
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
        nascondiGiorniVuoti
        toccoDiretto={kiosk}
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

      {#if linkExport && !kiosk}
        <a href={linkExport} class="club-btn mt-4 block py-2 text-center text-sm md:hidden" download>Esporta CSV del periodo</a>
      {/if}
    </section>

    {#if !kiosk}
    <div class="space-y-5">
      <section class="club-card bg-white p-4 sm:p-5">
        <h2 class="mb-1 text-2xl font-black">{vista === 'mese' ? 'Mese' : 'Settimana'}</h2>
        <p class="mb-4 text-sm font-bold text-slate-600">
          {selezionato?.nome ?? ''}{club ? ` · ${CLUB[club]}` : ''}
        </p>

        {#if totale}
          <Riepilogo {totale} />
        {:else}
          <p class="font-bold text-slate-500">{caricamento ? 'Caricamento…' : 'Dati non disponibili.'}</p>
        {/if}
      </section>

      {#if vista === 'mese' && correnti?.settimane?.length}
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

      {#if selezionato}
        <OrarioPanel staffId={selezionato.id} nome={selezionato.nome} {versione} onChanged={aggiorna} onErrore={flashErrore} />
      {/if}

      {#if selezionato}
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

  .ol-nota {
    margin-top: 0.1rem;
    font-size: 0.6rem;
    font-weight: 600;
    line-height: 1.2;
    opacity: 0.85;
  }
</style>
