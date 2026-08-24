<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    MOVE_LENGTHS,
    applyMove,
    getReachableDestinations,
    newGame,
    placeStart,
    type GameState,
    type MoveLength,
    type Position,
  } from '../../lib/thebattle/engine';
  import TheBattleBoard from './TheBattleBoard.svelte';
  import TheBattleLengthTile from './TheBattleLengthTile.svelte';

  export let onExit: () => void;

  const TURN_BACKGROUND: Record<'A' | 'B', string> = { A: '#bfdbfe', B: '#fecaca' };

  let state: GameState = newGame();
  let selectedLength: MoveLength | null = null;
  let error = '';

  function ownHalfCells(): Position[] {
    const cells: Position[] = [];
    for (let row = 0; row <= 4; row++) {
      for (let col = 0; col < 4; col++) cells.push({ row, col });
    }
    return cells;
  }

  $: reachable =
    state.status === 'placement'
      ? ownHalfCells()
      : state.status === 'active' && selectedLength
        ? getReachableDestinations(state, selectedLength)
        : [];

  // La zona da evidenziare (metà bassa in fase di piazzamento, metà avversaria
  // durante una mossa) è sempre quella su cui si sta per cliccare: la scheda
  // fluttuante va nella metà opposta per non coprire le caselle attive.
  $: cardAtBottom = reachable.length > 0 && reachable[0].row >= 5;

  function lengthPlayable(length: MoveLength): boolean {
    return state.moveCounts[state.currentPlayer][length] > 0 && getReachableDestinations(state, length).length > 0;
  }

  function selectLength(length: MoveLength) {
    if (state.status !== 'active' || !lengthPlayable(length)) return;
    selectedLength = selectedLength === length ? null : length;
    error = '';
  }

  function handleCellClick(row: number, col: number) {
    if (state.status === 'placement') {
      const res = placeStart(state, row, col);
      if (res.ok) {
        state = res.state;
      } else {
        error = res.error;
      }
      return;
    }
    if (state.status === 'active' && selectedLength) {
      const res = applyMove(state, selectedLength, row, col);
      if (res.ok) {
        state = res.state;
        selectedLength = null;
        error = '';
      } else {
        error = res.error;
      }
    }
  }

  function newMatch() {
    state = newGame();
    selectedLength = null;
    error = '';
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
    document.body.style.background = state.status === 'finished' ? '' : TURN_BACKGROUND[state.currentPlayer];
  }

  $: statusText =
    state.status === 'placement'
      ? 'Scegli la casella da cui iniziare'
      : state.status === 'active'
        ? selectedLength
          ? 'Tocca una casella evidenziata per tirare.'
          : 'Scegli la profondità del colpo.'
        : '';

  $: winnerLabel = state.status === 'finished' ? `Ha vinto il Giocatore ${state.winner}!` : '';
</script>

<div class="fixed inset-0 z-40 flex flex-col p-3 gap-2" style="height: 100dvh;">
  <button
    type="button"
    on:click={onExit}
    class="self-start bg-transparent p-0 text-xs font-black uppercase tracking-widest text-black/70 hover:text-black"
  >
    ← Esci e torna al menu
  </button>

  <div class="flex min-h-0 flex-1 flex-row items-center justify-center gap-3">
    <!-- Giocatore B: colonna a sinistra, sempre capovolta, così chi siede dall'altra parte del telefono legge dritto. -->
    <div class="flex flex-col gap-2" style="transform: rotate(180deg);">
      {#if state.status !== 'finished'}
        {#each MOVE_LENGTHS as length (length)}
          {#if state.moveCounts.B[length] > 0}
            <TheBattleLengthTile
              {length}
              count={state.moveCounts.B[length]}
              inactive={state.currentPlayer !== 'B'}
              disabled={state.currentPlayer === 'B' && !lengthPlayable(length)}
              selected={state.currentPlayer === 'B' && selectedLength === length}
              onClick={() => selectLength(length)}
            />
          {/if}
        {/each}
      {/if}
    </div>

    <div class="relative flex flex-1 items-center justify-center min-w-0 min-h-0">
      <TheBattleBoard {state} interactive={state.status !== 'finished'} {reachable} onCellClick={handleCellClick} />

      {#if statusText}
        <div
          class="tb-status-card ombra"
          style={`${cardAtBottom ? 'bottom: 4%;' : 'top: 4%;'} transform: rotate(${state.currentPlayer === 'B' ? 180 : 0}deg);`}
        >
          {statusText}
        </div>
      {/if}
    </div>

    <!-- Giocatore A: colonna a destra, orientamento normale. -->
    <div class="flex flex-col gap-2">
      {#if state.status !== 'finished'}
        {#each MOVE_LENGTHS as length (length)}
          {#if state.moveCounts.A[length] > 0}
            <TheBattleLengthTile
              {length}
              count={state.moveCounts.A[length]}
              inactive={state.currentPlayer !== 'A'}
              disabled={state.currentPlayer === 'A' && !lengthPlayable(length)}
              selected={state.currentPlayer === 'A' && selectedLength === length}
              onClick={() => selectLength(length)}
            />
          {/if}
        {/each}
      {/if}
    </div>
  </div>

  {#if error}
    <p class="text-xs font-bold text-center text-[var(--rosso-padel)]">{error}</p>
  {/if}

  {#if state.status === 'finished'}
    <div class="flex flex-col items-center gap-3 pb-2">
      <p class="text-2xl font-black">{winnerLabel}</p>
      <button
        type="button"
        class="club-btn-yellow px-4 py-2 font-black uppercase tracking-widest"
        on:click={newMatch}
      >
        Nuova partita
      </button>
    </div>
  {/if}
</div>
