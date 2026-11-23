<script lang="ts" module>
  export interface ColonnaGriglia {
    key: string;
    label: string;
    sublabel?: string;
    /** Evidenzia la colonna (es. oggi). */
    evidenziata?: boolean;
  }

  export interface BloccoGriglia {
    id: string;
    /** Indice della colonna, da 0. */
    colonna: number;
    /** Minuti dalla mezzanotte. */
    inizio: number;
    fine: number;
    colore?: string;
    /** Classi aggiuntive del blocco (es. 'wg-block-tratteggiato'). */
    classe?: string;
    titolo?: string;
  }
</script>

<script lang="ts" generics="T extends BloccoGriglia">
  // Griglia oraria a colonne (giorni) con slot regolari, sullo stile del
  // calendario della scuola tennis. Di default mostra solo le ore occupate
  // dai blocchi (più minimoVisibile), con un link per vedere tutto il range.
  // I blocchi sovrapposti nella stessa colonna vengono affiancati in corsie.
  import type { Snippet } from 'svelte';
  import { assegnaCorsie, fasciaVisibile, fmtFascia, type Fascia } from '../../lib/time-grid';

  interface Props {
    colonne: ColonnaGriglia[];
    blocchi: T[];
    slotMin?: number;
    slotPx?: number;
    timeColPx?: number;
    limiteInizio?: number;
    limiteFine?: number;
    minimoVisibile?: Partial<Fascia>;
    mostraToggle?: boolean;
    onCellClick?: (colonna: number, minuti: number) => void;
    onBlockClick?: (blocco: T) => void;
    onBlockPointerDown?: (e: PointerEvent, blocco: T) => void;
    blocco?: Snippet<[T]>;
    gridEl?: HTMLDivElement;
  }

  let {
    colonne,
    blocchi,
    slotMin = 30,
    slotPx = 40,
    timeColPx = 52,
    limiteInizio = 12 * 60,
    limiteFine = 24 * 60,
    minimoVisibile,
    mostraToggle = true,
    onCellClick,
    onBlockClick,
    onBlockPointerDown,
    blocco,
    gridEl = $bindable(),
  }: Props = $props();

  let mostraTutto = $state(false);

  const fascia = $derived(
    mostraTutto ? { inizio: limiteInizio, fine: limiteFine } : fasciaVisibile(blocchi, limiteInizio, limiteFine, minimoVisibile),
  );
  const nSlot = $derived(Math.round((fascia.fine - fascia.inizio) / slotMin));
  const slots = $derived(Array.from({ length: nSlot }, (_, i) => fascia.inizio + i * slotMin));
  const ore = $derived(slots.filter((m) => m % 60 === 0));
  const visibili = $derived(blocchi.filter((b) => b.fine > fascia.inizio && b.inizio < fascia.fine));
  const corsie = $derived(assegnaCorsie(visibili));

  function riga(minuti: number) {
    return Math.round((minuti - fascia.inizio) / slotMin) + 2;
  }

  function stileBlocco(b: T) {
    const inizio = Math.max(2, riga(b.inizio));
    const fine = Math.min(nSlot + 2, riga(b.fine));
    const { corsia, corsie: n } = corsie.get(b) ?? { corsia: 0, corsie: 1 };
    const colore = b.colore || '#94a3b8';
    const larghezza = `calc((100% - 4px) / ${n})`;
    return [
      `grid-column:${b.colonna + 2}`,
      `grid-row:${inizio} / span ${Math.max(1, fine - inizio)}`,
      `background:${colore}`,
      n > 1 ? `width:${larghezza}; margin-left:calc(2px + ${larghezza} * ${corsia}); margin-right:0; justify-self:start` : '',
    ].join(';');
  }
</script>

