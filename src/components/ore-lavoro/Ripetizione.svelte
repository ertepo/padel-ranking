<script lang="ts">
  // "Ripeti fino al…": giorni della settimana da spuntare e data di fine.
  // Le date generate (da `dal` a `fino`) le calcola chi usa il componente con
  // dateRipetute; qui c'è solo la scelta.
  import { dateRipetute, fmtData, GIORNI_BREVI, isoDow, MAX_RIPETIZIONI } from '../../lib/time-grid';

  interface Props {
    /** La prima data (quella selezionata). */
    dal: string;
    attiva: boolean;
    giorni: number[];
    fino: string;
    /** Per gli id dei campi (più modali nella stessa pagina). */
    prefisso: string;
  }

  let { dal, attiva = $bindable(), giorni = $bindable(), fino = $bindable(), prefisso }: Props = $props();

  const n = $derived(attiva ? dateRipetute(dal, giorni, fino).length : 0);

  function cambia(g: number, on: boolean) {
    giorni = on ? [...new Set([...giorni, g])].sort() : giorni.filter((x) => x !== g);
  }

  function accendi(on: boolean) {
    attiva = on;
    if (on && giorni.length === 0 && dal) giorni = [isoDow(dal)];
  }
</script>

<div class="flex flex-col gap-3 border-2 border-black p-3">
  <label class="flex items-center gap-2 text-sm font-black uppercase">
    <input type="checkbox" class="h-5 w-5" checked={attiva} onchange={(e) => accendi(e.currentTarget.checked)} />
    Ripeti in questi giorni fino al…
  </label>

  {#if attiva}
    <div class="grid grid-cols-7 gap-1">
      {#each GIORNI_BREVI as g, i (g)}
        <label class="flex flex-col items-center gap-1 text-xs font-black uppercase">
          {g}
          <input type="checkbox" class="h-5 w-5" checked={giorni.includes(i + 1)} onchange={(e) => cambia(i + 1, e.currentTarget.checked)} />
        </label>
      {/each}
    </div>
    <div>
      <span id={`lbl-${prefisso}-fino`} class="mb-1.5 block text-xs font-black uppercase leading-tight text-slate-600">Fino al</span>
      <input id={`${prefisso}-fino`} aria-labelledby={`lbl-${prefisso}-fino`} type="date" min={dal} class="w-full border-2 border-black p-2 font-bold" bind:value={fino} />
    </div>
    <p class="text-sm font-bold text-slate-600">
      {#if !fino}
        Scegli la data di fine.
      {:else if n === 0}
        Nessuna data: controlla i giorni e la data di fine.
      {:else if n > MAX_RIPETIZIONI}
        Troppe date (massimo {MAX_RIPETIZIONI}).
      {:else}
        {n} {n === 1 ? 'data' : 'date'}, dal {fmtData(dal)} al {fmtData(fino)}.
      {/if}
    </p>
  {/if}
</div>
