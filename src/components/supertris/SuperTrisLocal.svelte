<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createInitialState, tryMove, type GameState } from '../../lib/supertris/engine';
  import SuperTrisBoard from './SuperTrisBoard.svelte';

  export let onExit: () => void;

  const TURN_BACKGROUND: Record<'X' | 'O', string> = { X: '#bfdbfe', O: '#fecaca' };

  let state: GameState = createInitialState();

  function handleMove(boardIndex: number, cellIndex: number) {
    const result = tryMove(state, boardIndex, cellIndex, state.currentPlayer);
    if (result.ok) state = result.state;
  }

  function newGame() {
    state = createInitialState();
  }

  function setChromeHidden(hidden: boolean) {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    if (header) header.style.display = hidden ? 'none' : '';
    if (footer) footer.style.display = hidden ? 'none' : '';
    document.body.style.overflow = hidden ? 'hidden' : '';
  }

  onMount(() => {
    document.body.style.transition = 'background 200ms ease';
    setChromeHidden(true);
  });

  onDestroy(() => {
    if (typeof document === 'undefined') return;
    document.body.style.background = '';
    setChromeHidden(false);
  });

  $: if (typeof document !== 'undefined') {
    document.body.style.background = state.winner ? '' : TURN_BACKGROUND[state.currentPlayer];
  }

  // Due giocatori seduti l'uno di fronte all'altro con il telefono appoggiato
  // sul tavolo: X gioca dal basso (orientamento normale), O dall'alto e vede
  // lo schermo capovolto, quindi il suo avviso di turno va ruotato di 180°.
  $: winnerLabel = !state.winner
    ? ''
    : state.winner === 'draw'
      ? 'Pareggio!'
      : `Ha vinto ${state.winner}!`;
</script>

<div class="fixed inset-0 z-40 flex flex-col p-4" style="height: 100dvh;">
  <button
    type="button"
    on:click={onExit}
    class="self-start bg-transparent p-0 text-xs font-black uppercase tracking-widest text-black/70 hover:text-black"
  >
    ← Esci e torna al menu
  </button>

  <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
    <div
      class="px-4 py-1 text-lg font-black uppercase tracking-widest"
      style={`transform: rotate(180deg); visibility: ${
        !state.winner && state.currentPlayer === 'O' ? 'visible' : 'hidden'
      };`}
    >
      È il tuo turno
    </div>

    <SuperTrisBoard {state} interactive={!state.winner} onMove={handleMove} />

    {#if state.winner}
      <div class="flex flex-col items-center gap-3">
        <p class="text-2xl font-black">{winnerLabel}</p>
        <button
          type="button"
          class="club-btn-yellow px-4 py-2 font-black uppercase tracking-widest"
          on:click={newGame}
        >
          Nuova partita
        </button>
      </div>
    {:else}
      <div
        class="px-4 py-1 text-lg font-black uppercase tracking-widest"
        style={`visibility: ${state.currentPlayer === 'X' ? 'visible' : 'hidden'};`}
      >
        È il tuo turno
      </div>
    {/if}
  </div>
</div>
