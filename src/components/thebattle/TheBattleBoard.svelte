<script lang="ts">
  import { onMount } from 'svelte';

  interface BoardPosition {
    row: number;
    col: number;
  }

  interface BoardState {
    occupied: string[];
    position: BoardPosition | null;
  }

  export let state: BoardState;
  export let interactive: boolean = false;
  export let reachable: BoardPosition[] = [];
  export let onCellClick: (row: number, col: number) => void = () => {};
  /** Ruota il campo di 180°: usato online perché ogni giocatore veda sempre la propria metà in basso. */
  export let flip: boolean = false;
  /**
   * Presenta la scacchiera ruotata di 90° (le due metà divise a sinistra/destra
   * invece che sopra/sotto, rete verticale): per il gioco locale su desktop,
   * dove i due giocatori siedono fianco a fianco davanti allo stesso schermo
   * invece che ai lati opposti di un tablet appoggiato sul tavolo. Le
   * coordinate logiche (row/col dello stato di gioco) restano invariate: qui
   * si trasforma solo la disposizione visiva delle celle.
   */
  export let landscape: boolean = false;
  /** Dimensioni della scacchiera: 10x4 (classica) di default, 8x3 in modalità compatta. */
  export let rows: number = 10;
  export let cols: number = 4;

  /** Id cella indipendente dall'engine in uso (classico o compatto): lettera colonna + numero riga. */
  function cellId(row: number, col: number): string {
    return `${String.fromCharCode(97 + col)}${row}`;
  }

  $: occupiedSet = new Set(state.occupied);
  $: reachableSet = new Set(reachable.map((p) => cellId(p.row, p.col)));
  $: positionId = state.position ? cellId(state.position.row, state.position.col) : null;
  /** Ultima riga della metà "bassa": righe divise in due metà uguali. */
  $: lastLowerRow = rows / 2 - 1;

  /** Conteggio colonne/righe della GRIGLIA CSS: scambiati in landscape per ottenere una board larga. */
  $: gridCols = landscape ? rows : cols;
  $: gridRows = landscape ? cols : rows;
  $: primaryIndexes = Array.from({ length: gridRows }, (_, i) => i);
  $: secondaryIndexes = Array.from({ length: gridCols }, (_, i) => i);

  /**
   * Da indice di riga/colonna VISIVA (posizione nella griglia CSS, ordine DOM)
   * a coordinate LOGICHE row/col dello stato di gioco. In verticale: riga
   * visiva 0 = riga logica più alta (in cima allo schermo), colonna visiva =
   * colonna logica diretta. In landscape: colonna logica diventa la riga
   * visiva (dall'alto in basso), riga logica diventa la colonna visiva ma
   * invertita, così la riga 0 (metà di A) resta sul lato destro come le
   * tessere di A, e la riga più alta (metà di B) sul lato sinistro come le
   * tessere di B — nessuno scambio di colonne da fare nei componenti che usano la board.
   */
  function logicalRowCol(primary: number, secondary: number): { row: number; col: number } {
    if (landscape) {
      return { row: rows - 1 - secondary, col: primary };
    }
    return { row: rows - 1 - primary, col: secondary };
  }

  /**
   * Dimensionamento calcolato in JS (misurando lo spazio davvero disponibile)
   * invece che con "aspect-ratio" + la funzione CSS "min()": su alcuni motori
   * mobili meno recenti (es. iOS con WebKit datato, che si porta dietro sia
   * Safari sia Chrome/Firefox-su-iOS, dato che condividono lo stesso motore
   * di sistema) quelle proprietà CSS relativamente recenti (~2021) possono
   * non essere supportate, facendo collassare la board alla dimensione minima
   * del contenuto. clientWidth/clientHeight e la matematica in JS funzionano
   * ovunque, senza dipendere dal supporto di feature CSS moderne.
   */
  /* Solo l'altezza viene misurata: la larghezza si deduce da altezza × rapporto
     colonne/righe. Misurare anche la larghezza richiederebbe che questo
     contenitore abbia "width:100%", ma il suo genitore (nei componenti che
     usano la board) è volutamente senza una larghezza propria — si restringe
     al contenuto, cioè alla board stessa — altrimenti le tessere accanto
     finiscono ai bordi dello schermo. "width:100%" su un genitore che si
     restringe al proprio contenuto è una dipendenza circolare irrisolvibile. */
  let measureEl: HTMLDivElement;
  let measuredHeight = 0;
  let isWideScreen = false;

  onMount(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    isWideScreen = mq.matches;
    const onChange = () => (isWideScreen = mq.matches);
    mq.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      measuredHeight = entry.contentRect.height;
    });
    ro.observe(measureEl);
    measuredHeight = measureEl.clientHeight;

    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
      ro.disconnect();
    };
  });

  $: heightCap = landscape ? 320 : isWideScreen ? 640 : 480;
  $: finalHeight = Math.min(measuredHeight, heightCap);
  $: finalWidth = gridRows > 0 ? finalHeight * (gridCols / gridRows) : 0;
