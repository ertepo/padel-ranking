<script lang="ts">
  import { onDestroy } from 'svelte';

  type Gruppo = {
    id: string;
    nome: string;
    colore: string;
    tipo: string | null;
    eta: string | null;
    livello: string | null;
  };

  type Studente = {
    id: string;
    nome: string;
    cognome: string;
    gruppo_id: string | null;
    note: string | null;
  };

  type Lezione = {
    id: string;
    gruppo_id: string;
    giorno_settimana: number;
    ora_inizio_minuti: number;
    durata_minuti: number;
  };

  type LezioneStudente = { lezione_id: string; studente_id: string };

  export let gruppiIniziali: Gruppo[] = [];
  export let studentiIniziali: Studente[] = [];
  export let lezioniIniziali: Lezione[] = [];
  export let lezioneStudentiIniziali: LezioneStudente[] = [];

  let gruppi = [...gruppiIniziali];
  let studenti = [...studentiIniziali];
  let lezioni = [...lezioniIniziali];

  function buildLezioneStudentiMap(rows: LezioneStudente[]) {
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      (map[row.lezione_id] ??= []).push(row.studente_id);
    }
    return map;
  }

  let lezioneStudenti: Record<string, string[]> = buildLezioneStudentiMap(lezioneStudentiIniziali);

  const PALETTE = ['#38bdf8', '#6d42bb', '#318a5d', '#dc2828', '#ffcc00', '#fa8072', '#0076ca', '#f97316', '#cbd5e1'];

  let messaggio = '';
  let errore = '';
  let messaggioTimer: ReturnType<typeof setTimeout>;
  let erroreTimer: ReturnType<typeof setTimeout>;

  function flashMessaggio(msg: string) {
    messaggio = msg;
    clearTimeout(messaggioTimer);
    messaggioTimer = setTimeout(() => (messaggio = ''), 2500);
  }

  function flashErrore(msg: string) {
    errore = msg;
    clearTimeout(erroreTimer);
    erroreTimer = setTimeout(() => (errore = ''), 4500);
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function gruppoById(id: string) {
    return gruppi.find((g) => g.id === id);
  }

  function studentiDelGruppo(gruppoId: string) {
    return studenti.filter((s) => s.gruppo_id === gruppoId);
  }

  function studentiByIds(ids: string[]) {
    return ids
      .map((id) => studenti.find((s) => s.id === id))
      .filter((s): s is Studente => Boolean(s))
      .sort((a, b) => a.cognome.localeCompare(b.cognome, 'it'));
  }

  function nomeBreve(s: Studente) {
    return `${s.cognome}${s.nome.charAt(0).toUpperCase()}`;
  }

  $: minutiTotaliOccupati = lezioni.reduce((somma, l) => somma + l.durata_minuti, 0);

  function fmtDurataTotale(minuti: number) {
    const ore = Math.floor(minuti / 60);
    const min = minuti % 60;
    return min === 0 ? `${ore}h` : `${ore}h ${min}min`;
  }

  function esportaOrario() {
    const dati = {
      generato_il: new Date().toISOString(),
      gruppi: gruppi.map((g) => ({ nome: g.nome, colore: g.colore, tipo: g.tipo, eta: g.eta, livello: g.livello })),
      lezioni: [...lezioni]
        .sort((a, b) => a.giorno_settimana - b.giorno_settimana || a.ora_inizio_minuti - b.ora_inizio_minuti)
        .map((l) => {
          const g = gruppoById(l.gruppo_id);
          const membri = studentiByIds(lezioneStudenti[l.id] ?? []);
          return {
            gruppo: g?.nome ?? 'Gruppo eliminato',
            giorno: GIORNI[l.giorno_settimana - 1],
            inizio: minutiToTime(l.ora_inizio_minuti),
            fine: minutiToTime(l.ora_inizio_minuti + l.durata_minuti),
            durata_minuti: l.durata_minuti,
            partecipanti: membri.map((s) => `${s.nome} ${s.cognome}`),
          };
        }),
    };

    const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orario-scuola-tennis-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function conteggioSlot(studenteId: string) {
    let count = 0;
    for (const ids of Object.values(lezioneStudenti)) {
      if (ids.includes(studenteId)) count++;
    }
    return count;
  }

  // ---------------------------------------------------------------------
  // Gruppi
  // ---------------------------------------------------------------------

  let nuovoGruppoNome = '';
  let nuovoGruppoColore = PALETTE[0];
  let nuovoGruppoTipo = '';
  let nuovoGruppoEta = '';
  let nuovoGruppoLivello = '';
  let salvandoGruppo = false;

  async function creaGruppo() {
    if (!nuovoGruppoNome.trim()) {
      flashErrore('Inserisci il nome del gruppo.');
      return;
    }

    salvandoGruppo = true;

    try {
      const res = await fetch('/api/scuola-tennis/gruppi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nuovoGruppoNome.trim(),
          colore: nuovoGruppoColore,
          tipo: nuovoGruppoTipo.trim(),
          eta: nuovoGruppoEta.trim(),
          livello: nuovoGruppoLivello.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.gruppo) throw new Error(result.error || 'Errore nella creazione del gruppo.');

      gruppi = [...gruppi, result.gruppo];
      nuovoGruppoNome = '';
      nuovoGruppoTipo = '';
      nuovoGruppoEta = '';
      nuovoGruppoLivello = '';
      nuovoGruppoColore = PALETTE[gruppi.length % PALETTE.length];
      flashMessaggio('Gruppo creato.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    } finally {
      salvandoGruppo = false;
    }
  }

  let gruppoInModifica: string | null = null;
  let modificaBuffer: { id: string; nome: string; colore: string; tipo: string; eta: string; livello: string } = {
    id: '',
    nome: '',
    colore: PALETTE[0],
    tipo: '',
    eta: '',
    livello: '',
  };

  function iniziaModificaGruppo(g: Gruppo) {
    gruppoInModifica = g.id;
    modificaBuffer = {
      id: g.id,
      nome: g.nome,
      colore: g.colore,
      tipo: g.tipo ?? '',
      eta: g.eta ?? '',
      livello: g.livello ?? '',
    };
  }

  function annullaModificaGruppo() {
    gruppoInModifica = null;
  }

  async function salvaModificaGruppo() {
    if (!modificaBuffer.nome.trim()) {
      flashErrore('Il nome del gruppo è obbligatorio.');
      return;
    }

    try {
      const res = await fetch('/api/scuola-tennis/gruppi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modificaBuffer.id,
          nome: modificaBuffer.nome.trim(),
          colore: modificaBuffer.colore,
          tipo: modificaBuffer.tipo.trim(),
          eta: modificaBuffer.eta.trim(),
          livello: modificaBuffer.livello.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.gruppo) throw new Error(result.error || 'Errore nel salvataggio del gruppo.');

      gruppi = gruppi.map((g) => (g.id === result.gruppo.id ? result.gruppo : g));
      gruppoInModifica = null;
      flashMessaggio('Gruppo aggiornato.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    }
  }

  async function eliminaGruppo(id: string) {
    if (!confirm('Eliminare questo gruppo? Le lezioni collegate verranno rimosse dal calendario.')) return;

    try {
      const res = await fetch('/api/scuola-tennis/gruppi', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Errore nell'eliminazione del gruppo.");

      gruppi = gruppi.filter((g) => g.id !== id);
      const lezioniRimosse = new Set(lezioni.filter((l) => l.gruppo_id === id).map((l) => l.id));
      lezioni = lezioni.filter((l) => l.gruppo_id !== id);
      lezioneStudenti = Object.fromEntries(
        Object.entries(lezioneStudenti).filter(([lezioneId]) => !lezioniRimosse.has(lezioneId)),
      );
      studenti = studenti.map((s) => (s.gruppo_id === id ? { ...s, gruppo_id: null } : s));
      flashMessaggio('Gruppo eliminato.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    }
  }

  // ---------------------------------------------------------------------
  // Studenti
  // ---------------------------------------------------------------------

  let nuovoStudenteNome = '';
  let nuovoStudenteCognome = '';
  let nuovoStudenteGruppo = '';
  let salvandoStudente = false;

  async function creaStudente() {
    if (!nuovoStudenteNome.trim() || !nuovoStudenteCognome.trim()) {
      flashErrore('Inserisci nome e cognome.');
      return;
    }

    salvandoStudente = true;

    try {
      const res = await fetch('/api/scuola-tennis/studenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nuovoStudenteNome.trim(),
          cognome: nuovoStudenteCognome.trim(),
          gruppo_id: nuovoStudenteGruppo || null,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.studente) throw new Error(result.error || 'Errore nella creazione dello studente.');

      studenti = [...studenti, result.studente].sort((a, b) => a.cognome.localeCompare(b.cognome, 'it'));
      nuovoStudenteNome = '';
      nuovoStudenteCognome = '';
      flashMessaggio('Studente aggiunto.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    } finally {
      salvandoStudente = false;
    }
  }

  async function cambiaGruppoStudente(studente: Studente, nuovoGruppoId: string | null) {
    const precedente = studente.gruppo_id;
    studenti = studenti.map((s) => (s.id === studente.id ? { ...s, gruppo_id: nuovoGruppoId } : s));

    try {
      const res = await fetch('/api/scuola-tennis/studenti', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: studente.id,
          nome: studente.nome,
          cognome: studente.cognome,
          gruppo_id: nuovoGruppoId,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Errore nel cambio di gruppo.');
    } catch (err) {
      studenti = studenti.map((s) => (s.id === studente.id ? { ...s, gruppo_id: precedente } : s));
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    }
  }

  async function eliminaStudente(id: string) {
    if (!confirm('Eliminare questo studente?')) return;

    try {
      const res = await fetch('/api/scuola-tennis/studenti', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Errore nell'eliminazione dello studente.");

      studenti = studenti.filter((s) => s.id !== id);
      lezioneStudenti = Object.fromEntries(
        Object.entries(lezioneStudenti).map(([lezioneId, ids]) => [lezioneId, ids.filter((sid) => sid !== id)]),
      );
      flashMessaggio('Studente eliminato.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    }
  }

  $: studentiPerGruppo = (() => {
    const map = new Map<string, Studente[]>();
    const senzaGruppo: Studente[] = [];

    for (const s of studenti) {
      if (s.gruppo_id) {
        if (!map.has(s.gruppo_id)) map.set(s.gruppo_id, []);
        map.get(s.gruppo_id)!.push(s);
      } else {
        senzaGruppo.push(s);
      }
    }

    const buckets = gruppi.map((g) => ({
      id: g.id,
      label: g.nome,
      studenti: map.get(g.id) || [],
    }));

    if (senzaGruppo.length) {
      buckets.push({ id: '', label: 'Senza gruppo', studenti: senzaGruppo });
    }

    return buckets;
  })();

  // ---------------------------------------------------------------------
  // Calendario
  // ---------------------------------------------------------------------

  const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const START_HOUR = 12;
  const END_HOUR = 24;
  const SLOT_MIN = 30;
  const SLOTS_PER_HOUR = 60 / SLOT_MIN;
  const TOTAL_SLOTS = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR;
  const SLOT_PX = 40;
  const TIME_COL_PX = 52;
  const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const GIORNI_IDX = Array.from({ length: 7 }, (_, i) => i);
  const SLOTS_IDX = Array.from({ length: TOTAL_SLOTS }, (_, i) => i);

  const ORA_COLLASSATA = 15 * 60;

  let mostraOrarioCompleto = false;

  $: oraVisibileInizio = mostraOrarioCompleto ? START_HOUR * 60 : ORA_COLLASSATA;
  $: rowOffset = Math.round((oraVisibileInizio - START_HOUR * 60) / SLOT_MIN);
  $: totalSlotsVisibili = TOTAL_SLOTS - rowOffset;
  $: hoursVisibili = HOURS.filter((h) => h * 60 >= oraVisibileInizio);
  $: slotsVisibiliIdx = SLOTS_IDX.filter((i) => i >= rowOffset);
  $: lezioniVisibili = lezioni.filter((l) => l.ora_inizio_minuti + l.durata_minuti > oraVisibileInizio);

  // Range orario da stampare: solo dalla prima alla ultima ora effettivamente
  // occupata da una lezione (arrotondato alle ore piene), per non stampare
  // righe vuote in cima/in fondo alla tabella.
  $: stampaRangeMinuti = (() => {
    if (lezioni.length === 0) {
      return { inizio: START_HOUR * 60, fine: END_HOUR * 60 };
    }

    let minInizio = Infinity;
    let maxFine = -Infinity;

    for (const l of lezioni) {
      minInizio = Math.min(minInizio, l.ora_inizio_minuti);
      maxFine = Math.max(maxFine, l.ora_inizio_minuti + l.durata_minuti);
    }

    const inizio = clamp(Math.floor(minInizio / 60) * 60, START_HOUR * 60, END_HOUR * 60);
    const fine = clamp(Math.ceil(maxFine / 60) * 60, inizio + 60, END_HOUR * 60);

    return { inizio, fine };
  })();

  $: stampaSlotIdxIniziale = Math.round((stampaRangeMinuti.inizio - START_HOUR * 60) / SLOT_MIN);
  $: stampaSlotsIdx = Array.from(
    { length: Math.round((stampaRangeMinuti.fine - stampaRangeMinuti.inizio) / SLOT_MIN) },
    (_, i) => stampaSlotIdxIniziale + i,
  );
  $: stampaHoursVisibili = HOURS.filter((h) => h * 60 >= stampaRangeMinuti.inizio && h * 60 < stampaRangeMinuti.fine);

  // In stampa si omettono sabato e domenica: la scuola tennis non ha mai
  // lezioni nel weekend, così la tabella e l'elenco stanno su una pagina verticale.
  const STAMPA_GIORNI_MAX = 5;
  const stampaGiorniIdx = GIORNI_IDX.filter((i) => i < STAMPA_GIORNI_MAX);

  $: stampaLezioni = lezioni.filter(
    (l) =>
      l.giorno_settimana <= STAMPA_GIORNI_MAX &&
      l.ora_inizio_minuti < stampaRangeMinuti.fine &&
      l.ora_inizio_minuti + l.durata_minuti > stampaRangeMinuti.inizio,
  );

  function stampaBlockStyle(l: Lezione) {
    const rowStart = Math.max(2, Math.round((l.ora_inizio_minuti - stampaRangeMinuti.inizio) / SLOT_MIN) + 2);
    const rowEnd = Math.round((l.ora_inizio_minuti + l.durata_minuti - stampaRangeMinuti.inizio) / SLOT_MIN) + 2;
    const rowSpan = Math.max(1, rowEnd - rowStart);
    return `grid-column:${l.giorno_settimana + 1}; grid-row:${rowStart} / span ${rowSpan};`;
  }

  function minutiToTime(min: number) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function timeToMinuti(value: string) {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  function snapToSlot(min: number) {
    return Math.round(min / SLOT_MIN) * SLOT_MIN;
  }

  function fmtRange(inizio: number, durata: number) {
    return `${minutiToTime(inizio)}–${minutiToTime(inizio + durata)}`;
  }

  function slotsStudente(studenteId: string) {
    return lezioni
      .filter((l) => l.giorno_settimana <= STAMPA_GIORNI_MAX && (lezioneStudenti[l.id] ?? []).includes(studenteId))
      .slice()
      .sort((a, b) => a.giorno_settimana - b.giorno_settimana || a.ora_inizio_minuti - b.ora_inizio_minuti)
      .map((l) => `${GIORNI_BREVI[l.giorno_settimana - 1]} ${minutiToTime(l.ora_inizio_minuti)}`);
  }

  function blockStyle(l: Lezione) {
    const g = gruppoById(l.gruppo_id);
    const col = l.giorno_settimana + 1;
    const rowStart = Math.max(2, Math.round((l.ora_inizio_minuti - oraVisibileInizio) / SLOT_MIN) + 2);
    const rowEnd = Math.round((l.ora_inizio_minuti + l.durata_minuti - oraVisibileInizio) / SLOT_MIN) + 2;
    const rowSpan = Math.max(1, rowEnd - rowStart);
    const colore = g?.colore || '#94a3b8';
    return `grid-column:${col}; grid-row:${rowStart} / span ${rowSpan}; background:${colore};`;
  }

  let gridEl: HTMLDivElement;

  type DragState = {
    id: string;
    pointerId: number;
    target: HTMLElement;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origGiorno: number;
    origOra: number;
    origDurata: number;
    moved: boolean;
  };

  let drag: DragState | null = null;

  function rimuoviListenerDrag() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', onPointerCancel);
  }

  function iniziaDrag(e: PointerEvent, lezione: Lezione, mode: 'move' | 'resize') {
    if (e.button !== 0) return;
    e.preventDefault();
    if (mode === 'resize') e.stopPropagation();

    // Un drag precedente può restare "appeso" se il browser non emette mai il
    // pointerup corrispondente (es. pointer cancellato, finestra che perde il
    // focus): senza questa pulizia lo slot resta bloccato e non risponde più
    // né al trascinamento né al click.
    if (drag) {
      annullaDrag();
    }

    const target = e.currentTarget as HTMLElement;

    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Alcuni browser/dispositivi non supportano la pointer capture: si
      // procede comunque con i soli listener su window.
    }

    drag = {
      id: lezione.id,
      pointerId: e.pointerId,
      target,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origGiorno: lezione.giorno_settimana,
      origOra: lezione.ora_inizio_minuti,
      origDurata: lezione.durata_minuti,
      moved: false,
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onPointerCancel);
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag || !gridEl) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;

    const lezione = lezioni.find((l) => l.id === drag!.id);
    if (!lezione) return;

    const rect = gridEl.getBoundingClientRect();
    const colWidth = (rect.width - TIME_COL_PX) / 7;

    if (drag.mode === 'move') {
      const colDelta = Math.round(dx / colWidth);
      const slotDelta = Math.round(dy / SLOT_PX);
      const nuovoGiorno = clamp(drag.origGiorno + colDelta, 1, 7);
      const maxOra = END_HOUR * 60 - lezione.durata_minuti;
      const nuovaOra = clamp(drag.origOra + slotDelta * SLOT_MIN, START_HOUR * 60, maxOra);

      if (nuovoGiorno !== lezione.giorno_settimana || nuovaOra !== lezione.ora_inizio_minuti) {
        lezioni = lezioni.map((l) =>
          l.id === lezione.id ? { ...l, giorno_settimana: nuovoGiorno, ora_inizio_minuti: nuovaOra } : l,
        );
      }
    } else {
      const slotDelta = Math.round(dy / SLOT_PX);
      const maxDurata = Math.min(END_HOUR * 60 - lezione.ora_inizio_minuti, 480);
      const nuovaDurata = clamp(drag.origDurata + slotDelta * SLOT_MIN, SLOT_MIN, maxDurata);

      if (nuovaDurata !== lezione.durata_minuti) {
        lezioni = lezioni.map((l) => (l.id === lezione.id ? { ...l, durata_minuti: nuovaDurata } : l));
      }
    }
  }

  // Riporta la lezione trascinata alla posizione di partenza e libera lo
  // stato di drag senza salvare né aprire la finestra di modifica: usata sia
  // per il pointercancel/blur sia per ripulire un drag rimasto appeso.
  function annullaDrag() {
    if (!drag) return;

    const current = drag;

    try {
      current.target.releasePointerCapture(current.pointerId);
    } catch {
      // ignorato: la capture potrebbe essere già stata rilasciata dal browser
    }

    rimuoviListenerDrag();
    drag = null;

    lezioni = lezioni.map((l) =>
      l.id === current.id
        ? { ...l, giorno_settimana: current.origGiorno, ora_inizio_minuti: current.origOra, durata_minuti: current.origDurata }
        : l,
    );
  }

  function onPointerCancel() {
    annullaDrag();
  }

  async function onPointerUp() {
    if (!drag) return;

    const current = drag;

    try {
      current.target.releasePointerCapture(current.pointerId);
    } catch {
      // ignorato: la capture potrebbe essere già stata rilasciata dal browser
    }

    rimuoviListenerDrag();
    drag = null;

    const lezione = lezioni.find((l) => l.id === current.id);
    if (!lezione) return;

    if (!current.moved) {
      apriModificaLezione(lezione);
      return;
    }

    const cambiato =
      lezione.giorno_settimana !== current.origGiorno ||
      lezione.ora_inizio_minuti !== current.origOra ||
      lezione.durata_minuti !== current.origDurata;

    if (!cambiato) return;

    try {
      const res = await fetch('/api/scuola-tennis/lezioni', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lezione.id,
          gruppo_id: lezione.gruppo_id,
          giorno_settimana: lezione.giorno_settimana,
          ora_inizio_minuti: lezione.ora_inizio_minuti,
          durata_minuti: lezione.durata_minuti,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio della lezione.');
    } catch (err) {
      lezioni = lezioni.map((l) =>
        l.id === current.id
          ? { ...l, giorno_settimana: current.origGiorno, ora_inizio_minuti: current.origOra, durata_minuti: current.origDurata }
          : l,
      );
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    }
  }

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    rimuoviListenerDrag();
  });

  // Creazione lezione da cella vuota

  let nuovaLezioneAperta = false;
  let nuovaLezioneGiorno = 1;
  let nuovaLezioneOra = START_HOUR * 60;
  let nuovaLezioneDurata = 60;
  let nuovaLezioneGruppo = '';
  let nuovaLezioneSelezionati: Set<string> = new Set();
  let salvandoLezione = false;

  function apriNuovaLezione(giorno: number, oraMinuti: number) {
    if (gruppi.length === 0) {
      flashErrore('Crea prima almeno un gruppo.');
      return;
    }

    nuovaLezioneGiorno = giorno;
    nuovaLezioneOra = oraMinuti;
    nuovaLezioneDurata = 60;
    nuovaLezioneGruppo = gruppi[0].id;
    nuovaLezioneSelezionati = new Set(studentiDelGruppo(gruppi[0].id).map((s) => s.id));
    nuovaLezioneAperta = true;
  }

  function onNuovaLezioneGruppoChange(gruppoId: string) {
    nuovaLezioneGruppo = gruppoId;
    nuovaLezioneSelezionati = new Set(studentiDelGruppo(gruppoId).map((s) => s.id));
  }

  function toggleNuovaLezioneSelezionato(studenteId: string) {
    const next = new Set(nuovaLezioneSelezionati);
    if (next.has(studenteId)) next.delete(studenteId);
    else next.add(studenteId);
    nuovaLezioneSelezionati = next;
  }

  function onNuovaLezioneOraChange(value: string) {
    nuovaLezioneOra = clamp(snapToSlot(timeToMinuti(value)), START_HOUR * 60, END_HOUR * 60 - SLOT_MIN);
  }

  async function salvaNuovaLezione() {
    const durata = clamp(Math.round(nuovaLezioneDurata / 15) * 15, 30, 480);

    salvandoLezione = true;

    try {
      const res = await fetch('/api/scuola-tennis/lezioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gruppo_id: nuovaLezioneGruppo,
          giorno_settimana: nuovaLezioneGiorno,
          ora_inizio_minuti: nuovaLezioneOra,
          durata_minuti: durata,
          studente_ids: Array.from(nuovaLezioneSelezionati),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.lezione) throw new Error(result.error || 'Errore nella creazione della lezione.');

      lezioni = [...lezioni, result.lezione];
      lezioneStudenti = { ...lezioneStudenti, [result.lezione.id]: result.studente_ids ?? [] };
      nuovaLezioneAperta = false;
      flashMessaggio('Lezione aggiunta.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    } finally {
      salvandoLezione = false;
    }
  }

  function cellClick(giorno: number, slotIdx: number) {
    apriNuovaLezione(giorno, START_HOUR * 60 + slotIdx * SLOT_MIN);
  }

  // Modifica / eliminazione lezione esistente

  let lezioneInModifica: Lezione | null = null;

  let lezioneInModificaSelezionati: Set<string> = new Set();

  function apriModificaLezione(lezione: Lezione) {
    lezioneInModifica = { ...lezione };
    lezioneInModificaSelezionati = new Set(
      lezioneStudenti[lezione.id] ?? studentiDelGruppo(lezione.gruppo_id).map((s) => s.id),
    );
  }

  function chiudiModificaLezione() {
    lezioneInModifica = null;
  }

  function onModificaGruppoChange(gruppoId: string) {
    if (!lezioneInModifica) return;
    lezioneInModifica = { ...lezioneInModifica, gruppo_id: gruppoId };
    lezioneInModificaSelezionati = new Set(studentiDelGruppo(gruppoId).map((s) => s.id));
  }

  function toggleModificaSelezionato(studenteId: string) {
    const next = new Set(lezioneInModificaSelezionati);
    if (next.has(studenteId)) next.delete(studenteId);
    else next.add(studenteId);
    lezioneInModificaSelezionati = next;
  }

  function onModificaOraChange(value: string) {
    if (!lezioneInModifica) return;
    const ora = clamp(snapToSlot(timeToMinuti(value)), START_HOUR * 60, END_HOUR * 60 - SLOT_MIN);
    lezioneInModifica = { ...lezioneInModifica, ora_inizio_minuti: ora };
  }

  async function salvaModificaLezione() {
    if (!lezioneInModifica) return;
    const l = { ...lezioneInModifica, durata_minuti: clamp(Math.round(lezioneInModifica.durata_minuti / 15) * 15, 30, 480) };

    try {
      const res = await fetch('/api/scuola-tennis/lezioni', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: l.id,
          gruppo_id: l.gruppo_id,
          giorno_settimana: l.giorno_settimana,
          ora_inizio_minuti: l.ora_inizio_minuti,
          durata_minuti: l.durata_minuti,
          studente_ids: Array.from(lezioneInModificaSelezionati),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.lezione) throw new Error(result.error || 'Errore nel salvataggio della lezione.');

      lezioni = lezioni.map((x) => (x.id === l.id ? result.lezione : x));
      lezioneStudenti = { ...lezioneStudenti, [l.id]: result.studente_ids ?? Array.from(lezioneInModificaSelezionati) };
      lezioneInModifica = null;
      flashMessaggio('Lezione aggiornata.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    }
  }

  async function eliminaLezione() {
    if (!lezioneInModifica) return;
    const id = lezioneInModifica.id;

    try {
      const res = await fetch('/api/scuola-tennis/lezioni', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Errore nell'eliminazione della lezione.");

      lezioni = lezioni.filter((l) => l.id !== id);
      const { [id]: _rimosso, ...restoLezioneStudenti } = lezioneStudenti;
      lezioneStudenti = restoLezioneStudenti;
      lezioneInModifica = null;
      flashMessaggio('Lezione eliminata.');
    } catch (err) {
      flashErrore(err instanceof Error ? err.message : 'Errore sconosciuto.');
    }
  }
</script>

{#if messaggio}
  <div class="fixed top-6 right-6 z-[9999] border-2 border-black bg-emerald-400 px-6 py-4 font-black text-lg shadow-[6px_6px_0_black]">
    {messaggio}
  </div>
{/if}

{#if errore}
  <div class="fixed top-6 right-6 z-[9999] border-2 border-black bg-rose-500 px-6 py-4 font-black text-lg text-white shadow-[6px_6px_0_black]">
    {errore}
  </div>
{/if}

<div class="space-y-8">
  <div class="grid gap-6 lg:grid-cols-2">
    <section class="club-card bg-white p-5">
      <h2 class="mb-4 text-2xl font-black">Nuovo gruppo</h2>

        <form class="space-y-3 border-2 border-black bg-slate-50 p-4" on:submit|preventDefault={creaGruppo}>
          <div class="flex items-center gap-2">
            <input type="color" bind:value={nuovoGruppoColore} class="h-10 w-10 shrink-0 border-2 border-black p-0" aria-label="Colore gruppo" />
            <input
              type="text"
              bind:value={nuovoGruppoNome}
              placeholder="Nome gruppo (es. Under 10)"
              required
              class="w-full min-w-0 flex-1 border-2 border-black p-2 font-bold"
            />
          </div>

          <div class="flex flex-wrap gap-1">
            {#each PALETTE as colore}
              <button
                type="button"
                class="h-6 w-6 border-2 border-black"
                style={`background:${colore}`}
                on:click={() => (nuovoGruppoColore = colore)}
                aria-label={`Usa colore ${colore}`}
              ></button>
            {/each}
          </div>

          <div class="grid grid-cols-3 gap-2">
            <input type="text" bind:value={nuovoGruppoTipo} placeholder="Tipo" class="min-w-0 border-2 border-black p-2 text-sm font-bold" />
            <input type="text" bind:value={nuovoGruppoEta} placeholder="Età" class="min-w-0 border-2 border-black p-2 text-sm font-bold" />
            <input type="text" bind:value={nuovoGruppoLivello} placeholder="Livello" class="min-w-0 border-2 border-black p-2 text-sm font-bold" />
          </div>

          <button type="submit" class="club-btn w-full py-3" disabled={salvandoGruppo}>
            {salvandoGruppo ? 'Salvataggio…' : 'Aggiungi gruppo'}
          </button>
        </form>

        <details class="mt-4">
          <summary class="cursor-pointer select-none text-xs font-black uppercase tracking-widest text-slate-600">
            Gruppi esistenti ({gruppi.length})
          </summary>

          <div class="mt-3 space-y-3">
            {#each gruppi as g (g.id)}
              <div class="flex items-start gap-3 border-2 border-black p-3" style={`background: color-mix(in oklab, ${g.colore} 16%, white)`}>
                {#if gruppoInModifica === g.id}
                  <div class="min-w-0 flex-1 space-y-2">
                    <div class="flex items-center gap-2">
                      <input type="color" bind:value={modificaBuffer.colore} class="h-9 w-9 shrink-0 border-2 border-black p-0" />
                      <input type="text" bind:value={modificaBuffer.nome} class="min-w-0 flex-1 border-2 border-black p-2 font-bold" />
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                      <input type="text" bind:value={modificaBuffer.tipo} placeholder="Tipo" class="min-w-0 border-2 border-black p-2 text-sm font-bold" />
                      <input type="text" bind:value={modificaBuffer.eta} placeholder="Età" class="min-w-0 border-2 border-black p-2 text-sm font-bold" />
                      <input type="text" bind:value={modificaBuffer.livello} placeholder="Livello" class="min-w-0 border-2 border-black p-2 text-sm font-bold" />
                    </div>
                    <div class="flex gap-2">
                      <button type="button" class="club-btn flex-1 py-2 text-sm" on:click={annullaModificaGruppo}>Annulla</button>
                      <button type="button" class="club-btn-yellow flex-1 py-2 text-sm" on:click={salvaModificaGruppo}>Salva</button>
                    </div>
                  </div>
                {:else}
                  <span class="mt-1 h-6 w-6 shrink-0 border-2 border-black" style={`background:${g.colore}`}></span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-black">{g.nome}</p>
                    <p class="truncate text-xs font-bold text-slate-600">
                      {[g.tipo, g.eta, g.livello].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div class="flex shrink-0 gap-2">
                    <button type="button" class="club-btn px-2 py-1 text-xs" on:click={() => iniziaModificaGruppo(g)}>Modifica</button>
                    <button type="button" class="club-btn px-2 py-1 text-xs" on:click={() => eliminaGruppo(g.id)}>Elimina</button>
                  </div>
                {/if}
              </div>
            {:else}
              <p class="font-bold text-slate-500">Nessun gruppo creato.</p>
            {/each}
          </div>
        </details>
      </section>

    <section class="club-card bg-white p-5">
      <h2 class="mb-4 text-2xl font-black">Nuovo studente</h2>

      <form class="grid grid-cols-2 gap-2 border-2 border-black bg-slate-50 p-4" on:submit|preventDefault={creaStudente}>
        <input type="text" bind:value={nuovoStudenteNome} placeholder="Nome" required class="min-w-0 border-2 border-black p-2 font-bold" />
        <input type="text" bind:value={nuovoStudenteCognome} placeholder="Cognome" required class="min-w-0 border-2 border-black p-2 font-bold" />
        <select bind:value={nuovoStudenteGruppo} class="col-span-2 border-2 border-black p-2 font-bold">
          <option value="">Senza gruppo</option>
          {#each gruppi as g}
            <option value={g.id}>{g.nome}</option>
          {/each}
        </select>
        <button type="submit" class="club-btn col-span-2 py-3" disabled={salvandoStudente}>
          {salvandoStudente ? 'Salvataggio…' : 'Aggiungi studente'}
        </button>
      </form>

      <details class="mt-4">
        <summary class="cursor-pointer select-none text-xs font-black uppercase tracking-widest text-slate-600">
          Studenti esistenti ({studenti.length})
        </summary>

        <div class="mt-3 max-h-[26rem] space-y-4 overflow-y-auto pr-1">
          {#each studentiPerGruppo as bucket (bucket.id || 'senza-gruppo')}
            <div>
              <p class="text-xs font-black uppercase tracking-widest text-slate-500">{bucket.label} ({bucket.studenti.length})</p>
              <div class="mt-2 divide-y-2 divide-black border-2 border-black">
                {#each bucket.studenti as s (s.id)}
                  <div class="flex flex-wrap items-center gap-2 bg-white p-2">
                    <p class="min-w-0 flex-1 truncate font-bold">{s.cognome} {s.nome}</p>
                    <span
                      class="shrink-0 border-2 border-black bg-[var(--giallo-club)] px-1.5 py-0.5 text-xs font-black"
                      title="Slot settimanali a calendario"
                    >
                      {conteggioSlot(s.id)}
                    </span>
                    <select
                      value={s.gruppo_id ?? ''}
                      on:change={(e) => cambiaGruppoStudente(s, (e.currentTarget as HTMLSelectElement).value || null)}
                      class="border-2 border-black p-1 text-xs font-bold"
                    >
                      <option value="">Senza gruppo</option>
                      {#each gruppi as g}
                        <option value={g.id}>{g.nome}</option>
                      {/each}
                    </select>
                    <button type="button" class="club-btn px-2 py-1 text-xs" on:click={() => eliminaStudente(s.id)}>Elimina</button>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <p class="font-bold text-slate-500">Nessuno studente presente.</p>
          {/each}
        </div>
      </details>
    </section>
  </div>

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
    <section class="club-card bg-white p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-2xl font-black">Orario settimanale</h2>
          <span
            class="border-2 border-black bg-[var(--giallo-club)] px-2 py-1 text-xs font-black uppercase"
            title="Somma della durata di tutte le lezioni in calendario"
          >
            {fmtDurataTotale(minutiTotaliOccupati)} occupate
          </span>
        </div>
        <p class="text-xs font-bold text-slate-500">
          Clicca una cella libera per creare · trascina un blocco per spostarlo · trascina il bordo inferiore per ridimensionarlo
        </p>
        <button type="button" class="club-btn px-3 py-2 text-xs uppercase" on:click={esportaOrario}>
          Esporta JSON
        </button>
        <button type="button" class="club-btn px-3 py-2 text-xs uppercase" on:click={() => window.print()}>
          Stampa
        </button>
      </div>

      {#if gruppi.length}
        <div class="mb-4 flex flex-wrap gap-2">
          {#each gruppi as g}
            <span
              class="inline-flex items-center gap-1 border-2 border-black px-2 py-1 text-xs font-black"
              style={`background: color-mix(in oklab, ${g.colore} 20%, white)`}
            >
              <span class="h-2.5 w-2.5 border border-black" style={`background:${g.colore}`}></span>
              {g.nome}
            </span>
          {/each}
        </div>
      {/if}

      <div class="cal-scroll border-2 border-black">
        <div
          bind:this={gridEl}
          class="cal-grid"
          style={`--slot-px:${SLOT_PX}px; --time-col:${TIME_COL_PX}px; grid-template-rows: auto repeat(${totalSlotsVisibili}, var(--slot-px));`}
        >
          <div class="cal-corner">
            <a
              href="#"
              class="cal-toggle-orario"
              on:click|preventDefault={() => (mostraOrarioCompleto = !mostraOrarioCompleto)}
              title={mostraOrarioCompleto ? 'Nascondi le ore prima delle 15:00' : 'Mostra le ore prima delle 15:00'}
            >{mostraOrarioCompleto ? '−' : '+'}</a>
          </div>

          {#each GIORNI_BREVI as giorno, i}
            <div class="cal-day-header" style={`grid-column:${i + 2}`}>{giorno}</div>
          {/each}

          {#each hoursVisibili as hour}
            <div class="cal-time-label" style={`grid-row:${(hour * 60 - oraVisibileInizio) / SLOT_MIN + 2} / span ${SLOTS_PER_HOUR}`}>{hour}:00</div>
          {/each}

          {#each GIORNI_IDX as dayIdx}
            {#each slotsVisibiliIdx as slotIdx}
              <div
                class="cal-cell"
                class:cal-cell-hour={slotIdx % SLOTS_PER_HOUR === 0}
                style={`grid-column:${dayIdx + 2}; grid-row:${slotIdx - rowOffset + 2}`}
                on:click={() => cellClick(dayIdx + 1, slotIdx)}
              ></div>
            {/each}
          {/each}

          {#each lezioniVisibili as l (l.id)}
            {@const g = gruppoById(l.gruppo_id)}
            {@const membri = studentiByIds(lezioneStudenti[l.id] ?? [])}
            <div class="cal-block" style={blockStyle(l)} on:pointerdown={(e) => iniziaDrag(e, l, 'move')}>
              <p class="cal-block-title">{g?.nome ?? 'Gruppo eliminato'}</p>
              <p class="cal-block-time">{fmtRange(l.ora_inizio_minuti, l.durata_minuti)}</p>
              {#if membri.length}
                <p class="cal-block-members">{membri.map(nomeBreve).join(', ')}</p>
              {/if}
              <div class="cal-handle" on:pointerdown={(e) => iniziaDrag(e, l, 'resize')}></div>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="club-card bg-white p-5">
      <h2 class="mb-4 text-2xl font-black">Elenco studenti</h2>

      <div class="cal-scroll space-y-4 pr-1">
        {#each studentiPerGruppo as bucket (bucket.id || 'senza-gruppo')}
          <div>
            <p class="text-xs font-black uppercase tracking-widest text-slate-500">{bucket.label} ({bucket.studenti.length})</p>
            <div class="mt-1 space-y-0.5">
              {#each bucket.studenti as s (s.id)}
                <div class="leader-row text-sm font-bold">
                  <span class="leader-label">{s.cognome} {s.nome}</span>
                  <span class="leader-dots"></span>
                  <span class="leader-value">{conteggioSlot(s.id)}</span>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <p class="font-bold text-slate-500">Nessuno studente presente.</p>
        {/each}
      </div>
    </section>
  </div>
</div>

{#if nuovaLezioneAperta}
  <div class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4" on:click|self={() => (nuovaLezioneAperta = false)}>
    <div class="club-card flex w-full max-w-sm flex-col bg-white p-5" style="max-height: 88vh;">
      <h3 class="mb-4 text-xl font-black">Nuova lezione</h3>

      <div class="space-y-3 overflow-y-auto pr-1">
        <div>
          <label for="nl-gruppo" class="mb-1 block text-xs font-black uppercase text-slate-600">Gruppo</label>
          <select
            id="nl-gruppo"
            value={nuovaLezioneGruppo}
            on:change={(e) => onNuovaLezioneGruppoChange((e.currentTarget as HTMLSelectElement).value)}
            class="w-full border-2 border-black p-2 font-bold"
          >
            {#each gruppi as g}
              <option value={g.id}>{g.nome}</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="nl-giorno" class="mb-1 block text-xs font-black uppercase text-slate-600">Giorno</label>
            <select id="nl-giorno" bind:value={nuovaLezioneGiorno} class="w-full border-2 border-black p-2 font-bold">
              {#each GIORNI as giorno, i}
                <option value={i + 1}>{giorno}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="nl-ora" class="mb-1 block text-xs font-black uppercase text-slate-600">Inizio</label>
            <input
              id="nl-ora"
              type="time"
              value={minutiToTime(nuovaLezioneOra)}
              step="900"
              on:change={(e) => onNuovaLezioneOraChange((e.currentTarget as HTMLInputElement).value)}
              class="w-full border-2 border-black p-2 font-bold"
            />
          </div>
        </div>

        <div>
          <span class="mb-1 block text-xs font-black uppercase text-slate-600">Durata</span>
          <div class="mb-2 flex flex-wrap gap-2">
            {#each [60, 90, 120] as d}
              <button
                type="button"
                class={'club-btn px-3 py-1 text-xs ' + (nuovaLezioneDurata === d ? '!bg-black !text-white' : '')}
                on:click={() => (nuovaLezioneDurata = d)}
              >
                {d === 60 ? '1h' : d === 90 ? '1h 30' : '2h'}
              </button>
            {/each}
          </div>
          <input type="number" min="30" max="480" step="15" bind:value={nuovaLezioneDurata} class="w-full border-2 border-black p-2 font-bold" />
        </div>

        <div>
          <span class="mb-1 flex items-center justify-between text-xs font-black uppercase text-slate-600">
            <span>Partecipanti</span>
            <span>{nuovaLezioneSelezionati.size} selezionati</span>
          </span>
          <div class="max-h-48 divide-y-2 divide-black overflow-y-auto border-2 border-black">
            {#each studentiPerGruppo as bucket (bucket.id || 'senza-gruppo')}
              {#if bucket.studenti.length}
                <div class="p-2">
                  <p class="mb-1 text-[0.65rem] font-black uppercase text-slate-500">{bucket.label}</p>
                  {#each bucket.studenti as s (s.id)}
                    <label class="flex items-center gap-2 py-0.5 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={nuovaLezioneSelezionati.has(s.id)}
                        on:change={() => toggleNuovaLezioneSelezionato(s.id)}
                      />
                      {s.cognome} {s.nome}
                    </label>
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-5 flex gap-3">
        <button type="button" class="club-btn flex-1 py-3" on:click={() => (nuovaLezioneAperta = false)}>Annulla</button>
        <button type="button" class="club-btn-yellow flex-1 py-3" disabled={salvandoLezione} on:click={salvaNuovaLezione}>
          {salvandoLezione ? 'Salvataggio…' : 'Crea'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if lezioneInModifica}
  <div class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4" on:click|self={chiudiModificaLezione}>
    <div class="club-card flex w-full max-w-sm flex-col bg-white p-5" style="max-height: 88vh;">
      <h3 class="mb-4 text-xl font-black">Modifica lezione</h3>

      <div class="space-y-3 overflow-y-auto pr-1">
        <div>
          <label for="ml-gruppo" class="mb-1 block text-xs font-black uppercase text-slate-600">Gruppo</label>
          <select
            id="ml-gruppo"
            value={lezioneInModifica.gruppo_id}
            on:change={(e) => onModificaGruppoChange((e.currentTarget as HTMLSelectElement).value)}
            class="w-full border-2 border-black p-2 font-bold"
          >
            {#each gruppi as g}
              <option value={g.id}>{g.nome}</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="ml-giorno" class="mb-1 block text-xs font-black uppercase text-slate-600">Giorno</label>
            <select id="ml-giorno" bind:value={lezioneInModifica.giorno_settimana} class="w-full border-2 border-black p-2 font-bold">
              {#each GIORNI as giorno, i}
                <option value={i + 1}>{giorno}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="ml-ora" class="mb-1 block text-xs font-black uppercase text-slate-600">Inizio</label>
            <input
              id="ml-ora"
              type="time"
              value={minutiToTime(lezioneInModifica.ora_inizio_minuti)}
              step="900"
              on:change={(e) => onModificaOraChange((e.currentTarget as HTMLInputElement).value)}
              class="w-full border-2 border-black p-2 font-bold"
            />
          </div>
        </div>

        <div>
          <label for="ml-durata" class="mb-1 block text-xs font-black uppercase text-slate-600">Durata (minuti)</label>
          <input
            id="ml-durata"
            type="number"
            min="30"
            max="480"
            step="15"
            bind:value={lezioneInModifica.durata_minuti}
            class="w-full border-2 border-black p-2 font-bold"
          />
        </div>

        <div>
          <span class="mb-1 flex items-center justify-between text-xs font-black uppercase text-slate-600">
            <span>Partecipanti</span>
            <span>{lezioneInModificaSelezionati.size} selezionati</span>
          </span>
          <div class="max-h-48 divide-y-2 divide-black overflow-y-auto border-2 border-black">
            {#each studentiPerGruppo as bucket (bucket.id || 'senza-gruppo')}
              {#if bucket.studenti.length}
                <div class="p-2">
                  <p class="mb-1 text-[0.65rem] font-black uppercase text-slate-500">{bucket.label}</p>
                  {#each bucket.studenti as s (s.id)}
                    <label class="flex items-center gap-2 py-0.5 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={lezioneInModificaSelezionati.has(s.id)}
                        on:change={() => toggleModificaSelezionato(s.id)}
                      />
                      {s.cognome} {s.nome}
                    </label>
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-5 flex gap-3">
        <button type="button" class="club-btn px-4 py-3 text-sm" on:click={eliminaLezione}>Elimina</button>
        <button type="button" class="club-btn flex-1 py-3" on:click={chiudiModificaLezione}>Annulla</button>
        <button type="button" class="club-btn-yellow flex-1 py-3" on:click={salvaModificaLezione}>Salva</button>
      </div>
    </div>
  </div>
{/if}

<div id="stampa-orario" aria-hidden="true">
  <h1 class="print-titolo">Orario settimanale — Scuola Tennis</h1>

  <div
    class="print-grid"
    style={`grid-template-rows: auto repeat(${stampaSlotsIdx.length}, minmax(7mm, auto));`}
  >
    <div class="print-corner"></div>

    {#each stampaGiorniIdx as dayIdx}
      <div class="print-day-header" style={`grid-column:${dayIdx + 2}`}>{GIORNI[dayIdx]}</div>
    {/each}

    {#each stampaHoursVisibili as hour, i}
      <div class="print-time-label" style={`grid-row:${i * SLOTS_PER_HOUR + 2} / span ${SLOTS_PER_HOUR}`}>{hour}:00</div>
    {/each}

    {#each stampaGiorniIdx as dayIdx}
      {#each stampaSlotsIdx as slotIdx, rowPos}
        <div
          class="print-cell"
          class:print-cell-hour={slotIdx % SLOTS_PER_HOUR === 0}
          style={`grid-column:${dayIdx + 2}; grid-row:${rowPos + 2}`}
        ></div>
      {/each}
    {/each}

    {#each stampaLezioni as l (l.id)}
      {@const g = gruppoById(l.gruppo_id)}
      {@const membri = studentiByIds(lezioneStudenti[l.id] ?? [])}
      <div class="print-block" style={stampaBlockStyle(l)}>
        <strong>{g?.nome ?? 'Gruppo eliminato'}</strong>
        <span class="print-orario">{fmtRange(l.ora_inizio_minuti, l.durata_minuti)}</span>
        {#if membri.length}
          <span class="print-membri">{membri.map(nomeBreve).join(', ')}</span>
        {/if}
      </div>
    {/each}
  </div>

  <div class="print-elenco">
    {#each studentiPerGruppo as bucket (bucket.id || 'senza-gruppo')}
      <div class="print-gruppo-blocco">
        <p class="print-gruppo-titolo">{bucket.label}:</p>
        {#each bucket.studenti as s (s.id)}
          {@const slot = slotsStudente(s.id)}
          <p class="print-studente-riga">
            <span>{s.cognome} {s.nome}</span>
            {#if slot.length}
              <span class="print-slot-elenco">{slot.join(' - ')}</span>
            {/if}
          </p>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .cal-scroll {
    max-height: 65vh;
    overflow: auto;
  }

  .leader-row {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .leader-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }

  .leader-dots {
    flex: 1;
    min-width: 0.5rem;
    border-bottom: 2px dotted rgba(0, 0, 0, 0.35);
    margin-bottom: 0.2em;
  }

  .leader-value {
    white-space: nowrap;
    opacity: 0.75;
  }

  .cal-grid {
    position: relative;
    display: grid;
    grid-template-columns: var(--time-col) repeat(7, minmax(5.5rem, 1fr));
    min-width: 46rem;
    user-select: none;
  }

  .cal-corner {
    grid-column: 1;
    grid-row: 1;
    position: sticky;
    top: 0;
    left: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border-bottom: 2px solid black;
    border-right: 2px solid black;
  }

  .cal-toggle-orario {
    font-weight: 900;
    font-size: 0.85rem;
    line-height: 1;
    color: black;
    text-decoration: none;
  }

  .cal-toggle-orario:hover {
    text-decoration: underline;
  }

  .cal-day-header {
    grid-row: 1;
    position: sticky;
    top: 0;
    z-index: 3;
    background: var(--giallo-club);
    border-bottom: 2px solid black;
    border-right: 2px solid black;
    padding: 0.5rem 0.25rem;
    text-align: center;
    font-weight: 900;
    text-transform: uppercase;
    font-size: 0.75rem;
  }

  .cal-time-label {
    grid-column: 1;
    position: sticky;
    left: 0;
    z-index: 2;
    background: white;
    border-right: 2px solid black;
    border-top: 1px solid rgba(0, 0, 0, 0.15);
    padding: 0.15rem 0.4rem;
    text-align: right;
    font-size: 0.7rem;
    font-weight: 800;
    color: #475569;
  }

  .cal-cell {
    border-right: 1px solid rgba(0, 0, 0, 0.1);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
  }

  .cal-cell-hour {
    border-top: 1px solid rgba(0, 0, 0, 0.3);
  }

  .cal-cell:hover {
    background: rgba(255, 204, 0, 0.15);
  }

  .cal-block {
    position: relative;
    margin: 1px 2px;
    padding: 0.25rem 0.4rem;
    border: 2px solid black;
    box-shadow: -3px 3px 0 rgba(0, 0, 0, 0.9);
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    z-index: 1;
  }

  .cal-block:active {
    cursor: grabbing;
  }

  .cal-block-title {
    font-weight: 900;
    font-size: 0.75rem;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cal-block-time {
    font-size: 0.65rem;
    font-weight: 700;
    opacity: 0.85;
  }

  .cal-block-members {
    margin-top: 0.15rem;
    font-size: 0.6rem;
    font-weight: 600;
    line-height: 1.2;
    opacity: 0.9;
  }

  .cal-handle {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 12px;
    cursor: ns-resize;
    touch-action: none;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 2px;
  }

  .cal-handle::after {
    content: '';
    width: 22px;
    height: 3px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6);
  }

  .cal-handle:hover::after {
    background: rgba(0, 0, 0, 0.8);
  }

  .print-titolo {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    font-weight: 900;
    text-transform: uppercase;
    color: black;
  }

  .print-grid {
    display: grid;
    grid-template-columns: 13mm repeat(5, 1fr);
    border-top: 1px solid black;
    border-left: 1px solid black;
    font-size: 0.65rem;
    color: black;
  }

  .print-corner,
  .print-day-header,
  .print-time-label,
  .print-cell,
  .print-block {
    border-right: 1px solid black;
    border-bottom: 1px solid black;
  }

  .print-corner {
    grid-column: 1;
    grid-row: 1;
  }

  .print-day-header {
    grid-row: 1;
    padding: 1mm;
    text-align: center;
    text-transform: uppercase;
    font-weight: 900;
    font-size: 0.7rem;
  }

  .print-time-label {
    grid-column: 1;
    padding: 0.5mm 1mm;
    text-align: right;
    white-space: nowrap;
    font-size: 0.6rem;
  }

  .print-cell-hour {
    border-top: 1px solid black;
  }

  .print-block {
    position: relative;
    z-index: 1;
    background: white;
    padding: 0.5mm 1mm;
    overflow-wrap: break-word;
    break-inside: avoid;
  }

  .print-orario,
  .print-membri {
    display: block;
  }

  .print-membri {
    font-size: 0.55rem;
  }

  .print-elenco {
    margin-top: 6mm;
    columns: 2;
    column-gap: 8mm;
    color: black;
  }

  .print-gruppo-blocco {
    break-inside: avoid;
    margin-bottom: 3mm;
  }

  .print-gruppo-titolo {
    margin: 0 0 0.5mm;
    font-weight: 900;
    text-transform: uppercase;
    font-size: 0.7rem;
  }

  .print-studente-riga {
    margin: 0;
    font-size: 0.6rem;
    line-height: 1.35;
  }

  .print-slot-elenco {
    margin-left: 0.35em;
    opacity: 0.75;
  }
</style>
