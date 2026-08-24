<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { VARIANT_BOARD, engineFor, type AnyGameState, type AnyMoveLength, type AnyPosition } from '../../lib/thebattle/variant';
  import { chooseBotAction, DIFFICULTY_LABEL, type BotDifficulty } from '../../lib/thebattle/bot';
  import TheBattleBoard from './TheBattleBoard.svelte';
  import TheBattleLengthTile from './TheBattleLengthTile.svelte';

  export let onExit: () => void;
  export let difficulty: BotDifficulty = 'medium';

  // Per ora il bot è collegato solo alla variante compatta.
  const variant = 'compact' as const;
  const engine = engineFor(variant);
  const { rows: boardRows, cols: boardCols } = VARIANT_BOARD[variant];

  /** L'umano è sempre A (orientamento dritto, nessuna rotazione: qui gioca una sola persona). */
  const HUMAN: 'A' = 'A';
  const BOT: 'B' = 'B';

  const TURN_BACKGROUND: Record<'A' | 'B', string> = { A: '#bfdbfe', B: '#fecaca' };
  const BOT_MOVE_DELAY_MS = 550;

  let state: AnyGameState = engine.newGame();
  let selectedLength: AnyMoveLength | null = null;
  let error = '';
  let botTimer: ReturnType<typeof setTimeout> | null = null;

  function ownHalfCells(player: 'A' | 'B'): AnyPosition[] {
    const [lo, hi] = engine.ownHalfRows(player);
    const cells: AnyPosition[] = [];
    for (let row = lo; row <= hi; row++) {
      for (let col = 0; col < boardCols; col++) cells.push({ row, col });
    }
    return cells;
  }

  $: isHumanTurn = state.currentPlayer === HUMAN;

  $: reachable =
    !isHumanTurn
      ? []
      : state.status === 'placement'
        ? ownHalfCells(state.currentPlayer)
        : state.status === 'active' && selectedLength
          ? engine.getReachableDestinations(state, selectedLength)
          : [];

  // Calcolato qui (non in una funzione chiamata dal template) perché Svelte
  // tracci "state" come dipendenza reattiva: una funzione qualsiasi invocata
  // dentro un'espressione del template nasconde a Svelte le variabili che
  // legge al suo interno, quindi l'espressione non si ricalcola più dopo il
  // primo aggiornamento (bug visibile solo in build di produzione).
  $: playableLengths = new Set(
    engine.MOVE_LENGTHS.filter(
      (length) =>
        state.moveCounts[state.currentPlayer][length] > 0 &&
        engine.getReachableDestinations(state, length).length > 0,
    ),
  );

  function selectLength(length: AnyMoveLength) {
    if (!isHumanTurn || state.status !== 'active' || !playableLengths.has(length)) return;
    selectedLength = selectedLength === length ? null : length;
    error = '';
  }

  function handleCellClick(row: number, col: number) {
    if (!isHumanTurn) return;
    if (state.status === 'placement') {
      const res = engine.placeStart(state, row, col);
      if (res.ok) {
        state = res.state;
      } else {
        error = res.error;
      }
      return;
    }
    if (state.status === 'active' && selectedLength) {
      const res = engine.applyMove(state, selectedLength, row, col);
      if (res.ok) {
        state = res.state;
        selectedLength = null;
        error = '';
      } else {
        error = res.error;
      }
    }
  }

  function playBotTurn() {
    botTimer = null;
    if (state.status === 'finished' || state.currentPlayer !== BOT) return;
    const action = chooseBotAction(engine, state, difficulty, boardCols);
    if (!action) return;
    const res =
      action.kind === 'place'
        ? engine.placeStart(state, action.row, action.col)
        : engine.applyMove(state, action.length, action.row, action.col);
    if (res.ok) state = res.state;
  }

  // Ogni volta che cambia lo stato, se tocca al bot programma la sua mossa dopo
  // una breve pausa (percepibile, così non sembra istantaneo/artificiale).
  $: {
    if (botTimer) {
      clearTimeout(botTimer);
      botTimer = null;
    }
    if (state.status !== 'finished' && state.currentPlayer === BOT) {
      botTimer = setTimeout(playBotTurn, BOT_MOVE_DELAY_MS);
    }
  }

  function newMatch() {
    state = engine.newGame();
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
    if (botTimer) clearTimeout(botTimer);
    if (typeof document === 'undefined') return;
    document.body.style.background = '';
    setChromeHidden(false);
  });

  $: if (typeof document !== 'undefined') {
    document.body.style.background = state.status === 'finished' ? '' : TURN_BACKGROUND[state.currentPlayer];
  }

  $: statusText =
    state.status === 'finished'
      ? ''
      : !isHumanTurn
        ? 'Il bot sta pensando…'
        : state.status === 'placement'
          ? 'Scegli la casella da cui iniziare'
          : selectedLength
            ? 'Tocca una casella evidenziata per tirare.'
            : 'Scegli la profondità del colpo.';

  $: winnerLabel = state.status === 'finished' ? (state.winner === HUMAN ? 'Hai vinto!' : 'Hai perso.') : '';
</script>

<div class="fixed inset-0 z-40 flex flex-col p-3 gap-2" style="height: 100dvh;">
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

  <div class="min-h-14 flex items-center justify-center px-4">
    {#if statusText}
      <p class="text-xl font-black text-center">{statusText}</p>
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-row justify-center gap-3">
    <!-- Il bot (B): colonna a sinistra, sempre non interattiva. -->
    <div class="flex flex-col justify-center gap-2">
      {#if state.status !== 'finished'}
        {#each engine.MOVE_LENGTHS as length (length)}
          {#if state.moveCounts.B[length] > 0}
            <TheBattleLengthTile
              {length}
              count={state.moveCounts.B[length]}
              inactive={state.currentPlayer !== 'B'}
              disabled={true}
              tileSize={56}
              peekStep={10}
            />
          {/if}
        {/each}
      {/if}
    </div>

    <div class="relative flex items-center justify-center min-h-0">
      <TheBattleBoard
        {state}
        interactive={isHumanTurn && state.status !== 'finished'}
        {reachable}
        onCellClick={handleCellClick}
        rows={boardRows}
        cols={boardCols}
      />
      {#if state.status === 'finished'}
        <p class="tb-winner-tile">{winnerLabel}</p>
      {/if}
    </div>

    <!-- Tu (A): colonna a destra. -->
    <div class="flex flex-col justify-center gap-2">
      {#if state.status !== 'finished'}
        {#each engine.MOVE_LENGTHS as length (length)}
          {#if state.moveCounts.A[length] > 0}
            <TheBattleLengthTile
              {length}
              count={state.moveCounts.A[length]}
              inactive={!isHumanTurn}
              disabled={!isHumanTurn || !playableLengths.has(length)}
              selected={isHumanTurn && selectedLength === length}
              onClick={() => selectLength(length)}
              tileSize={56}
              peekStep={10}
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
