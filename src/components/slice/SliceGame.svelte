<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { LABELS, MAX_LEVEL, move, newGame, score, type Dir, type GameState } from '../../lib/slice/engine';
  import SliceBoard from './SliceBoard.svelte';

  let state: GameState = newGame();
  let resetCount = 0;
  let locked = false;
  let boardRef: SliceBoard;
  let rulesOpen = false;

  let statusText = 'Muovi le tessere con le frecce o con uno swipe.';
  let bump = false;
  let bumpTimeout: ReturnType<typeof setTimeout>;

  const NICKNAME_KEY = 'tie-break:slice-nickname';
  const NOMECOGNOME_KEY = 'tie-break:slice-nomecognome';
  let nickname = '';
  let nomecognome = '';
  let nicknameError = '';
  let checkingNickname = false;
  let scoreSaved = false;

  onMount(() => {
    nickname = localStorage.getItem(NICKNAME_KEY) ?? '';
    nomecognome = localStorage.getItem(NOMECOGNOME_KEY) ?? '';
  });

  function onNicknameInput(value: string) {
    nickname = value;
    nicknameError = '';
    localStorage.setItem(NICKNAME_KEY, value);
  }

  function onNomecognomeInput(value: string) {
    nomecognome = value;
    nicknameError = '';
    localStorage.setItem(NOMECOGNOME_KEY, value);
  }

  // salvato a fine partita: se il nickname è già di qualcun altro il punteggio
  // non entra in classifica, ma la partita resta comunque giocabile
  async function submitScore() {
    if (!nickname.trim() || !nomecognome.trim()) {
      nicknameError = 'Inserisci nickname e nome cognome per salvare il punteggio.';
      return;
    }
    checkingNickname = true;
    try {
      const res = await fetch('/api/slice-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          nomecognome: nomecognome.trim(),
          points: score(state.tiles),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        nicknameError = data.error || 'Punteggio non salvato.';
        return;
      }
      scoreSaved = true;
    } catch {
      nicknameError = 'Impossibile salvare il punteggio: controlla la connessione.';
    } finally {
      checkingNickname = false;
    }
  }

  async function handleMove(dir: Dir) {
    if (locked || state.status !== 'playing') return;
    const result = move(state, dir);
    if (!result.moved) return;

    locked = true;
    await boardRef.applyMove(result);
    state = result.state;

    if (result.levelUp !== null) {
      statusText = `${LABELS[result.levelUp]} raggiunto!`;
      bump = true;
      clearTimeout(bumpTimeout);
      bumpTimeout = setTimeout(() => (bump = false), 350);
    } else if (state.status === 'playing') {
      statusText = 'Muovi le tessere con le frecce o con uno swipe.';
    }

    locked = false;

    if (state.status !== 'playing') {
      submitScore();
    }
  }

  const KEY_DIRS: Record<string, Dir> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  };

  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
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
    scoreSaved = false;
    nicknameError = '';
  }
</script>

