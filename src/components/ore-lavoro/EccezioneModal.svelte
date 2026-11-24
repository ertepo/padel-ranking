<script lang="ts" module>
  import type { Attivita, Club } from '../../lib/ore-lavoro/types';

  /** Proposta con cui si apre il modale (da clic, selezione o ridimensionamento). */
  export interface ProspettoEccezione {
    id?: string;
    data: string;
    inizio: number;
    fine: number;
    assente_id: string | null;
    sostituto_id: string | null;
    club: Club;
    attivita: Attivita;
    note: string | null;
    /** Ora privata (pagata dal cliente, non conta nelle ore). */
    privata?: boolean;
    /** Il turno dell'assente, per il pulsante "tutto il turno". */
    turno?: { inizio: number; fine: number; staff_id: string };
    /** Se true il modale propone anche "nessuna eccezione" (solo il segno del giorno). */
    daTurno?: boolean;
    /** Proposta per l'orario ricorrente (aggiungere o cambiare un turno da questa data in poi). */
    ricorrente?: {
      staff_id: string;
      /** Turno esistente dell'orario (per modificarlo o toglierlo); assente = turno nuovo. */
      slot_id?: string;
      /** Proposta di nuovi orari del turno (se non c'è una fascia da togliere). */
      inizio: number;
      fine: number;
      club: Club;
      attivita: Attivita;
      /** Orari attuali del turno nell'orario (per mostrare prima e dopo). */
      attuale?: { inizio: number; fine: number };
      /** Fascia selezionata dentro il turno: da togliere dall'orario. */
      togliere?: { inizio: number; fine: number };
    };
    /** Con quale scheda aprire il modale. */
    ambito?: 'giorno' | 'ricorrente';
  }
</script>

