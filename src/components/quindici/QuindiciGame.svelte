<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { MAX_LEVEL, move, newGame, type Dir, type GameState } from '../../lib/quindici/engine';
  import QuindiciBoard from './QuindiciBoard.svelte';

  let state: GameState = newGame();
  let resetCount = 0;
  let locked = false;
  let boardRef: QuindiciBoard;
  let rulesOpen = false;

  let statusText = 'Muovi le tessere con le frecce o con uno swipe.';
  let bump = false;
  let bumpTimeout: ReturnType<typeof setTimeout>;

  async function handleMove(dir: Dir) {
    if (locked || state.status !== 'playing') return;
    const result = move(state, dir);
    if (!result.moved) return;

    locked = true;
    await boardRef.applyMove(result);
    state = result.state;

    if (result.levelUp !== null) {
      statusText = `Livello ${result.levelUp} raggiunto!`;
      bump = true;
      clearTimeout(bumpTimeout);
      bumpTimeout = setTimeout(() => (bump = false), 350);
    } else if (state.status === 'playing') {
      statusText = 'Muovi le tessere con le frecce o con uno swipe.';
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
    statusText = 'Muovi le tessere con le frecce o con uno swipe.';
    bump = false;
  }
</script>

<div class="flex flex-col gap-4">
  <section class="mb-2">
    <p class="text-sm uppercase tracking-widest font-black text-slate-600">Tennis</p>
    <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Quindici</h1>
    <p class="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-700">
      Il 2048 del tennis: somma le tessere lungo la scala 15-30-40-AD. Completarla non chiude il
      punto, ma apre il <b>livello successivo</b> — una scala tutta nuova, che parte da 0 e
      interagisce solo con sé stessa. Supera il livello {MAX_LEVEL} per vincere.
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
          <div class="flex flex-wrap items-center gap-2 font-black text-sm">
            <span class="border-2 border-black bg-slate-200 px-2 py-1 text-black">0</span>+<span class="border-2 border-black bg-white px-2 py-1 text-black">15</span>=<span class="border-2 border-black px-2 py-1 text-black" style="background:var(--giallo-club)">30</span>
            <span class="mx-2 text-slate-500">·</span>
            <span class="border-2 px-2 py-1 bg-black" style="color:var(--giallo-club); border-color:var(--giallo-club)">AD</span>+<span class="border-2 px-2 py-1 bg-black" style="color:var(--giallo-club); border-color:var(--giallo-club)">AD</span>=<span class="border-2 px-2 py-1 bg-slate-200 text-black" style="border-color:var(--blu-padel)">1.0</span>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--verde-tennis)">
              Lo 0 è jolly
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              La tessera "0" è il jolly di ogni livello, incluso quello base: è lei a spawnare più
              spesso. Si somma con qualsiasi altra tessera del suo livello e la fa avanzare
              (0+15→30, 0+30→40); con il 40 o con l'AD completa direttamente il livello. Il 15
              invece non è jolly: si somma solo con un altro 15, esattamente come 30, 40 e AD si
              sommano solo con sé stessi. Sul campo lo "0" non ha un numero: è una pallina colorata.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--rosso-padel)">
              I livelli
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Completare la scala di un livello (con il jolly 0, oppure con AD+AD) fa nascere il
              <b>seme del livello successivo</b>. Da lì riparte la stessa scala, ma
              <b>isolata</b>: non si fonde mai con le tessere di un livello diverso. Ogni livello ha
              un colore (0 blu, 1 verde, 2 giallo, 3 rosso, 4 viola, 5 nero), sempre più intenso man
              mano che la tessera cresce lungo la scala; il numero del livello è scritto anche
              nell'angolo in alto a sinistra di ogni tessera. Supera il livello {MAX_LEVEL} per
              vincere la partita.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--blu-padel)">
              Fine partita
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Se resti senza mosse possibili la partita finisce lì: game over, come in un 2048
              qualunque.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <div class="flex items-center justify-center gap-3 border-2 border-black bg-white px-4 py-3 max-w-md w-full mx-auto">
    <span class="text-[10px] uppercase tracking-widest font-black text-slate-600">Livello</span>
    <span class={`text-3xl font-black leading-none ${bump ? 'quindici-bump' : ''}`}>
      {state.highestLevel}
    </span>
    <span class="text-xs font-black text-slate-400">/ {MAX_LEVEL}</span>
  </div>

  <p class="text-center text-xs font-black uppercase tracking-widest h-4 text-slate-500">
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
          {state.status === 'won' ? 'Hai vinto!' : 'Game over'}
        </p>
        <p class="font-black text-xl text-white">Livello raggiunto: {state.highestLevel}</p>
        <p class="text-xs font-semibold text-slate-300 max-w-xs">
          {state.status === 'won'
            ? `Hai completato il livello ${MAX_LEVEL}.`
            : 'Nessuna mossa possibile.'}
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