<div class="flex flex-col gap-4">
  <section class="mb-2">
    <p class="text-sm uppercase tracking-widest font-black text-slate-600">Tennis</p>
    <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Slice</h1>
    <p class="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-700">
      Il 2048 del tennis, edizione match: fai scorrere le tessere lungo la scala PUNTO-15-30-40 e poi
      su per i game e i set, fino al <b>MATCH</b>. Solo PUNTO e 15 si fondono tra loro; da 30 in su
      due tessere identiche si sommano nella tessera successiva.
    </p>

    <button
      type="button"
      class="club-btn-yellow mt-4 inline-flex items-center justify-center gap-2 px-5 py-3"
      aria-expanded={rulesOpen}
      aria-controls="slice-rules"
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
      <div id="slice-rules" transition:slide={{ duration: 220 }}>
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

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
              PUNTO e 15 sono speciali
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              PUNTO (una pallina) e 15 sono le uniche tessere che si sommano <b>fra loro</b>, ed è
              per questo che sono entrambe gialle: PUNTO+15 fa 30. Non si sommano invece con una
              tessera uguale a sé stessa. Da 30 in poi funziona come un doppione classico:
              30+30=40, 40+40=1°GAME, e così via.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 font-black text-sm">
            <span class="border-2 border-black px-2 py-1 text-black" style="background:var(--giallo-paglierino)">PUNTO</span>+<span class="border-2 border-black px-2 py-1 text-black" style="background:var(--giallo-paglierino)">15</span>=<span class="border-2 border-black px-2 py-1 text-white" style="background:var(--verde-tennis)">30</span>
            <span class="mx-2 text-slate-500">·</span>
            <span class="border-2 border-black px-2 py-1 text-white" style="background:var(--verde-tennis)">30</span>+<span class="border-2 border-black px-2 py-1 text-white" style="background:var(--verde-tennis)">30</span>=<span class="border-2 border-black px-2 py-1 text-white" style="background:var(--viola-tennis)">40</span>
            <span class="mx-2 text-slate-500">·</span>
            <span class="border-2 border-black px-2 py-1 text-white" style="background:var(--viola-tennis)">40</span>+<span class="border-2 border-black px-2 py-1 text-white" style="background:var(--viola-tennis)">40</span>=<span class="border-2 border-black bg-white px-2 py-1 text-black">1°GAME</span>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--rosa-salmone)">
              Game, set, match
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              I game (1°GAME...6°GAME) sono bianchi, i set (1°SET...3°SET) rosa salmone. Due 6°GAME
              fanno 1°SET, due 3°SET fanno <b>MATCH</b>: raggiungerlo (fondendone due) vince la
              partita.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--rosso-padel)">
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

    <div class="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl">
      <div class="flex-1">
        <label for="slice-nickname" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
          Il tuo nickname
        </label>
        <input
          id="slice-nickname"
          type="text"
          maxlength="20"
          placeholder="Es. SIN"
          class="w-full border border-dashed border-black bg-white px-3 py-2 font-black uppercase tracking-widest text-lg focus:outline-none"
          value={nickname}
          on:input={(e) => onNicknameInput(e.currentTarget.value)}
        />
      </div>

      <div class="flex-1">
        <label for="slice-nomecognome" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
          Nome e cognome
        </label>
        <input
          id="slice-nomecognome"
          type="text"
          maxlength="60"
          placeholder="Es. Mario Rossi"
          class="w-full border border-dashed border-black bg-white px-3 py-2 font-black text-lg focus:outline-none"
          value={nomecognome}
          on:input={(e) => onNomecognomeInput(e.currentTarget.value)}
        />
      </div>
    </div>

    <p class="mt-2 max-w-xl text-xs font-bold text-slate-500">
      La prima volta abbina il nickname a nome e cognome, così resta solo tuo: a fine partita il
      punteggio viene salvato insieme al nickname.
    </p>

    {#if checkingNickname}
      <p class="mt-2 text-xs font-black uppercase tracking-widest text-slate-500">Salvo il punteggio…</p>
    {:else if nicknameError}
      <p class="mt-2 text-xs font-black uppercase tracking-widest text-[var(--rosso-padel)]">{nicknameError}</p>
    {/if}
  </section>

  <div class="flex items-center justify-center gap-3 border-2 border-black bg-white px-4 py-3 max-w-md w-full mx-auto">
    <span class="text-[10px] uppercase tracking-widest font-black text-slate-600">Livello</span>
    <span class={`text-2xl font-black leading-none ${bump ? 'slice-bump' : ''}`}>
      {LABELS[state.highestLevel]}
    </span>
  </div>

  <p class="text-center text-xs font-black uppercase tracking-widest h-4 text-slate-500">
    {statusText}
  </p>

  <div class="relative max-w-md w-full mx-auto">
    {#key resetCount}
      <SliceBoard bind:this={boardRef} initialTiles={state.tiles} on:swipe={(e) => handleMove(e.detail)} />
    {/key}

    {#if state.status !== 'playing'}
      <div class="absolute inset-4 flex flex-col items-center justify-center gap-3 bg-black/90 border-2 border-black p-6 text-center">
        <p
          class="font-black text-3xl uppercase tracking-widest"
          style={`color:${state.status === 'won' ? 'var(--verde-tennis)' : 'var(--rosso-padel)'}`}
        >
          {state.status === 'won' ? 'Hai vinto!' : 'Game over'}
        </p>
        <p class="font-black text-xl text-white">Livello raggiunto: {LABELS[state.highestLevel]}</p>
        <p class="font-black text-lg" style="color: var(--giallo-club)">Punti: {score(state.tiles)}</p>
        <p class="text-xs font-semibold text-slate-300 max-w-xs">
          {state.status === 'won'
            ? `Hai completato il ${LABELS[MAX_LEVEL]}.`
            : 'Nessuna mossa possibile.'}
        </p>
        {#if scoreSaved}
          <p class="text-xs font-black uppercase tracking-widest" style="color: var(--verde-tennis)">
            Punteggio salvato!
          </p>
        {:else if nicknameError}
          <p class="text-xs font-black uppercase tracking-widest text-[var(--rosso-padel)]">{nicknameError}</p>
        {/if}
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
  @keyframes slice-bump {
    0% { transform: scale(1); }
    40% { transform: scale(1.35); }
    100% { transform: scale(1); }
  }
  .slice-bump {
    display: inline-block;
    animation: slice-bump 0.35s ease;
  }
</style>