<script lang="ts">
  // Modale per una singola eccezione (assenza, sostituzione, ore extra) e per
  // il segno "da verificare" del giorno del maestro mostrato.
  import type { Snippet } from 'svelte';
  import Modal from '../shared/Modal.svelte';
  import { fmtData, fmtFascia, GIORNI, isoDow, minutiToTime, timeToMinuti } from '../../lib/time-grid';
  import { ATTIVITA, CLUB, type Staff } from '../../lib/ore-lavoro/types';
  import { sottraiFasce } from '../../lib/ore-lavoro/segmenti';

  interface Props {
    staff: Staff[];
    /** Il maestro di cui si sta guardando il calendario. */
    persona: Staff;
    prospetto: ProspettoEccezione;
    daVerificare: boolean;
    onClose: () => void;
    onSaved: () => void;
    onErrore: (msg: string) => void;
    /** Modale largo a due colonne (kiosk, tablet in orizzontale). */
    largo?: boolean;
    /** Se c'è, in alto compare la scelta "Impegno | Tennis" e questo passa all'impegno. */
    onImpegno?: (p: { data: string; inizio: number; fine: number }) => void;
  }

  let { staff, persona, prospetto, daVerificare, onClose, onSaved, onErrore, largo = false, onImpegno }: Props = $props();

  type Tipo = 'nessuna' | 'assente' | 'sostituisco' | 'extra' | 'privata' | 'altro';

  function tipoDi(assente: string | null, sostituto: string | null, privata = false): Tipo {
    if (privata && !assente && sostituto === persona.id) return 'privata';
    if (assente === persona.id) return 'assente';
    if (sostituto === persona.id) return assente ? 'sostituisco' : 'extra';
    return 'altro';
  }

  // Valori iniziali presi una volta dal prospetto (il modale si ricrea a ogni apertura).
  const p = $state.snapshot(prospetto);
  let tipo: Tipo = $state(p.daTurno && !p.id ? 'assente' : tipoDi(p.assente_id, p.sostituto_id, p.privata));
  let assenteId: string | null = $state(p.assente_id);
  let sostitutoId: string | null = $state(p.sostituto_id);
  let data = $state(p.data);
  let oraInizio = $state(minutiToTime(p.inizio));
  let oraFine = $state(minutiToTime(p.fine));
  let club: Club = $state(p.club);
  let attivita: Attivita = $state(p.attivita);
  let note = $state(p.note ?? '');
  let verifica = $state(daVerificare);
  let salvando = $state(false);

  // Orario ricorrente
  const ric = p.ricorrente;
  let ambito: 'giorno' | 'ricorrente' = $state(ric && p.ambito === 'ricorrente' ? 'ricorrente' : 'giorno');
  let ricDal = $state(p.data);
  // Con una fascia selezionata dentro un turno esistente, "da qui in poi"
  // toglie solo quella fascia: il turno si accorcia o si divide in due.
  // (pezzi null = nessuna fascia da togliere; [] = la fascia copre tutto il turno.)
  const pezzi = ric?.slot_id && ric.attuale && ric.togliere ? sottraiFasce([ric.attuale], [ric.togliere]) : null;
  const proposta = pezzi?.length ? pezzi[0] : ric;
  const secondoPezzo = pezzi?.length === 2 ? pezzi[1] : null;
  let ricInizio = $state(minutiToTime(proposta?.inizio ?? p.inizio));
  let ricFine = $state(minutiToTime(proposta?.fine ?? p.fine));
  let ricClub: Club = $state(ric?.club ?? p.club);
  let ricAttivita: Attivita = $state(ric?.attivita ?? p.attivita);
  const giornoRic = isoDow(p.data);

  const io = persona.sono_io;
  const nome = persona.nome;
  const altri = $derived(staff.filter((s) => s.id !== persona.id && (s.tennis !== false || s.id === assenteId || s.id === sostitutoId) && (s.attivo || s.id === assenteId || s.id === sostitutoId)));
  const nomeDi = (id: string | null) => staff.find((s) => s.id === id)?.nome ?? '';

  function scegliTipo(t: Tipo) {
    tipo = t;
    if (t === 'assente') {
      assenteId = persona.id;
      if (sostitutoId === persona.id) sostitutoId = null;
    } else if (t === 'sostituisco') {
      sostitutoId = persona.id;
      if (assenteId === persona.id || !assenteId) assenteId = p.turno && p.turno.staff_id !== persona.id ? p.turno.staff_id : (altri[0]?.id ?? null);
    } else if (t === 'extra' || t === 'privata') {
      sostitutoId = persona.id;
      assenteId = null;
    }
  }

  const descrizione = $derived.by(() => {
    if (tipo === 'nessuna') return io ? 'Ho lavorato come da calendario (segna solo il giorno).' : `${nome} ha lavorato come da calendario.`;
    if (tipo === 'privata') {
      return `${io ? 'Ora privata' : `Ora privata di ${nome}`}: la paga il cliente, non conta nelle ore da farsi pagare.`;
    }
    // In prima persona quando il maestro mostrato sono io.
    const a = nomeDi(assenteId);
    const s = nomeDi(sostitutoId);
    const ioAssente = io && assenteId === persona.id;
    const ioSostituto = io && sostitutoId === persona.id;
    if (!assenteId && sostitutoId) return ioSostituto ? 'Faccio ore extra.' : `${s} fa ore extra.`;
    if (assenteId && !sostitutoId) return ioAssente ? 'Sono assente, senza sostituto.' : `${a} è assente, senza sostituto.`;
    if (assenteId && sostitutoId) {
      if (ioAssente) return `Sono assente, mi sostituisce ${s}.`;
      if (ioSostituto) return `${a} è assente, lo sostituisco io.`;
      return `${a} è assente, lo sostituisce ${s}.`;
    }
    return 'Indica chi è assente o chi lavora.';
  });

  async function chiama(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio.');
    return result;
  }

  async function salva() {
    const inizio = timeToMinuti(oraInizio);
    const fine = timeToMinuti(oraFine);
    if (tipo !== 'nessuna') {
      if (Number.isNaN(inizio) || Number.isNaN(fine) || fine <= inizio) return onErrore("L'ora di fine deve venire dopo quella di inizio.");
      if (!assenteId && !sostitutoId) return onErrore('Indica chi è assente o chi lavora.');
      if (assenteId && assenteId === sostitutoId) return onErrore('Assente e sostituto devono essere persone diverse.');
    }
    salvando = true;
    try {
      if (tipo !== 'nessuna') {
        const riga = {
          id: p.id,
          data,
          ora_inizio: minutiToTime(inizio),
          ora_fine: minutiToTime(fine),
          assente_id: assenteId,
          sostituto_id: sostitutoId,
          club,
          attivita,
          note,
          // Mandato solo se serve: prima della migrazione 20261129 la colonna non c'è.
          ...(tipo === 'privata' || p.privata ? { privata: tipo === 'privata' } : {}),
        };
        await chiama('/api/ore-lavoro/eccezioni', p.id ? 'PATCH' : 'POST', riga);
      }
      if (verifica !== daVerificare || data !== p.data) {
        await chiama('/api/ore-lavoro/giorno', 'PUT', { staff_id: persona.id, data, da_verificare: verifica });
      }
      onSaved();
    } catch (err) {
      onErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
    } finally {
      salvando = false;
    }
  }

  async function salvaOrario(togli = false) {
    if (!ric) return;
    const inizio = timeToMinuti(ricInizio);
    const fine = timeToMinuti(ricFine);
    if (!togli && (Number.isNaN(inizio) || Number.isNaN(fine) || fine <= inizio)) {
      return onErrore("L'ora di fine deve venire dopo quella di inizio.");
    }
    if (togli) {
      const quale = ric.attuale ? ` ${fmtFascia(ric.attuale.inizio, ric.attuale.fine)}` : '';
      const domanda = `Togliere TUTTO il turno del ${GIORNI[giornoRic - 1].toLowerCase()}${quale} dall'orario di ${nomeDi(ric.staff_id)}, dal ${fmtData(ricDal)} in poi?`;
      if (!confirm(domanda)) return;
    }
    const orari = { ora_inizio: minutiToTime(inizio), ora_fine: minutiToTime(fine), club: ricClub, attivita: ricAttivita };
    const ops: Record<string, unknown>[] = togli
      ? [{ op: 'delete', slot_id: ric.slot_id }]
      : ric.slot_id
        ? [{ op: 'update', slot_id: ric.slot_id, ...orari }]
        : [{ op: 'add', giorno_settimana: giornoRic, ...orari }];
    if (!togli && ric.slot_id && secondoPezzo) {
      ops.push({
        op: 'add',
        giorno_settimana: giornoRic,
        ora_inizio: minutiToTime(secondoPezzo.inizio),
        ora_fine: minutiToTime(secondoPezzo.fine),
        club: ricClub,
        attivita: ricAttivita,
      });
    }
    salvando = true;
    try {
      await chiama('/api/ore-lavoro/orario', 'POST', { staff_id: ric.staff_id, dal: ricDal, ops });
      onSaved();
    } catch (err) {
      onErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
    } finally {
      salvando = false;
    }
  }

  async function elimina() {
    if (!p.id || !confirm("Eliminare questa eccezione? Il turno torna come da calendario.")) return;
    salvando = true;
    try {
      await chiama('/api/ore-lavoro/eccezioni', 'DELETE', { id: p.id });
      onSaved();
    } catch (err) {
      onErrore(err instanceof Error ? err.message : "Errore nell'eliminazione.");
    } finally {
      salvando = false;
    }
  }

  const titolo = p.id ? 'Modifica eccezione' : 'Nuova eccezione';
  const opzioniTipo: [Tipo, string][] = [
    ...(p.daTurno && !p.id ? ([['nessuna', 'Lavorato']] as [Tipo, string][]) : []),
    ['assente', io ? 'Sono assente' : `${nome} assente`],
    ['sostituisco', io ? 'Sostituisco un collega' : `${nome} sostituisce`],
    ['extra', 'Ore extra'],
    ['privata', 'Ora privata'],
    ['altro', 'Tra colleghi'],
  ];
