<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { move, newGame, type Dir, type GameState } from '../../lib/quindici/engine';
  import QuindiciBoard from './QuindiciBoard.svelte';

  let state: GameState = newGame();
  let resetCount = 0;
  let locked = false;
  let boardRef: QuindiciBoard;
  let rulesOpen = false;

  let statusText = 'Muovi le tessere con le frecce o con uno swipe.';
  let statusTone: 'neutral' | 'player' | 'opponent' = 'neutral';
  let bump: 'player' | 'opponent' | null = null;
  let bumpTimeout: ReturnType<typeof setTimeout>;

  async function handleMove(dir: Dir) {
    if (locked || state.status !== 'playing') return;
    const result = move(state, dir);
    if (!result.moved) return;

    locked = true;
    await boardRef.applyMove(result, dir);
    state = result.state;

    if (result.deadlock) {
      statusTone = 'opponent';
      statusText = 'Campo bloccato: game all’avversario.';
      bump = 'opponent';
    } else if (result.pointsTo === 'player') {
      statusTone = 'player';
      statusText = result.pointsCount > 1 ? `${result.pointsCount} games chiusi verso l’alto.` : 'Game tuo.';
      bump = 'player';
    } else if (result.pointsTo === 'opponent') {
      statusTone = 'opponent';
      statusText =
        result.pointsCount > 1
          ? `${result.pointsCount} games regalati all’avversario.`
          : 'Game all’avversario: era chiuso dalla parte sbagliata.';
      bump = 'opponent';
    }

    if (bump) {
      clearTimeout(bumpTimeout);
      bumpTimeout = setTimeout(() => (bump = null), 350);
    }

    locked = false;
  }

  const KEY_DIRS: Record<string, Dir> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  };

  function onKeydown(e: KeyboardEvent) {
    const dir = KEY_DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    handleMove(dir);
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', onKeydown);
  });

  onDestroy(() => {
    clearTimeout(bumpTimeout);
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', onKeydown);
  });

  function newMatch() {
    state = newGame();
    resetCount += 1;
    statusTone = 'neutral';
    statusText = 'Muovi le tessere con le frecce o con uno swipe.';
    bump = null;
  }
</script>

