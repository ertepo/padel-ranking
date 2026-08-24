<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createInitialState, tryMove, type GameState } from '../../lib/supertris/engine';
  import { chooseBotMove, DIFFICULTY_LABEL, type BotDifficulty } from '../../lib/supertris/bot';
  import SuperTrisBoard from './SuperTrisBoard.svelte';

  export let onExit: () => void;
  export let difficulty: BotDifficulty = 'medium';

  /** L'umano gioca sempre X (muove per primo), il bot sempre O. */
  const HUMAN: 'X' = 'X';
  const BOT: 'O' = 'O';

  const TURN_BACKGROUND: Record<'X' | 'O', string> = { X: '#bfdbfe', O: '#fecaca' };
  const BOT_MOVE_DELAY_MS = 550;

  let state: GameState = createInitialState();
  let botTimer: ReturnType<typeof setTimeout> | null = null;

  $: isHumanTurn = state.currentPlayer === HUMAN;

  function handleMove(boardIndex: number, cellIndex: number) {
    if (!isHumanTurn || state.winner) return;
    const res = tryMove(state, boardIndex, cellIndex, HUMAN);
    if (res.ok) state = res.state;
  }

  function playBotTurn() {
    botTimer = null;
    if (state.winner || state.currentPlayer !== BOT) return;
    const move = chooseBotMove(state, difficulty, BOT);
    if (!move) return;
    const res = tryMove(state, move.boardIndex, move.cellIndex, BOT);
    if (res.ok) state = res.state;
  }

  // Ogni volta che cambia lo stato, se tocca al bot programma la sua mossa dopo
  // una breve pausa (percepibile, così non sembra istantaneo/artificiale).
  $: {
    if (botTimer) {
      clearTimeout(botTimer);
      botTimer = null;
    }
    if (!state.winner && state.currentPlayer === BOT) {
      botTimer = setTimeout(playBotTurn, BOT_MOVE_DELAY_MS);
    }
  }

  function newMatch() {
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
    if (botTimer) clearTimeout(botTimer);
    if (typeof document === 'undefined') return;
    document.body.style.background = '';
    setChromeHidden(false);
  });

  $: if (typeof document !== 'undefined') {
    document.body.style.background = state.winner ? '' : TURN_BACKGROUND[state.currentPlayer];
  }

  $: statusText = state.winner ? '' : !isHumanTurn ? 'Il bot sta pensando…' : 'È il tuo turno';

  $: winnerLabel = !state.winner
    ? ''
    : state.winner === 'draw'
      ? 'Pareggio!'
      : state.winner === HUMAN
        ? 'Hai vinto!'
        : 'Hai perso.';
</script>

<div class="fixed inset-0 z-40 flex flex-col p-4" style="height: 100dvh;">
  <div class="flex items-center justify-between">
    <button
      type="button"
      on:click={onExit}
      class="bg-transparent p-0 text-xs font-black uppercase tracking-widest text-black/70 hover:text-black"
    >
      ← Esci e torna al menu
    </button>
    <span class="text-xs font-black uppercase tracking-widest text-slate-500">Bot: {DIFFICULTY_LABEL[difficulty]}</span>
  </div>

  <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
    <div class="min-h-8 px-4 py-1 text-lg font-black uppercase tracking-widest text-center">
      {statusText}
    </div>

    <SuperTrisBoard {state} interactive={isHumanTurn && !state.winner} onMove={handleMove} />

    {#if state.winner}
      <div class="flex flex-col items-center gap-3">
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
</div>
