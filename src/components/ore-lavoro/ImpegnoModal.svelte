<script lang="ts" module>
  import type { ColoreImpegno } from '../../lib/ore-lavoro/types';

  /** Proposta con cui si apre il modale: un impegno nuovo o da modificare. */
  export interface ProspettoImpegno {
    id?: string;
    staff_id: string;
    data: string;
    inizio: number;
    fine: number;
    titolo: string;
    colore: ColoreImpegno;
    note: string | null;
    gruppo_id?: string | null;
  }
</script>

<script lang="ts">
  // Modale di un impegno personale: titolo, di chi è, colore, una o più date
  // ("ripeti impegno"), orari e note. Non entra nel conteggio delle ore.
  import type { Snippet } from 'svelte';
  import Modal from '../shared/Modal.svelte';
  import Ripetizione from './Ripetizione.svelte';
  import { addGiorni, dateRipetute, fmtData, GIORNI, isoDow, MAX_RIPETIZIONI, minutiToTime, timeToMinuti } from '../../lib/time-grid';
  import { COLORI_IMPEGNO, type Staff } from '../../lib/ore-lavoro/types';

  interface Props {
    prospetto: ProspettoImpegno;
    /** Le persone a cui può appartenere l'impegno (chi si sta guardando e chi gli è affiancato). */
    persone: Staff[];
    /** Modale largo a due colonne (kiosk). */
    largo?: boolean;
    /** Se c'è, in alto compare la scelta "Impegno | Tennis" e questo passa al tennis. */
    onTennis?: (p: { data: string; inizio: number; fine: number }) => void;
    onClose: () => void;
    onSaved: () => void;
    onErrore: (msg: string) => void;
  }

  let { prospetto, persone, largo = false, onTennis, onClose, onSaved, onErrore }: Props = $props();

  const p = prospetto;
  let staffId = $state(p.staff_id);
  let titolo = $state(p.titolo);
  let colore: ColoreImpegno = $state(p.colore);
  let note = $state(p.note ?? '');
  let date = $state([p.data]);
  let oraInizio = $state(minutiToTime(p.inizio));
  let oraFine = $state(minutiToTime(p.fine));
  let salvando = $state(false);
  // "Ripeti in questi giorni fino al…": si somma alle date scritte a mano.
  let ripeti = $state(false);
  let ripGiorni: number[] = $state([isoDow(p.data)]);
  let ripFino = $state('');
  let chiediElimina = $state(false);

  const NOMI_COLORI: Record<ColoreImpegno, string> = {
    rosso: 'Rosso', arancio: 'Arancio', giallo: 'Giallo', verde: 'Verde', acqua: 'Acqua', azzurro: 'Azzurro', viola: 'Viola', rosa: 'Rosa',
  };

  /** Una data in più: di norma la settimana dopo l'ultima. */
  function aggiungiData() {
    const ultima = date[date.length - 1];
    date = [...date, ultima ? addGiorni(ultima, 7) : p.data];
  }

  function togliData(i: number) {
    date = date.filter((_, j) => j !== i);
  }

  async function chiama(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) {
    const res = await fetch('/api/ore-lavoro/impegni', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio.');
  }

  async function salva() {
    if (!titolo.trim()) return onErrore('Scrivi un titolo.');
    if (date.some((d) => !d)) return onErrore('Manca una data.');
    if (timeToMinuti(oraFine) <= timeToMinuti(oraInizio)) return onErrore("L'ora di fine deve venire dopo quella di inizio.");
    let tutte = date;
    if (ripeti) {
      if (!ripFino) return onErrore('Scegli fino a quando ripetere.');
      const generate = dateRipetute(date[0], ripGiorni, ripFino);
      if (generate.length === 0) return onErrore('Nessuna data nella ripetizione: controlla i giorni e la data di fine.');
      // La prima resta quella dell'impegno (anche se il suo giorno non è spuntato).
      tutte = [...new Set([date[0], ...date.slice(1), ...generate])];
      tutte = [tutte[0], ...tutte.slice(1).sort()];
    }
    if (tutte.length > MAX_RIPETIZIONI) return onErrore(`Troppe date (massimo ${MAX_RIPETIZIONI}).`);
    const campi = { staff_id: staffId, ora_inizio: oraInizio, ora_fine: oraFine, titolo, colore, note: note.trim() || null };
    salvando = true;
    try {
      if (p.id) {
        await chiama('PATCH', { id: p.id, data: tutte[0], ...campi });
        if (tutte.length > 1) await chiama('POST', { ...campi, date: tutte.slice(1), ripeti_di: p.id });
      } else {
        await chiama('POST', { ...campi, date: tutte });
      }
      onSaved();
    } catch (err) {
      onErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
    } finally {
      salvando = false;
    }
  }

  async function elimina(quali: 'questo' | 'da_qui' | 'tutte' = 'questo') {
    if (!p.id) return;
    salvando = true;
    try {
      await chiama('DELETE', { id: p.id, ...(quali === 'tutte' ? { tutte: true } : quali === 'da_qui' ? { da_qui: true } : {}) });
      onSaved();
    } catch (err) {
      onErrore(err instanceof Error ? err.message : "Errore nell'eliminazione.");
    } finally {
      salvando = false;
    }
  }

  const giornoDi = (d: string) => (d ? `${GIORNI[isoDow(d) - 1].toLowerCase()} ${fmtData(d).slice(0, 5)}` : '');
</script>

{#snippet colonne(sinistra: Snippet, destra: Snippet)}
  {#if largo}
    <div class="grid grid-cols-2 items-start gap-x-8">
      <div class="flex flex-col gap-3">{@render sinistra()}</div>
      <div class="flex flex-col gap-3">{@render destra()}</div>
    </div>
  {:else}
    {@render sinistra()}
    {@render destra()}
  {/if}
{/snippet}

{#snippet sinistra()}
  <div>
    <span id="lbl-imp-titolo" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Titolo</span>
    <input id="imp-titolo" aria-labelledby="lbl-imp-titolo" class="w-full border-2 border-black p-2 font-bold" maxlength="80" placeholder="Es. dentista, cena, palestra" bind:value={titolo} />
  </div>

  {#if persone.length > 1}
    <div>
      <p class="mb-1.5 text-xs font-black uppercase leading-tight text-slate-600">Di chi è</p>
      <div class="flex flex-wrap gap-1.5">
        {#each persone as s (s.id)}
          <button type="button" class="border-2 border-black px-3 py-1.5 text-sm font-black" class:bg-black={staffId === s.id}
            class:text-white={staffId === s.id} class:bg-white={staffId !== s.id} onclick={() => (staffId = s.id)}>{s.nome}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div>
    <p class="mb-1.5 text-xs font-black uppercase leading-tight text-slate-600">Colore</p>
    <div class="flex flex-wrap gap-2.5 p-1">
      {#each Object.entries(COLORI_IMPEGNO) as [k, hex] (k)}
        <button
          type="button"
          class="imp-colore"
          class:imp-colore-scelto={colore === k}
          style={`background:${hex}`}
          title={NOMI_COLORI[k as ColoreImpegno]}
          aria-label={NOMI_COLORI[k as ColoreImpegno]}
          aria-pressed={colore === k}
          onclick={() => (colore = k as ColoreImpegno)}
        ></button>
      {/each}
    </div>
  </div>

  <div>
    <span id="lbl-imp-note" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Note (facoltative)</span>
    <textarea id="imp-note" aria-labelledby="lbl-imp-note" rows="2" class="w-full border-2 border-black p-2 font-medium" bind:value={note}></textarea>
  </div>
{/snippet}

{#snippet destra()}
  <div class="grid grid-cols-2 items-end gap-3">
    <div>
      <span id="lbl-imp-dalle" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Dalle</span>
      <input id="imp-dalle" aria-labelledby="lbl-imp-dalle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={oraInizio} required />
    </div>
    <div>
      <span id="lbl-imp-alle" class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Alle</span>
      <input id="imp-alle" aria-labelledby="lbl-imp-alle" type="time" step="300" class="w-full border-2 border-black p-2 font-bold" bind:value={oraFine} required />
    </div>
  </div>

  <div class="flex flex-col gap-3">
    {#each date as d, i (i)}
      <div>
        <span id={`lbl-imp-data-${i}`} class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">
          {i === 0 ? 'Data' : `Ripetizione ${i}`}{d ? ` · ${giornoDi(d)}` : ''}
        </span>
        <div class="flex gap-2">
          <input id={`imp-data-${i}`} aria-labelledby={`lbl-imp-data-${i}`} type="date" class="min-w-0 flex-1 border-2 border-black p-2 font-bold" bind:value={date[i]} required />
          {#if i > 0}
            <button type="button" class="border-2 border-black bg-white px-3 font-black" aria-label={`Togli la ripetizione ${i}`} onclick={() => togliData(i)}>✕</button>
          {/if}
        </div>
      </div>
    {/each}
    <button type="button" class="self-start text-sm font-black uppercase underline" onclick={aggiungiData}>+ ripeti impegno</button>
  </div>

  <Ripetizione dal={date[0] ?? p.data} bind:attiva={ripeti} bind:giorni={ripGiorni} bind:fino={ripFino} prefisso="imp" />
{/snippet}

<Modal titolo={p.id ? 'Impegno' : 'Nuovo impegno'} {onClose} larghezza={largo ? 'max-w-4xl' : 'max-w-md'} compatta={largo} altezzaFissa>
  {#if chiediElimina}
    <div class="flex flex-col gap-3 border-l-4 border-black pl-3 font-bold leading-snug">
      <p>"{p.titolo}" si ripete:</p>
      <p><span class="font-black">Solo {giornoDi(p.data)}</span>: tolgo solo questo.</p>
      <p><span class="font-black">Da qui in poi</span>: tolgo questo e quelli dei giorni dopo; quelli prima restano.</p>
      <p><span class="font-black">Tutte</span>: tolgo tutte le ripetizioni, anche quelle passate.</p>
    </div>
  {:else}
  {#if onTennis}
    <div class="grid grid-cols-2 border-2 border-black text-xs font-black uppercase">
      <button type="button" class="bg-black px-2 py-2 text-white">Impegno</button>
      <button type="button" class="border-l-2 border-black px-2 py-2"
        onclick={() => onTennis?.({ data: date[0] || p.data, inizio: timeToMinuti(oraInizio), fine: timeToMinuti(oraFine) })}>Tennis</button>
    </div>
  {/if}

  {@render colonne(sinistra, destra)}
  {/if}

  {#snippet azioni()}
    {#if chiediElimina}
      <button type="button" class="club-btn flex-1 py-3" onclick={() => (chiediElimina = false)}>Indietro</button>
      <button type="button" class="club-btn-red flex-1 py-3 text-sm" disabled={salvando} onclick={() => elimina('questo')}>Solo questo</button>
      <button type="button" class="club-btn-red flex-1 py-3 text-sm" disabled={salvando} onclick={() => elimina('da_qui')}>Da qui in poi</button>
      <button type="button" class="club-btn-red flex-1 py-3 text-sm" disabled={salvando} onclick={() => elimina('tutte')}>Tutte</button>
    {:else}
      <button type="button" class="club-btn flex-1 py-3" onclick={onClose}>Annulla</button>
      {#if p.id}
        <button type="button" class="club-btn-red flex-1 py-3" disabled={salvando}
          onclick={() => (p.gruppo_id ? (chiediElimina = true) : elimina())}>Elimina</button>
      {/if}
      <button type="button" class="club-btn-yellow flex-1 py-3" disabled={salvando} onclick={salva}>
        {salvando ? 'Salvataggio…' : 'Salva'}
      </button>
    {/if}
  {/snippet}
</Modal>

<style>
  .imp-colore {
    width: 2.25rem;
    height: 2.25rem;
    border: 2px solid black;
  }

  .imp-colore-scelto {
    outline: 3px solid black;
    outline-offset: 2px;
  }
</style>