</script>

<div bind:this={measureEl} class="tb-board-measure">
  <div
    class="tb-board"
    class:landscape
    style={`--tb-cols:${gridCols}; --tb-rows:${gridRows}; width:${finalWidth}px; height:${finalHeight}px;${flip ? ' transform: rotate(180deg);' : ''}`}
  >
    {#each primaryIndexes as primary (primary)}
      {#each secondaryIndexes as secondary (secondary)}
        {@const { row, col } = logicalRowCol(primary, secondary)}
        {@const id = cellId(row, col)}
        {@const isOccupied = occupiedSet.has(id)}
        {@const isPosition = id === positionId}
        {@const isReachable = interactive && reachableSet.has(id)}
        <button
          type="button"
          class="tb-cell"
          class:tb-cell-lower={row <= lastLowerRow}
          class:tb-cell-upper={row > lastLowerRow}
          class:tb-cell-occupied={isOccupied && !isPosition}
          class:tb-cell-position={isPosition}
          class:tb-cell-reachable={isReachable}
          disabled={!isReachable}
          on:click={() => onCellClick(row, col)}
          aria-label={`Casella ${id}${isPosition ? ', gettone qui' : isOccupied ? ', occupata' : ''}`}
        >
          {#if isPosition}
            <span class="tb-token" aria-hidden="true"></span>
          {:else if isOccupied}
            <span class="tb-dot" aria-hidden="true"></span>
          {/if}
        </button>
      {/each}
    {/each}

    <div class="tb-net" aria-hidden="true">
      <span class="tb-net-post tb-net-post-left"></span>
      <span class="tb-net-post tb-net-post-right"></span>
    </div>
  </div>
</div>

<style>
  .tb-board-measure {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .tb-board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--tb-cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--tb-rows), minmax(0, 1fr));
    gap: 3px;
    flex: none;
    padding: 4px;
    background: black;
    border: 2px solid black;
  }

  /* La "rete": righe 0-4 vs 5-9 sono esattamente metà scacchiera, quindi il
     confine reale cade sempre al 50% dell'altezza, a prescindere da gap e
     padding (uniformi). Esce oltre i bordi laterali come i pali di una rete
     vera. */
  .tb-net {
    position: absolute;
    left: -14px;
    right: -14px;
    top: 50%;
    height: 6px;
    transform: translateY(-50%);
    background: black;
    pointer-events: none;
    z-index: 2;
  }

  .tb-net-post {
    position: absolute;
    top: 50%;
    width: 6px;
    height: 18px;
    transform: translateY(-50%);
    background: black;
  }

  .tb-net-post-left {
    left: 0;
  }

  .tb-net-post-right {
    right: 0;
  }

  /* In landscape la rete diventa verticale (metà a sinistra/destra invece che sopra/sotto). */
  .tb-board.landscape .tb-net {
    left: 50%;
    right: auto;
    top: -14px;
    bottom: -14px;
    width: 6px;
    height: auto;
    transform: translateX(-50%);
  }

  .tb-board.landscape .tb-net-post {
    top: auto;
    left: 50%;
    width: 18px;
    height: 6px;
    transform: translateX(-50%);
  }

  .tb-board.landscape .tb-net-post-left {
    top: 0;
    left: 50%;
  }

  .tb-board.landscape .tb-net-post-right {
    top: auto;
    bottom: 0;
    left: 50%;
    right: auto;
  }

  .tb-cell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    border: none;
    margin: 0;
    padding: 0;
    cursor: default;
  }

  .tb-cell-lower {
    background: #dbeafe;
  }

  .tb-cell-upper {
    background: #fee2e2;
  }

  .tb-cell-occupied {
    background: #cbd5e1;
  }

  .tb-cell-position {
    background: black;
  }

  .tb-cell-reachable {
    cursor: pointer;
    background: var(--giallo-club);
    box-shadow: inset 0 0 0 2px black;
  }

  .tb-cell-reachable:hover {
    filter: brightness(1.08);
  }

  .tb-dot {
    width: 28%;
    height: 28%;
    border-radius: 999px;
    background: #64748b;
  }

  .tb-token {
    width: 55%;
    height: 55%;
    border-radius: 999px;
    background: var(--giallo-club);
    border: 2px solid white;
  }
</style>
