<script lang="ts">
  import { COLS, ROWS, cellId, type GameState, type Position } from '../../lib/thebattle/engine';

  export let state: GameState;
  export let interactive: boolean = false;
  export let reachable: Position[] = [];
  export let onCellClick: (row: number, col: number) => void = () => {};
  /** Ruota il campo di 180°: usato online perché ogni giocatore veda sempre la propria metà in basso. */
  export let flip: boolean = false;

  $: occupiedSet = new Set(state.occupied);
  $: reachableSet = new Set(reachable.map((p) => cellId(p.row, p.col)));
  $: positionId = state.position ? cellId(state.position.row, state.position.col) : null;

  const rowsTopDown = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i);
  const cols = Array.from({ length: COLS }, (_, i) => i);
</script>

<div class="tb-board" style={flip ? 'transform: rotate(180deg);' : ''}>
  {#each rowsTopDown as row (row)}
    {#each cols as col (col)}
      {@const id = cellId(row, col)}
      {@const isOccupied = occupiedSet.has(id)}
      {@const isPosition = id === positionId}
      {@const isReachable = interactive && reachableSet.has(id)}
      <button
        type="button"
        class="tb-cell"
        class:tb-cell-lower={row <= 4}
        class:tb-cell-upper={row >= 5}
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(10, minmax(0, 1fr));
    gap: 3px;
    width: min(100%, 30dvh, 280px);
    aspect-ratio: 4 / 10;
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