<div class="wg-wrap border-2 border-black">
  <div
    bind:this={gridEl}
    class="wg-grid"
    style={`--time-col:${timeColPx}px; grid-template-columns: var(--time-col) repeat(${colonne.length}, minmax(0, 1fr)); grid-template-rows: auto repeat(${nSlot}, ${slotPx}px);`}
  >
    <div class="wg-corner"></div>

    {#each colonne as c, i (c.key)}
      <div class="wg-day-header" class:wg-day-oggi={c.evidenziata} style={`grid-column:${i + 2}`}>
        <span>{c.label}</span>
        {#if c.sublabel}<span class="wg-day-sub">{c.sublabel}</span>{/if}
      </div>
    {/each}

    {#each ore as m (m)}
      <div class="wg-time-label" style={`grid-row:${riga(m)} / span ${60 / slotMin}`}>{m / 60}:00</div>
    {/each}

    {#each colonne as c, i (c.key)}
      {#each slots as m (m)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
          class="wg-cell"
          class:wg-cell-hour={m % 60 === 0}
          class:wg-cell-oggi={c.evidenziata}
          class:wg-cell-cliccabile={Boolean(onCellClick)}
          style={`grid-column:${i + 2}; grid-row:${riga(m)}`}
          onclick={() => onCellClick?.(i, m)}
        ></div>
      {/each}
    {/each}

    {#each visibili as b (b.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        class={`wg-block ${b.classe ?? ''}`}
        class:wg-block-cliccabile={Boolean(onBlockClick)}
        style={stileBlocco(b)}
        onclick={() => onBlockClick?.(b)}
        onpointerdown={(e) => onBlockPointerDown?.(e, b)}
      >
        {#if blocco}
          {@render blocco(b)}
        {:else}
          {#if b.titolo}<p class="wg-block-title">{b.titolo}</p>{/if}
          <p class="wg-block-time">{fmtFascia(b.inizio, b.fine)}</p>
        {/if}
      </div>
    {/each}
  </div>
</div>

{#if mostraToggle}
  <div class="mt-2 text-center">
    <button type="button" class="wg-toggle" onclick={() => (mostraTutto = !mostraTutto)}>
      {mostraTutto ? '− nascondi ore esterne' : '+ mostra tutte le ore'}
    </button>
  </div>
{/if}

<style>
  /* overflow visibile: con overflow-x il riquadro diventerebbe il contenitore
     dello sticky e l'intestazione dei giorni scenderebbe di --header-offset. */
  .wg-wrap {
    overflow: visible;
    background: white;
  }

  .wg-grid {
    position: relative;
    display: grid;
    user-select: none;
  }

  .wg-corner {
    grid-column: 1;
    grid-row: 1;
    position: sticky;
    top: var(--header-offset, 4.6rem);
    left: 0;
    z-index: 4;
    background: white;
    border-bottom: 2px solid black;
    border-right: 2px solid black;
  }

  .wg-day-header {
    grid-row: 1;
    position: sticky;
    top: var(--header-offset, 4.6rem);
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--giallo-club);
    border-bottom: 2px solid black;
    border-right: 2px solid black;
    padding: 0.4rem 0.25rem;
    text-align: center;
    font-weight: 900;
    text-transform: uppercase;
    font-size: 0.75rem;
    line-height: 1.1;
  }

  .wg-day-sub {
    font-size: 0.65rem;
    font-weight: 800;
    opacity: 0.7;
  }

  .wg-day-oggi {
    background: black;
    color: var(--giallo-club);
  }

  .wg-time-label {
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

  .wg-cell {
    border-right: 1px solid rgba(0, 0, 0, 0.1);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  .wg-cell-hour {
    border-top: 1px solid rgba(0, 0, 0, 0.3);
  }

  .wg-cell-oggi {
    background: rgba(255, 204, 0, 0.08);
  }

  .wg-cell-cliccabile {
    cursor: pointer;
  }

  .wg-cell-cliccabile:hover {
    background: rgba(255, 204, 0, 0.18);
  }

  .wg-block {
    position: relative;
    margin: 1px 2px;
    padding: 0.25rem 0.4rem;
    border: 2px solid black;
    box-shadow: -3px 3px 0 rgba(0, 0, 0, 0.9);
    overflow: hidden;
    z-index: 1;
  }

  .wg-block-cliccabile {
    cursor: pointer;
  }

  .wg-block-cliccabile:hover {
    filter: brightness(1.05);
  }

  /* Variante per blocchi "di sfondo" (es. turno previsto ma non svolto). */
  :global(.wg-block.wg-block-tratteggiato) {
    border-style: dashed;
    box-shadow: none;
    opacity: 0.75;
  }

  .wg-block-title,
  .wg-block :global(.wg-block-title) {
    font-weight: 900;
    font-size: 0.75rem;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wg-block-time,
  .wg-block :global(.wg-block-time) {
    font-size: 0.65rem;
    font-weight: 700;
    opacity: 0.85;
  }

  .wg-toggle {
    font-weight: 900;
    font-size: 0.7rem;
    text-transform: uppercase;
    color: black;
  }

  .wg-toggle:hover {
    text-decoration: underline;
  }
</style>
