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
  //
  // Interazione (tutta con il puntatore, senza librerie):
  //   clic su un blocco                 -> onBlockClick(blocco)
  //   clic su una cella vuota           -> onSelezione(colonna, slot, slot+1, null)  (o onCellClick)
  //   trascinamento in verticale        -> onSelezione(colonna, inizio, fine, blocco di partenza o null)
  //   maniglie sopra/sotto di un blocco -> onResize(blocco, inizio, fine), con anteprima
  import type { Snippet } from 'svelte';
  import { assegnaCorsie, clamp, fasciaVisibile, fmtFascia, type Fascia } from '../../lib/time-grid';

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
    onSelezione?: (colonna: number, inizio: number, fine: number, blocco: T | null) => void;
    onResize?: (blocco: T, inizio: number, fine: number) => void;
    ridimensionabile?: (blocco: T) => boolean;
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
    onSelezione,
    onResize,
    ridimensionabile,
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
  const cliccabile = $derived(Boolean(onSelezione || onCellClick));

  // --- Interazione con il puntatore -------------------------------------------

  type Interazione =
    | { tipo: 'seleziona'; colonna: number; ancora: number; corrente: number; blocco: T | null; y0: number; mosso: boolean }
    | { tipo: 'resize'; blocco: T; lato: 'sopra' | 'sotto'; y0: number; inizio: number; fine: number; mosso: boolean };

  let interazione: Interazione | null = $state(null);

  function minutiDaY(y: number): number {
    const rect = gridEl!.getBoundingClientRect();
    const header = gridEl!.querySelector<HTMLElement>('.wg-day-header')?.offsetHeight ?? 0;
    const slot = Math.floor((y - rect.top - header) / slotPx);
    return clamp(fascia.inizio + slot * slotMin, fascia.inizio, fascia.fine - slotMin);
  }

  function inizia(e: PointerEvent, nuova: Interazione) {
    if (e.button !== 0) return;
    e.preventDefault();
    interazione = nuova;
    window.addEventListener('pointermove', muovi);
    window.addEventListener('pointerup', termina);
    window.addEventListener('pointercancel', annulla);
  }

  function rimuoviListener() {
    window.removeEventListener('pointermove', muovi);
    window.removeEventListener('pointerup', termina);
    window.removeEventListener('pointercancel', annulla);
  }

  function muovi(e: PointerEvent) {
    const i = interazione;
    if (!i) return;
    const dy = e.clientY - i.y0;
    if (Math.abs(dy) > 4) i.mosso = true;
    if (i.tipo === 'seleziona') {
      if (i.mosso) i.corrente = minutiDaY(e.clientY);
    } else {
      const delta = Math.round(dy / slotPx) * slotMin;
      if (i.lato === 'sopra') {
        i.inizio = clamp(i.blocco.inizio + delta, fascia.inizio, i.blocco.fine - slotMin);
      } else {
        i.fine = clamp(i.blocco.fine + delta, i.blocco.inizio + slotMin, fascia.fine);
      }
    }
  }

  function termina() {
    const i = interazione;
    interazione = null;
    rimuoviListener();
    if (!i) return;
    if (i.tipo === 'seleziona') {
      if (!i.mosso) {
        if (i.blocco) onBlockClick?.(i.blocco);
        else if (onSelezione) onSelezione(i.colonna, i.ancora, i.ancora + slotMin, null);
        else onCellClick?.(i.colonna, i.ancora);
        return;
      }
      const a = Math.min(i.ancora, i.corrente);
      const b = Math.max(i.ancora, i.corrente) + slotMin;
      onSelezione?.(i.colonna, a, b, i.blocco);
    } else if (i.inizio !== i.blocco.inizio || i.fine !== i.blocco.fine) {
      onResize?.(i.blocco, i.inizio, i.fine);
    }
  }

  function annulla() {
    interazione = null;
    rimuoviListener();
  }

  function giuSuCella(e: PointerEvent, colonna: number, minuti: number) {
    if (!cliccabile) return;
    inizia(e, { tipo: 'seleziona', colonna, ancora: minuti, corrente: minuti, blocco: null, y0: e.clientY, mosso: false });
  }

  function giuSuBlocco(e: PointerEvent, b: T) {
    onBlockPointerDown?.(e, b);
    if (!onBlockClick && !onSelezione) return;
    const m = clamp(minutiDaY(e.clientY), b.inizio, b.fine - slotMin);
    inizia(e, { tipo: 'seleziona', colonna: b.colonna, ancora: m, corrente: m, blocco: b, y0: e.clientY, mosso: false });
  }

  function giuSuManiglia(e: PointerEvent, b: T, lato: 'sopra' | 'sotto') {
    e.stopPropagation();
    inizia(e, { tipo: 'resize', blocco: b, lato, y0: e.clientY, inizio: b.inizio, fine: b.fine, mosso: false });
  }

  // --- Posizionamento ----------------------------------------------------------

  function riga(minuti: number) {
    return Math.round((minuti - fascia.inizio) / slotMin) + 2;
  }

  function fasciaMostrata(b: T): Fascia {
    const i = interazione;
    return i?.tipo === 'resize' && i.blocco.id === b.id ? { inizio: i.inizio, fine: i.fine } : b;
  }

  function stileBlocco(b: T) {
    const f = fasciaMostrata(b);
    const inizio = Math.max(2, riga(f.inizio));
    const fine = Math.min(nSlot + 2, riga(f.fine));
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

  const selezione = $derived.by(() => {
    const i = interazione;
    if (i?.tipo !== 'seleziona' || !i.mosso) return null;
    const a = Math.min(i.ancora, i.corrente);
    const b = Math.max(i.ancora, i.corrente) + slotMin;
    return { colonna: i.colonna, inizio: a, fine: b };
  });
</script>

<div class="wg-wrap border-2 border-black">
  <div
    bind:this={gridEl}
    class="wg-grid"
    class:wg-trascinando={interazione?.tipo === 'resize'}
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
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="wg-cell"
          class:wg-cell-hour={m % 60 === 0}
          class:wg-cell-oggi={c.evidenziata}
          class:wg-cell-cliccabile={cliccabile}
          style={`grid-column:${i + 2}; grid-row:${riga(m)}`}
          onpointerdown={(e) => giuSuCella(e, i, m)}
        ></div>
      {/each}
    {/each}

    {#each visibili as b (b.id)}
      {@const f = fasciaMostrata(b)}
      {@const conManiglie = Boolean(onResize && ridimensionabile?.(b))}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class={`wg-block ${b.classe ?? ''}`}
        class:wg-block-cliccabile={Boolean(onBlockClick || onSelezione)}
        style={stileBlocco(b)}
        onpointerdown={(e) => giuSuBlocco(e, b)}
      >
        {#if conManiglie}
          <div class="wg-handle wg-handle-sopra" title="Trascina per spostare l'inizio" onpointerdown={(e) => giuSuManiglia(e, b, 'sopra')}></div>
        {/if}
        {#if blocco}
          {@render blocco(b)}
        {:else}
          {#if b.titolo}<p class="wg-block-title">{b.titolo}</p>{/if}
          <p class="wg-block-time">{fmtFascia(f.inizio, f.fine)}</p>
        {/if}
        {#if conManiglie}
          <div class="wg-handle wg-handle-sotto" title="Trascina per spostare la fine" onpointerdown={(e) => giuSuManiglia(e, b, 'sotto')}></div>
        {/if}
      </div>
    {/each}

    {#if interazione?.tipo === 'resize'}
      {@const r = interazione}
      <div class="wg-resize-label" style={`grid-column:${r.blocco.colonna + 2}; grid-row:${riga(r.inizio)}`}>
        {fmtFascia(r.inizio, r.fine)}
      </div>
    {/if}

    {#if selezione}
      <div class="wg-selezione" style={`grid-column:${selezione.colonna + 2}; grid-row:${riga(selezione.inizio)} / ${riga(selezione.fine)}`}>
        <span>{fmtFascia(selezione.inizio, selezione.fine)}</span>
      </div>
    {/if}
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
    touch-action: manipulation;
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

  .wg-trascinando,
  .wg-trascinando * {
    cursor: ns-resize !important;
  }

  .wg-handle {
    position: absolute;
    left: 0;
    right: 0;
    height: 8px;
    cursor: ns-resize;
    touch-action: none;
    z-index: 2;
    display: flex;
    justify-content: center;
  }

  .wg-handle-sopra {
    top: 0;
    align-items: flex-start;
  }

  .wg-handle-sotto {
    bottom: 0;
    align-items: flex-end;
  }

  .wg-handle::after {
    content: '';
    width: 22px;
    height: 3px;
    margin: 2px 0;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.35);
    opacity: 0;
  }

  .wg-block:hover .wg-handle::after {
    opacity: 1;
  }

  .wg-handle:hover::after {
    background: rgba(0, 0, 0, 0.8);
  }

  .wg-selezione {
    position: relative;
    z-index: 5;
    margin: 1px 2px;
    border: 2px dashed black;
    background: rgba(255, 204, 0, 0.35);
    pointer-events: none;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 900;
    padding-top: 0.15rem;
  }

  .wg-resize-label {
    position: relative;
    z-index: 6;
    align-self: start;
    justify-self: center;
    transform: translateY(-110%);
    background: black;
    color: white;
    font-size: 0.65rem;
    font-weight: 900;
    padding: 0.1rem 0.35rem;
    pointer-events: none;
    white-space: nowrap;
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