</script>

{#snippet colonne(sinistra: Snippet, destra: Snippet)}
  {#if largo}
    <div class="grid grid-cols-2 items-start gap-x-8">
      <div class="space-y-3">{@render sinistra()}</div>
      <div class="space-y-3">{@render destra()}</div>
    </div>
  {:else}
    {@render sinistra()}
    {@render destra()}
  {/if}
{/snippet}

{#snippet ricSinistra()}
    <div class="space-y-1 border-l-4 border-black pl-2 font-bold">
      {#if ric.slot_id && ric.attuale}
        <p>
          Turno attuale del {GIORNI[giornoRic - 1].toLowerCase()} di {nomeDi(ric.staff_id)}:
          <span class="whitespace-nowrap">{fmtFascia(ric.attuale.inizio, ric.attuale.fine)}</span>.
        </p>
        {#if ric.togliere && pezzi?.length}
          <p>
            Tolgo <span class="whitespace-nowrap bg-[var(--giallo-club)] px-1">{fmtFascia(ric.togliere.inizio, ric.togliere.fine)}</span>:
            dal {fmtData(ricDal)} il turno diventa
            {#if secondoPezzo}
              quello qui sotto e <span class="whitespace-nowrap">{fmtFascia(secondoPezzo.inizio, secondoPezzo.fine)}</span>.
            {:else}
              quello qui sotto.
            {/if}
          </p>
        {:else if ric.togliere}
          <p>La fascia selezionata copre tutto il turno: per toglierlo usa "Togli tutto il turno".</p>
        {:else}
          <p>Dal {fmtData(ricDal)} il turno diventa quello qui sotto.</p>
        {/if}
      {:else}
        <p>Aggiunge un turno del {GIORNI[giornoRic - 1].toLowerCase()} nell'orario di {nomeDi(ric.staff_id)}, dal {fmtData(ricDal)} in poi.</p>
      {/if}
      <p class="text-sm font-medium text-slate-600">I giorni precedenti restano come sono.</p>
    </div>
{/snippet}

{#snippet ricDestra()}
    <div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
      <div class="col-span-2 sm:col-span-1">
        <span id="lbl-ric-dal" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Dal</span>
        <input id="ric-dal" aria-labelledby="lbl-ric-dal" type="date" class="w-full border-2 border-black p-2 font-bold" bind:value={ricDal} required />
      </div>
      <div>
        <span id="lbl-ric-dalle" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Dalle</span>
        <input id="ric-dalle" aria-labelledby="lbl-ric-dalle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={ricInizio} required />
      </div>
      <div>
        <span id="lbl-ric-alle" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Alle</span>
        <input id="ric-alle" aria-labelledby="lbl-ric-alle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={ricFine} required />
      </div>
    </div>

    <div class="grid grid-cols-2 items-end gap-3">
      <div>
        <span id="lbl-ric-club" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Club</span>
        <select id="ric-club" aria-labelledby="lbl-ric-club" class="w-full border-2 border-black p-2 font-bold" bind:value={ricClub}>
          {#each Object.entries(CLUB) as [k, v] (k)}<option value={k}>{v}</option>{/each}
        </select>
      </div>
      <div>
        <span id="lbl-ric-attivita" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Attività</span>
        <select id="ric-attivita" aria-labelledby="lbl-ric-attivita" class="w-full border-2 border-black p-2 font-bold" bind:value={ricAttivita}>
          {#each Object.entries(ATTIVITA) as [k, v] (k)}<option value={k}>{v}</option>{/each}
        </select>
      </div>
    </div>
{/snippet}

{#snippet giornoSinistra()}
  <p class="text-sm font-black uppercase text-slate-600">
    {GIORNI[isoDow(data) - 1]} {fmtData(data)}
  </p>

  <div class="flex flex-wrap gap-1.5">
    {#each opzioniTipo as [t, etichetta] (t)}
      <button
        type="button"
        class="border-2 border-black px-2.5 py-1.5 text-xs font-black uppercase"
        class:bg-black={tipo === t}
        class:text-white={tipo === t}
        class:bg-white={tipo !== t}
        onclick={() => scegliTipo(t)}
      >
        {etichetta}
      </button>
    {/each}
  </div>

  <p class="border-l-4 border-black pl-2 font-bold leading-snug">{descrizione}</p>

  {#if tipo !== 'nessuna'}
    <div class="grid grid-cols-2 items-end gap-3">
      <div>
        <span id="lbl-ecc-assente" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Assente</span>
        <select id="ecc-assente" aria-labelledby="lbl-ecc-assente" class="w-full border-2 border-black p-2 font-bold" bind:value={assenteId}
          onchange={() => (tipo = tipoDi(assenteId, sostitutoId, tipo === 'privata'))}>
          <option value={null}>— nessuno —</option>
          <option value={persona.id}>{nome}</option>
          {#each altri as s (s.id)}<option value={s.id}>{s.nome}</option>{/each}
        </select>
      </div>
      <div>
        <span id="lbl-ecc-sostituto" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Lavora al suo posto</span>
        <select id="ecc-sostituto" aria-labelledby="lbl-ecc-sostituto" class="w-full border-2 border-black p-2 font-bold" bind:value={sostitutoId}
          onchange={() => (tipo = tipoDi(assenteId, sostitutoId, tipo === 'privata'))}>
          <option value={null}>— nessuno —</option>
          <option value={persona.id}>{nome}</option>
          {#each altri as s (s.id)}<option value={s.id}>{s.nome}</option>{/each}
        </select>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet giornoDestra()}
  {#if tipo !== 'nessuna'}
    <div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
      <div class="col-span-2 sm:col-span-1">
        <span id="lbl-ecc-data" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Data</span>
        <input id="ecc-data" aria-labelledby="lbl-ecc-data" type="date" class="w-full border-2 border-black p-2 font-bold" bind:value={data} required />
      </div>
      <div>
        <span id="lbl-ecc-dalle" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Dalle</span>
        <input id="ecc-dalle" aria-labelledby="lbl-ecc-dalle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={oraInizio} required />
      </div>
      <div>
        <span id="lbl-ecc-alle" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Alle</span>
        <input id="ecc-alle" aria-labelledby="lbl-ecc-alle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={oraFine} required />
      </div>
    </div>

    {#if p.turno}
      {@const turno = p.turno}
      <button
        type="button"
        class="block text-left text-xs font-black uppercase leading-snug underline"
        onclick={() => {
          oraInizio = minutiToTime(turno.inizio);
          oraFine = minutiToTime(turno.fine);
        }}
      >
        Tutto il turno di {nomeDi(turno.staff_id)} ({fmtFascia(turno.inizio, turno.fine)})
      </button>
    {/if}

    <div class="grid grid-cols-2 items-end gap-3">
      <div>
        <span id="lbl-ecc-club" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Club</span>
        <select id="ecc-club" aria-labelledby="lbl-ecc-club" class="w-full border-2 border-black p-2 font-bold" bind:value={club}>
          {#each Object.entries(CLUB) as [k, v] (k)}<option value={k}>{v}</option>{/each}
        </select>
      </div>
      <div>
        <span id="lbl-ecc-attivita" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Attività</span>
        <select id="ecc-attivita" aria-labelledby="lbl-ecc-attivita" class="w-full border-2 border-black p-2 font-bold" bind:value={attivita}>
          {#each Object.entries(ATTIVITA) as [k, v] (k)}<option value={k}>{v}</option>{/each}
        </select>
      </div>
    </div>

    <div>
      <span id="lbl-ecc-note" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Note (facoltative)</span>
      <textarea id="ecc-note" aria-labelledby="lbl-ecc-note" rows="2" class="w-full border-2 border-black p-2 font-medium" bind:value={note}></textarea>
    </div>
  {/if}

  <label class="flex items-center gap-2 border-t-2 border-black/20 pt-3 font-bold">
    <input type="checkbox" bind:checked={verifica} />
    Giorno da verificare{io ? '' : ` (${nome})`}
  </label>
{/snippet}

<Modal titolo={ambito === 'ricorrente' ? 'Orario ricorrente' : titolo} {onClose} larghezza={largo ? 'max-w-4xl' : 'max-w-md'} compatta={largo} altezzaFissa>
  {#if onImpegno}
    <div class="grid grid-cols-2 border-2 border-black text-xs font-black uppercase">
      <button type="button" class="px-2 py-2"
        onclick={() => onImpegno?.({ data, inizio: timeToMinuti(oraInizio), fine: timeToMinuti(oraFine) })}>Impegno</button>
      <button type="button" class="border-l-2 border-black bg-black px-2 py-2 text-white">Tennis</button>
    </div>
  {/if}
  {#if ric}
    <div class="grid grid-cols-2 border-2 border-black text-xs font-black uppercase">
      <button type="button" class="px-2 py-2" class:bg-black={ambito === 'giorno'} class:text-white={ambito === 'giorno'}
        onclick={() => (ambito = 'giorno')}>
        Solo {GIORNI[isoDow(p.data) - 1].toLowerCase()} {fmtData(p.data).slice(0, 5)}
      </button>
      <button type="button" class="border-l-2 border-black px-2 py-2" class:bg-black={ambito === 'ricorrente'}
        class:text-white={ambito === 'ricorrente'} onclick={() => (ambito = 'ricorrente')}>
        Ogni {GIORNI[giornoRic - 1].toLowerCase()} da qui in poi
      </button>
    </div>
  {/if}

  {#if ambito === 'ricorrente' && ric}
    {@render colonne(ricSinistra, ricDestra)}
  {:else}
    {@render colonne(giornoSinistra, giornoDestra)}
  {/if}

  {#snippet azioni()}
    <button type="button" class="club-btn flex-1 py-3" onclick={onClose}>Annulla</button>
    {#if ambito === 'ricorrente' && ric}
      {#if ric.slot_id}
        <button type="button" class="club-btn-red flex-1 py-3" disabled={salvando} onclick={() => salvaOrario(true)}>Togli tutto il turno</button>
      {/if}
      <button type="button" class="club-btn-yellow flex-1 py-3" disabled={salvando} onclick={() => salvaOrario()}>
        {salvando ? 'Salvataggio…' : 'Salva orario'}
      </button>
    {:else}
      {#if p.id}
        <button type="button" class="club-btn-red flex-1 py-3" disabled={salvando} onclick={elimina}>Elimina</button>
      {/if}
      <button type="button" class="club-btn-yellow flex-1 py-3" disabled={salvando} onclick={salva}>
        {salvando ? 'Salvataggio…' : 'Salva'}
      </button>
    {/if}
  {/snippet}
</Modal>
