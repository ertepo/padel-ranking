<script lang="ts" generics="T extends BloccoGriglia">
  // La settimana come agenda, per lo smartphone: un riquadro per giorno con i
  // suoi turni in lista (gli stessi blocchi della griglia, toccabili) e un
  // pulsante per aggiungere ore extra o una sostituzione.
  import type { BloccoGriglia, ColonnaGriglia } from '../shared/WeekGrid.svelte';
  import { fmtFascia } from '../../lib/time-grid';

  interface Props {
    colonne: ColonnaGriglia[];
    blocchi: T[];
    /** Blocchi "di contorno" (colleghi): più piccoli e tratteggiati. */
    secondario: (b: T) => boolean;
    sottotitolo?: (b: T) => string | undefined;
    onBlocco: (b: T) => void;
    onAggiungi: (colonna: number) => void;
  }

  let { colonne, blocchi, secondario, sottotitolo, onBlocco, onAggiungi }: Props = $props();

  const perColonna = $derived(
    colonne.map((_, i) => blocchi.filter((b) => b.colonna === i).sort((a, b) => a.inizio - b.inizio || a.fine - b.fine)),
  );
</script>

<div class="space-y-3">
  {#each colonne as c, i (c.key)}
    {@const lista = perColonna[i]}
    {@const principali = lista.filter((b) => !secondario(b))}
    {@const colleghi = lista.filter((b) => secondario(b))}
    <div class="border-2 border-black bg-white" class:ag-oggi={c.evidenziata}>
      <div class="ag-testa flex items-center justify-between gap-2 px-3 py-2">
        <p class="font-black uppercase">
          {c.label} <span class="font-bold normal-case">{c.sublabel}</span>
        </p>
        <button
          type="button"
          class="ag-piu border-2 border-black bg-white px-3 py-1 text-sm font-black"
          aria-label={`Aggiungi ore ${c.label} ${c.sublabel ?? ''}`}
          onclick={() => onAggiungi(i)}
        >
          +
        </button>
      </div>

      {#if principali.length || colleghi.length}
        <ul class="space-y-1.5 p-2">
          {#each principali as b (b.id)}
            <li>
              <button type="button" class="ag-blocco" style={`background:${b.colore}`} onclick={() => onBlocco(b)}>
                <span class="ag-ora">{fmtFascia(b.inizio, b.fine)}</span>
                <span class="ag-titolo">{b.titolo}</span>
                {#if sottotitolo?.(b)}<span class="ag-nota">{sottotitolo(b)}</span>{/if}
              </button>
            </li>
          {/each}
          {#each colleghi as b (b.id)}
            <li>
              <button type="button" class="ag-blocco ag-collega" style={`background:${b.colore}`} onclick={() => onBlocco(b)}>
                <span class="ag-ora">{fmtFascia(b.inizio, b.fine)}</span>
                <span class="ag-titolo">{b.titolo}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="px-3 pb-2 text-sm font-bold text-slate-500">Nessun turno</p>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ag-testa {
    border-bottom: 2px solid black;
    background: var(--giallo-club);
  }

  .ag-oggi .ag-testa {
    background: black;
    color: var(--giallo-club);
  }

  .ag-piu {
    color: black;
    min-width: 2.75rem;
    min-height: 2.25rem;
  }

  .ag-blocco,
  .ag-piu {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .ag-blocco {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.6rem;
    align-items: baseline;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.45rem 0.6rem;
    border: 2px solid black;
    box-shadow: -3px 3px 0 black;
    text-align: left;
  }

  .ag-collega {
    border-style: dashed;
    box-shadow: none;
    min-height: 2.25rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
  }

  .ag-ora {
    font-weight: 900;
    white-space: nowrap;
  }

  .ag-titolo {
    font-weight: 800;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .ag-nota {
    grid-column: 2;
    font-size: 0.8rem;
    font-weight: 600;
    opacity: 0.85;
  }
</style>
