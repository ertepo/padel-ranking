<script lang="ts">
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

  $: rowsTopDown = Array.from({ length: rows }, (_, i) => rows - 1 - i);
  $: colIndexes = Array.from({ length: cols }, (_, i) => i);
</script>

<div
  class="tb-board"
  style={`--tb-cols:${cols}; --tb-rows:${rows};${flip ? ' transform: rotate(180deg);' : ''}`}
>
  {#each rowsTopDown as row (row)}
    {#each colIndexes as col (col)}
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

<style>
  .tb-board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--tb-cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--tb-rows), minmax(0, 1fr));
    gap: 3px;
    /* L'altezza segue lo spazio verticale realmente disponibile nel contenitore
       flex (non un numero fisso in dvh): così la board si ridimensiona da sola
       in base a variante/aspect-ratio senza mai coprire ciò che sta sotto.
       Il tetto è più basso su schermi stretti (telefono): scacchiere come la
       3×8 sono già di forma stretta e allungata, alzare troppo il tetto le fa
       sembrare "strisce" sottilissime. Su schermi larghi (desktop/tablet) il
       tetto è più alto per sfruttare lo spazio verticale in più. */
    height: min(100%, 480px);
    width: auto;
    max-width: 100%;
    aspect-ratio: var(--tb-cols) / var(--tb-rows);
    margin: 0 auto;
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

  @media (min-width: 768px) {
    .tb-board {
      height: min(100%, 640px);
    }
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
