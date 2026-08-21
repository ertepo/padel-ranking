<script lang="ts">
  import { getActiveBoards, type GameState } from '../../lib/supertris/engine';

  export let state: GameState;
  export let interactive: boolean = false;
  export let onMove: (boardIndex: number, cellIndex: number) => void = () => {};

  $: activeBoards = new Set(getActiveBoards(state));
</script>

<div class="st-board">
  {#each state.boards as board, boardIndex (boardIndex)}
    <div
      class="st-sub"
      class:st-sub-active={interactive && activeBoards.has(boardIndex)}
      class:st-sub-draw={state.subResults[boardIndex] === 'draw'}
    >
      {#each board as cell, cellIndex (cellIndex)}
        <button
          type="button"
          class="st-cell"
          class:st-cell-x={cell === 'X'}
          class:st-cell-o={cell === 'O'}
          disabled={!interactive || !activeBoards.has(boardIndex) || cell !== null}
          on:click={() => onMove(boardIndex, cellIndex)}
          aria-label={`Riquadro ${boardIndex + 1}, cella ${cellIndex + 1}${cell ? `, occupata da ${cell}` : ''}`}
        ></button>
      {/each}

      {#if state.subResults[boardIndex] === 'X' || state.subResults[boardIndex] === 'O'}
        <div
          class="st-sub-overlay"
          class:st-sub-overlay-x={state.subResults[boardIndex] === 'X'}
          class:st-sub-overlay-o={state.subResults[boardIndex] === 'O'}
        >
          {state.subResults[boardIndex]}
        </div>
      {:else if state.subResults[boardIndex] === 'draw'}
        <div class="st-sub-overlay st-sub-overlay-draw">–</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .st-board {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 4px;
    width: min(94vw, 480px);
    aspect-ratio: 1;
    margin: 0 auto;
    padding: 4px;
    background: black;
    border: 2px solid black;
  }

  .st-sub {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 3px;
    min-width: 0;
    min-height: 0;
    background: #ddd;
    border: 4px solid transparent;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .st-sub-active {
    background: var(--giallo-club);
    border-color: var(--giallo-club);
  }

  .st-sub-draw {
    background: #bbb;
  }

  .st-cell {
    background: white;
    border: none;
    margin: 0;
    padding: 0;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: pointer;
  }

  .st-cell:disabled {
    cursor: default;
  }

  .st-cell-x {
    background: var(--blu-padel);
    border: 3px solid white;
  }

  .st-cell-o {
    background: var(--rosso-padel);
    border: 3px solid white;
  }

  .st-sub-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: clamp(2rem, 9vw, 3.5rem);
    color: black;
    pointer-events: none;
  }

  .st-sub-overlay-x {
    background: var(--blu-padel);
    color: white;
  }

  .st-sub-overlay-o {
    background: var(--rosso-padel);
    color: white;
  }

  .st-sub-overlay-draw {
    color: #555;
  }
</style>