<div class="flex flex-col gap-4">
  <section class="mb-2">
    <p class="text-sm uppercase tracking-widest font-black text-slate-600">Tennis</p>
    <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Quindici</h1>
    <p class="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-700">
      Il 2048 del tennis: sposta tutte le tessere in una direzione, il 15 è jolly e si somma a
      qualsiasi punto. Il game si chiude solo se lo mandi verso l'alto — nelle altre direzioni lo
      regali all'avversario.
    </p>

    <button
      type="button"
      class="club-btn-yellow mt-4 inline-flex items-center justify-center gap-2 px-5 py-3"
      aria-expanded={rulesOpen}
      aria-controls="quindici-rules"
      on:click={() => (rulesOpen = !rulesOpen)}
    >
      {rulesOpen ? 'Nascondi regole' : 'Regole'}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class={`shrink-0 transition-transform ${rulesOpen ? 'rotate-180' : ''}`}
        aria-hidden="true"
      >
        <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
      </svg>
    </button>

    {#if rulesOpen}
      <div id="quindici-rules" transition:slide={{ duration: 220 }}>
        <div class="mt-3 max-w-3xl border-2 border-black bg-black p-5 md:p-6 text-white flex flex-col gap-4">
          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
              Come si gioca
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Sposti tutte le tessere in una direzione, come in un 2048. Due tessere compatibili che
              si scontrano si sommano in un'unica tessera.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 font-black text-sm">
            <span class="border-2 border-black bg-white px-2 py-1 text-black">15</span>+<span class="border-2 border-black bg-white px-2 py-1 text-black">15</span>=<span class="border-2 border-black px-2 py-1 text-black" style="background:var(--giallo-club)">30</span>
            <span class="mx-2 text-slate-500">·</span>
            <span class="border-2 border-black px-2 py-1 text-black" style="background:var(--giallo-club)">30</span>+<span class="border-2 border-black px-2 py-1 text-black" style="background:var(--giallo-club)">30</span>=<span class="border-2 border-black px-2 py-1 text-white" style="background:var(--viola-tennis)">40</span>
            <span class="mx-2 text-slate-500">·</span>
            <span class="border-2 border-black px-2 py-1 text-white" style="background:var(--viola-tennis)">40</span>+<span class="border-2 border-black px-2 py-1 text-white" style="background:var(--viola-tennis)">40</span>=<span class="border-2 px-2 py-1 bg-black" style="color:var(--giallo-club); border-color:var(--giallo-club)">AD</span>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--verde-tennis)">
              Il 15 è jolly
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Il 15 si somma a qualsiasi tessera: con un 15 il 40 chiude il game, così come l'AD. Le
              altre coppie diverse (30+40, 40+AD…) non si sommano.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--rosso-padel)">
              Direzione e game
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Quando due tessere si sommano fino a chiudere il game (40+15, AD+15 o AD+AD), spariscono
              e la casella resta libera. <b>Solo verso l'alto il game è tuo</b>: chiuderlo in basso, a
              destra o a sinistra lo regala all'avversario.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--blu-padel)">
              Il set
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Vince chi arriva a 6 games con almeno 2 di scarto. Sul 5 pari si va a 7; sul 6 pari
              decide il game successivo, 7-6. Se resti senza mosse possibili, il game va
              all'avversario e il campo si azzera.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <div class="grid grid-cols-[1fr_auto_1fr] items-center border-2 border-black bg-white px-4 py-3 max-w-md w-full mx-auto">
    <div class="flex items-center gap-2">
      <span
        class={`text-3xl font-black leading-none ${bump === 'player' ? 'quindici-bump' : ''}`}
        style="color:var(--verde-tennis)"
      >
        {state.gamesPlayer}
      </span>
      <span class="text-[10px] uppercase tracking-widest font-black text-slate-600">tu</span>
    </div>
    <span class="text-[10px] uppercase tracking-widest font-black text-slate-400">games</span>
    <div class="flex items-center justify-end gap-2">
      <span class="text-[10px] uppercase tracking-widest font-black text-slate-600">avversario</span>
      <span
        class={`text-3xl font-black leading-none ${bump === 'opponent' ? 'quindici-bump' : ''}`}
        style="color:var(--rosso-padel)"
      >
        {state.gamesOpponent}
      </span>
    </div>
  </div>

  <p
    class={`text-center text-xs font-black uppercase tracking-widest h-4 transition-colors ${
      statusTone === 'player'
        ? 'text-[var(--verde-tennis)]'
        : statusTone === 'opponent'
          ? 'text-[var(--rosso-padel)]'
          : 'text-slate-500'
    }`}
  >
    {statusText}
  </p>

  <div class="relative max-w-md w-full mx-auto">
    {#key resetCount}
      <QuindiciBoard bind:this={boardRef} initialTiles={state.tiles} on:swipe={(e) => handleMove(e.detail)} />
    {/key}

    {#if state.status !== 'playing'}
      <div class="absolute inset-4 flex flex-col items-center justify-center gap-3 bg-black/90 border-2 border-black p-6 text-center">
        <p
          class="font-black text-3xl uppercase tracking-widest"
          style={`color:${state.status === 'won' ? 'var(--verde-tennis)' : 'var(--rosso-padel)'}`}
        >
          {state.status === 'won' ? 'Set tuo' : 'Set avversario'}
        </p>
        <p class="font-black text-6xl text-white leading-none">{state.gamesPlayer}-{state.gamesOpponent}</p>
        <p class="text-xs font-semibold text-slate-300 max-w-xs">
          {state.status === 'won'
            ? 'Chiuso dal tuo lato del campo.'
            : 'Troppi games chiusi verso il basso o di lato.'}
        </p>
        <button
          type="button"
          class="club-btn-yellow mt-2 px-6 py-3 font-black uppercase tracking-widest"
          on:click={newMatch}
        >
          Nuova partita
        </button>
      </div>
    {/if}
  </div>

  <div class="flex justify-center">
    <button type="button" class="club-btn px-6 py-3 font-black uppercase tracking-widest" on:click={newMatch}>
      Nuova partita
    </button>
  </div>
</div>

<style>
  @keyframes quindici-bump {
    0% { transform: scale(1); }
    40% { transform: scale(1.35); }
    100% { transform: scale(1); }
  }
  .quindici-bump {
    display: inline-block;
    animation: quindici-bump 0.35s ease;
  }
</style>
