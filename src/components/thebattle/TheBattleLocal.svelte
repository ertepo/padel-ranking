<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    VARIANT_BOARD,
    engineFor,
    type AnyGameState,
    type AnyMoveLength,
    type AnyPosition,
    type Variant,
  } from '../../lib/thebattle/variant';
  import TheBattleBoard from './TheBattleBoard.svelte';
  import TheBattleLengthTile from './TheBattleLengthTile.svelte';

  export let onExit: () => void;
  export let variant: Variant = 'classic';

  const engine = engineFor(variant);
  const { rows: boardRows, cols: boardCols } = VARIANT_BOARD[variant];

  const TURN_BACKGROUND: Record<'A' | 'B', string> = { A: '#bfdbfe', B: '#fecaca' };
  /** "Desktop" = schermo largo con puntatore preciso (mouse/trackpad): qui i due
      giocatori siedono fianco a fianco davanti allo stesso schermo, non ai lati
      opposti di un tablet appoggiato sul tavolo, quindi il campo viene ruotato
      di 90°. `pointer:fine`/`hover:hover` esclude tablet touch (iPad compreso,
      in qualunque orientamento) a prescindere dalla larghezza. */
  const DESKTOP_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 1024px)';

  let state: AnyGameState = engine.newGame();
  let selectedLength: AnyMoveLength | null = null;
  let error = '';
  let isDesktop = false;

  function ownHalfCells(player: 'A' | 'B'): AnyPosition[] {
    const [lo, hi] = engine.ownHalfRows(player);
    const cells: AnyPosition[] = [];
    for (let row = lo; row <= hi; row++) {
      for (let col = 0; col < boardCols; col++) cells.push({ row, col });
    }
    return cells;
  }

  $: reachable =
    state.status === 'placement'
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
    if (state.status !== 'active' || !playableLengths.has(length)) return;
    selectedLength = selectedLength === length ? null : length;
    error = '';
  }

  function handleCellClick(row: number, col: number) {
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

    const mq = window.matchMedia(DESKTOP_QUERY);
    isDesktop = mq.matches;
    const onChange = () => (isDesktop = mq.matches);
    // Sia matchMedia "change" (via il MediaQueryList) sia il resize della
    // finestra: alcuni browser non notificano in modo affidabile il primo.
    mq.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
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

  $: winnerLabel = state.status === 'finished' ? 'Hai vinto!' : '';
</script>

<div class="fixed inset-0 z-40 flex flex-col p-3 gap-2" style="height: 100dvh;">
  <button
    type="button"
    on:click={onExit}
    class="self-start bg-transparent p-0 text-xs font-black uppercase tracking-widest text-black/70 hover:text-black"
  >
    ← Esci e torna al menu
  </button>

  <div class="min-h-14 flex items-center justify-center px-4">
    {#if statusText}
      <p
        class="text-xl font-black text-center"
        style={`transform: rotate(${!isDesktop && state.currentPlayer === 'B' ? 180 : 0}deg);`}
      >
        {statusText}
      </p>
    {/if}
  </div>

  <div class="flex min-h-0 flex-1 flex-row justify-center gap-3">
    <!-- Giocatore B: colonna a sinistra. Capovolta quando i giocatori siedono ai lati opposti del dispositivo (telefono/tablet appoggiato); dritta su desktop, dove siedono fianco a fianco. -->
    <div class="flex flex-col justify-center gap-2" style={`transform: rotate(${isDesktop ? 0 : 180}deg);`}>
      {#if state.status !== 'finished'}
        {#each engine.MOVE_LENGTHS as length (length)}
          {#if state.moveCounts.B[length] > 0}
            <TheBattleLengthTile
              {length}
              count={state.moveCounts.B[length]}
              inactive={state.currentPlayer !== 'B'}
              disabled={state.currentPlayer === 'B' && !playableLengths.has(length)}
              selected={state.currentPlayer === 'B' && selectedLength === length}
              onClick={() => selectLength(length)}
            />
          {/if}
        {/each}
      {/if}
    </div>

    <div class="relative flex items-center justify-center min-h-0">
      <TheBattleBoard
        {state}
        interactive={state.status !== 'finished'}
        {reachable}
        onCellClick={handleCellClick}
        rows={boardRows}
        cols={boardCols}
        landscape={isDesktop}
      />
      {#if state.status === 'finished'}
        <p
          class="tb-winner-tile"
          style={`transform: translate(-50%, -50%) rotate(${!isDesktop && state.winner === 'B' ? 180 : 0}deg);`}
        >
          {winnerLabel}
        </p>
      {/if}
    </div>

    <!-- Giocatore A: colonna a destra, orientamento normale. -->
    <div class="flex flex-col justify-center gap-2">
      {#if state.status !== 'finished'}
        {#each engine.MOVE_LENGTHS as length (length)}
          {#if state.moveCounts.A[length] > 0}
            <TheBattleLengthTile
              {length}
              count={state.moveCounts.A[length]}
              inactive={state.currentPlayer !== 'A'}
              disabled={state.currentPlayer === 'A' && !playableLengths.has(length)}
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
