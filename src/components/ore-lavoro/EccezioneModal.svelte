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
    /** Il turno dell'assente, per il pulsante "tutto il turno". */
    turno?: { inizio: number; fine: number; staff_id: string };
    /** Se true il modale propone anche "nessuna eccezione" (solo il segno del giorno). */
    daTurno?: boolean;
  }
</script>

<script lang="ts">
  // Modale per una singola eccezione (assenza, sostituzione, ore extra) e per
  // il segno "da verificare" del giorno del maestro mostrato.
  import Modal from '../shared/Modal.svelte';
  import { fmtData, fmtFascia, GIORNI, isoDow, minutiToTime, timeToMinuti } from '../../lib/time-grid';
  import { ATTIVITA, CLUB, type Staff } from '../../lib/ore-lavoro/types';

  interface Props {
    staff: Staff[];
    /** Il maestro di cui si sta guardando il calendario. */
    persona: Staff;
    prospetto: ProspettoEccezione;
    daVerificare: boolean;
    onClose: () => void;
    onSaved: () => void;
    onErrore: (msg: string) => void;
  }

  let { staff, persona, prospetto, daVerificare, onClose, onSaved, onErrore }: Props = $props();

  type Tipo = 'nessuna' | 'assente' | 'sostituisco' | 'extra' | 'altro';

  function tipoDi(assente: string | null, sostituto: string | null): Tipo {
    if (assente === persona.id) return 'assente';
    if (sostituto === persona.id) return assente ? 'sostituisco' : 'extra';
    return 'altro';
  }

  // Valori iniziali presi una volta dal prospetto (il modale si ricrea a ogni apertura).
  const p = $state.snapshot(prospetto);
  let tipo: Tipo = $state(p.daTurno && !p.id ? 'assente' : tipoDi(p.assente_id, p.sostituto_id));
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

  const io = persona.sono_io;
  const nome = persona.nome;
  const altri = $derived(staff.filter((s) => s.id !== persona.id && (s.attivo || s.id === assenteId || s.id === sostitutoId)));
  const nomeDi = (id: string | null) => staff.find((s) => s.id === id)?.nome ?? '';

  function scegliTipo(t: Tipo) {
    tipo = t;
    if (t === 'assente') {
      assenteId = persona.id;
      if (sostitutoId === persona.id) sostitutoId = null;
    } else if (t === 'sostituisco') {
      sostitutoId = persona.id;
      if (assenteId === persona.id || !assenteId) assenteId = p.turno && p.turno.staff_id !== persona.id ? p.turno.staff_id : (altri[0]?.id ?? null);
    } else if (t === 'extra') {
      sostitutoId = persona.id;
      assenteId = null;
    }
  }

  const descrizione = $derived.by(() => {
    if (tipo === 'nessuna') return io ? 'Ho lavorato come da calendario (segna solo il giorno).' : `${nome} ha lavorato come da calendario.`;
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
    ['altro', 'Tra colleghi'],
  ];
</script>

<Modal {titolo} {onClose} larghezza="max-w-md">
  <p class="text-sm font-black uppercase text-slate-600">
    {GIORNI[isoDow(data) - 1]} {fmtData(data)}
  </p>

  <div class="flex flex-wrap gap-1">
    {#each opzioniTipo as [t, etichetta] (t)}
      <button
        type="button"
        class="border-2 border-black px-2 py-1 text-xs font-black uppercase"
        class:bg-black={tipo === t}
        class:text-white={tipo === t}
        class:bg-white={tipo !== t}
        onclick={() => scegliTipo(t)}
      >
        {etichetta}
      </button>
    {/each}
  </div>

  <p class="border-l-4 border-black pl-2 font-bold">{descrizione}</p>

  {#if tipo !== 'nessuna'}
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="ecc-assente" class="mb-1 block text-xs font-black uppercase text-slate-600">Assente</label>
        <select id="ecc-assente" class="w-full border-2 border-black p-2 font-bold" bind:value={assenteId}
          onchange={() => (tipo = tipoDi(assenteId, sostitutoId))}>
          <option value={null}>— nessuno —</option>
          <option value={persona.id}>{nome}</option>
          {#each altri as s (s.id)}<option value={s.id}>{s.nome}</option>{/each}
        </select>
      </div>
      <div>
        <label for="ecc-sostituto" class="mb-1 block text-xs font-black uppercase text-slate-600">Lavora al suo posto</label>
        <select id="ecc-sostituto" class="w-full border-2 border-black p-2 font-bold" bind:value={sostitutoId}
          onchange={() => (tipo = tipoDi(assenteId, sostitutoId))}>
          <option value={null}>— nessuno —</option>
          <option value={persona.id}>{nome}</option>
          {#each altri as s (s.id)}<option value={s.id}>{s.nome}</option>{/each}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div>
        <label for="ecc-data" class="mb-1 block text-xs font-black uppercase text-slate-600">Data</label>
        <input id="ecc-data" type="date" class="w-full border-2 border-black p-2 font-bold" bind:value={data} required />
      </div>
      <div>
        <label for="ecc-dalle" class="mb-1 block text-xs font-black uppercase text-slate-600">Dalle</label>
        <input id="ecc-dalle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={oraInizio} required />
      </div>
      <div>
        <label for="ecc-alle" class="mb-1 block text-xs font-black uppercase text-slate-600">Alle</label>
        <input id="ecc-alle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={oraFine} required />
      </div>
    </div>

    {#if p.turno}
      {@const turno = p.turno}
      <button
        type="button"
        class="text-xs font-black uppercase underline"
        onclick={() => {
          oraInizio = minutiToTime(turno.inizio);
          oraFine = minutiToTime(turno.fine);
        }}
      >
        Tutto il turno di {nomeDi(turno.staff_id)} ({fmtFascia(turno.inizio, turno.fine)})
      </button>
    {/if}

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="ecc-club" class="mb-1 block text-xs font-black uppercase text-slate-600">Club</label>
        <select id="ecc-club" class="w-full border-2 border-black p-2 font-bold" bind:value={club}>
          {#each Object.entries(CLUB) as [k, v] (k)}<option value={k}>{v}</option>{/each}
        </select>
      </div>
      <div>
        <label for="ecc-attivita" class="mb-1 block text-xs font-black uppercase text-slate-600">Attività</label>
        <select id="ecc-attivita" class="w-full border-2 border-black p-2 font-bold" bind:value={attivita}>
          {#each Object.entries(ATTIVITA) as [k, v] (k)}<option value={k}>{v}</option>{/each}
        </select>
      </div>
    </div>

    <div>
      <label for="ecc-note" class="mb-1 block text-xs font-black uppercase text-slate-600">Note (facoltative)</label>
      <textarea id="ecc-note" rows="2" class="w-full border-2 border-black p-2 font-medium" bind:value={note}></textarea>
    </div>
  {/if}

  <label class="flex items-center gap-2 border-t-2 border-black pt-3 font-bold">
    <input type="checkbox" bind:checked={verifica} />
    Giorno da verificare{io ? '' : ` (${nome})`}
  </label>

  {#snippet azioni()}
    <button type="button" class="club-btn flex-1 py-3" onclick={onClose}>Annulla</button>
    {#if p.id}
      <button type="button" class="club-btn-red flex-1 py-3" disabled={salvando} onclick={elimina}>Elimina</button>
    {/if}
    <button type="button" class="club-btn-yellow flex-1 py-3" disabled={salvando} onclick={salva}>
      {salvando ? 'Salvataggio…' : 'Salva'}
    </button>
  {/snippet}
</Modal>
