<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import {
    LABELS,
    MAX_LEVEL,
    activatePower,
    canUsePower,
    clearColumn,
    clearRow,
    clearValue,
    move,
    movesUntilPower,
    newGame,
    score,
    serializeBoard,
    type Dir,
    type GameState,
    type PowerType,
  } from '../../lib/slice/engine';
  import SliceBoard from './SliceBoard.svelte';
  import IconClearRow from './icons/IconClearRow.svelte';
  import IconClearColumn from './icons/IconClearColumn.svelte';
  import IconClearValue from './icons/IconClearValue.svelte';
  import IconUndo from './icons/IconUndo.svelte';

  // Feature flag temporaneo: i poteri sono implementati e funzionanti, ma non
  // ancora pronti per essere usati dai giocatori. Tenerli nascosti (non solo
  // disabilitati) evita di mostrare una feature a metà durante il rilascio;
  // per riattivarli basta girare questo flag, tutta la logica resta intatta.
  const POWERS_ENABLED = false;

  let state: GameState = newGame();
  let resetCount = 0;
  let locked = false;
  let boardRef: SliceBoard;
  let rulesOpen = false;

  // Su mobile la board deve comparire subito, senza dover scorrere oltre
  // titolo/descrizione/nickname: si parte da una schermata di setup e si
  // passa alla board solo al click, cambiando il DOM nella stessa pagina
  // (stesso pattern usato in ScambioGame per il Legends Game).
  let started = false;

  function startGame() {
    newMatch();
    started = true;
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  function exitGame() {
    started = false;
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  // Nasconde il footer durante il gioco: sulla board una tessera del gioco
  // può capitare vicino al bordo inferiore, e lo swipe rischia di scrollare
  // fino al footer invece di muovere le tessere (stesso accorgimento usato
  // in ScambioGame per la fase 'playing').
  $: if (typeof document !== 'undefined') {
    const footer = document.querySelector('footer');
    if (footer) footer.style.display = started ? 'none' : '';
  }

  // Poteri: 'undo' scatta subito, gli altri tre aprono una selezione sulla
  // board (riga/colonna/tessera da colpire). `previousState` è lo stato
  // com'era prima dell'ultima azione (mossa o potere), unico livello di undo.
  let previousState: GameState | null = null;
  let pendingPower: Exclude<PowerType, 'undo'> | null = null;

  const POWER_SELECT_MODE: Record<Exclude<PowerType, 'undo'>, 'row' | 'col' | 'value'> = {
    clearRow: 'row',
    clearCol: 'col',
    clearValue: 'value',
  };

  const POWER_HINTS: Record<Exclude<PowerType, 'undo'>, string> = {
    clearRow: 'Tocca una riga da cancellare',
    clearCol: 'Tocca una colonna da cancellare',
    clearValue: 'Tocca una tessera: cancella tutte quelle uguali',
  };

  function startPower(power: PowerType) {
    if (locked || state.status !== 'playing' || !canUsePower(state, power)) return;
    if (power === 'undo') {
      doUndo();
      return;
    }
    pendingPower = pendingPower === power ? null : power;
  }

  function cancelPower() {
    pendingPower = null;
  }

  function doUndo() {
    if (!previousState) return;
    const reverted = activatePower(previousState, 'undo');
    previousState = null;
    pendingPower = null;
    boardRef.syncTiles(reverted.tiles);
    state = reverted;
    statusText = 'Ultima mossa annullata.';
    showDefaultHint = false;
  }

  async function onBoardSelect(e: CustomEvent<{ row?: number; col?: number; level?: number }>) {
    if (!pendingPower || locked) return;
    const power = pendingPower;
    let next: GameState | null = null;
    if (power === 'clearRow' && e.detail.row !== undefined) {
      next = clearRow(state, e.detail.row);
    } else if (power === 'clearCol' && e.detail.col !== undefined) {
      next = clearColumn(state, e.detail.col);
    } else if (power === 'clearValue' && e.detail.level !== undefined) {
      next = clearValue(state, e.detail.level);
    }
    if (!next) return;

    pendingPower = null;
    locked = true;
    await boardRef.applyPowerClear(next.tiles);
    previousState = state;
    state = activatePower(next, power);
    statusText = 'Tessere rimosse dal campo.';
    showDefaultHint = false;
    locked = false;

    if (state.status !== 'playing') submitScore();
  }

  let statusText = '';
  let showDefaultHint = true;
  let bump = false;
  let bumpTimeout: ReturnType<typeof setTimeout>;
  let debugSpawnCount = 0; // DEBUG TEMPORANEO

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
          boardSnapshot: serializeBoard(state.tiles),
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

  // colore della mini-tessera in anteprima, coerente con SliceBoard
  function previewBg(level: number): string {
    if (level <= 1) return 'var(--giallo-paglierino)';
    if (level === 2) return 'var(--verde-tennis)';
    if (level === 3) return 'var(--viola-tennis)';
    if (level >= 4 && level <= 9) return 'white';
    if (level >= 10 && level <= 12) return 'var(--rosa-salmone)';
    return 'var(--giallo-club)';
  }

  function previewText(level: number): string {
    return level === 2 || level === 3 ? 'white' : 'black';
  }

  async function handleMove(dir: Dir) {
    if (locked || state.status !== 'playing' || pendingPower) return;
    const result = move(state, dir);
    if (!result.moved) return;

    locked = true;
    await boardRef.applyMove(result);
    previousState = state;
    state = result.state;

    // DEBUG TEMPORANEO: log (livello massimo, tessera entrata) per diagnosi bonus.
    // Il numero progressivo evita che la console accorpi righe identiche.
    if (result.spawned) {
      debugSpawnCount += 1;
      console.log(`[slice] #${debugSpawnCount} livello=${LABELS[state.highestLevel]} | entrata=${LABELS[result.spawned.level]}`);
    }

    if (result.levelUp !== null) {
      statusText = `${LABELS[result.levelUp]} raggiunto!`;
      showDefaultHint = false;
      bump = true;
      clearTimeout(bumpTimeout);
      bumpTimeout = setTimeout(() => (bump = false), 350);
    } else if (state.status === 'playing') {
      showDefaultHint = true;
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
    if (pendingPower) {
      if (e.key === 'Escape') cancelPower();
      return;
    }
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
    if (typeof document !== 'undefined') {
      const footer = document.querySelector('footer');
      if (footer) footer.style.display = '';
    }
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', onKeydown);
  });

  function newMatch() {
    state = newGame();
    resetCount += 1;
    statusText = '';
    showDefaultHint = true;
    bump = false;
    scoreSaved = false;
    nicknameError = '';
    debugSpawnCount = 0; // DEBUG TEMPORANEO
    previousState = null;
    pendingPower = null;
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Setup e board restano SEMPRE montati (mai un {#if}/{:else} che monta/
       smonta <SliceBoard>): in produzione Astro include lo style scoped di
       un componente figlio solo se viene istanziato durante il render
       server-side iniziale, che avviene con `started` sempre false. Se la
       board fosse dietro un {:else} non verrebbe mai renderizzata lì e il
       suo CSS (tessera PUNTO rotonda, animazioni, overlay poteri) sparirebbe
       dal bundle di produzione — bug reale osservato in produzione, invisibile
       in dev perché Vite serve lo style di ogni componente comunque. Si
       nasconde/mostra solo via CSS (class:hidden), non via Svelte {#if}.
  -->
  <section class="mb-2" class:hidden={started}>
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

    <div class="flex justify-center mt-6">
      <button
        type="button"
        class="club-btn-yellow px-8 py-4 text-lg font-black uppercase tracking-widest"
        on:click={startGame}
      >
        Inizia gioco
      </button>
    </div>
  </section>

  <div class:hidden={!started}>
  {#snippet nextPreview()}
    <div
      class="next-tile flex items-center justify-center border-2 border-black h-9 w-9 lg:h-16 lg:w-16 shrink-0 font-black text-center leading-none"
      style={`background:${previewBg(state.nextLevel)};color:${previewText(state.nextLevel)};--fs-mobile:${LABELS[state.nextLevel].length > 2 ? 8 : 13}px;--fs-desktop:${LABELS[state.nextLevel].length > 2 ? 15 : 24}px`}
    >
      {#if state.nextLevel === 0}
        <span class="block h-3.5 w-3.5 lg:h-6 lg:w-6 rounded-full border border-black" style="background:var(--giallo-club)"></span>
      {:else}
        {LABELS[state.nextLevel]}
      {/if}
    </div>
  {/snippet}

  {#snippet powerButtons()}
    <button
      type="button"
      class="club-btn w-full px-1 py-2 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={locked || state.status !== 'playing' || !canUsePower(state, 'clearRow')}
      aria-pressed={pendingPower === 'clearRow'}
      on:click={() => startPower('clearRow')}
    >
      <span class="block w-9 h-9 mx-auto"><IconClearRow /></span>
      Riga
      {#if !canUsePower(state, 'clearRow')}
        <span class="block text-[10px] font-bold normal-case">{movesUntilPower(state, 'clearRow')} mosse</span>
      {/if}
    </button>

    <button
      type="button"
      class="club-btn w-full px-1 py-2 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={locked || state.status !== 'playing' || !canUsePower(state, 'clearCol')}
      aria-pressed={pendingPower === 'clearCol'}
      on:click={() => startPower('clearCol')}
    >
      <span class="block w-9 h-9 mx-auto"><IconClearColumn /></span>
      Colonna
      {#if !canUsePower(state, 'clearCol')}
        <span class="block text-[10px] font-bold normal-case">{movesUntilPower(state, 'clearCol')} mosse</span>
      {/if}
    </button>

    <button
      type="button"
      class="club-btn w-full px-1 py-2 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={locked || state.status !== 'playing' || !canUsePower(state, 'clearValue')}
      aria-pressed={pendingPower === 'clearValue'}
      on:click={() => startPower('clearValue')}
    >
      <span class="block w-9 h-9 mx-auto"><IconClearValue /></span>
      Valore
      {#if !canUsePower(state, 'clearValue')}
        <span class="block text-[10px] font-bold normal-case">{movesUntilPower(state, 'clearValue')} mosse</span>
      {/if}
    </button>

    <button
      type="button"
      class="club-btn w-full px-1 py-2 text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={locked || state.status !== 'playing' || !previousState || !canUsePower(state, 'undo')}
      on:click={() => startPower('undo')}
    >
      <span class="block w-9 h-9 mx-auto"><IconUndo /></span>
      Annulla
      {#if canUsePower(state, 'undo') === false}
        <span class="block text-[10px] font-bold normal-case">{movesUntilPower(state, 'undo')} mosse</span>
      {/if}
    </button>
  {/snippet}

  <!-- Mobile: barra fissa sotto la navbar (Esci / Punti / Prossima) -->
  <div class="lg:hidden fixed inset-x-0 top-14 z-40 flex h-14 items-center justify-between border-b-2 border-black bg-white px-4">
    <button
      type="button"
      class="club-btn px-2 py-1.5 text-[11px] font-black uppercase tracking-widest"
      on:click={exitGame}
    >
      ← Esci
    </button>

    <div class="flex items-baseline gap-1">
      <span class="text-[10px] uppercase tracking-widest font-black text-slate-600">PT:</span>
      <span class={`text-2xl font-black leading-none ${bump ? 'slice-bump' : ''}`}>
        {score(state.tiles)}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-[10px] uppercase tracking-widest font-black text-slate-600">NEXT:</span>
      {@render nextPreview()}
    </div>
  </div>

  <div class="lg:hidden h-12" aria-hidden="true"></div>

  {#if pendingPower}
    <p class="flex items-center justify-center gap-2 text-center text-xs font-black uppercase tracking-widest h-4 text-slate-700">
      <span>{POWER_HINTS[pendingPower]}</span>
      <button type="button" class="underline underline-offset-2" on:click={cancelPower}>Annulla</button>
    </p>
  {:else if showDefaultHint}
    <p class="text-center text-xs font-black uppercase tracking-widest h-4 text-slate-500">
      <span class="lg:hidden">Muovi le tessere con uno swipe.</span>
      <span class="hidden lg:inline">Muovi le tessere con le frecce.</span>
    </p>
  {:else}
    <p class="text-center text-xs font-black uppercase tracking-widest h-4 text-slate-500">
      {statusText}
    </p>
  {/if}

  <div class="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
    <!-- Desktop: colonna sinistra (Esci / Punti / Prossima) -->
    <div class="hidden lg:flex lg:w-40 lg:flex-col lg:gap-3">
      <button
        type="button"
        class="club-btn w-full px-3 py-3 text-xs font-black uppercase tracking-widest"
        on:click={exitGame}
      >
        ← Esci
      </button>

      <div class="border-2 border-black bg-white px-3 py-3 text-center">
        <div class="text-[10px] uppercase tracking-widest font-black text-slate-600">Punti</div>
        <div class={`text-2xl font-black leading-none ${bump ? 'slice-bump' : ''}`}>
          {score(state.tiles)}
        </div>
      </div>

      <div class="flex flex-col items-center gap-2 border-2 border-black bg-white px-3 py-3">
        <span class="text-[10px] uppercase tracking-widest font-black text-slate-600">Prossima</span>
        {@render nextPreview()}
      </div>
    </div>

    <!-- Board -->
    <div class="relative max-w-md w-full mx-auto lg:mx-0 lg:shrink-0">
      {#key resetCount}
        <SliceBoard
          bind:this={boardRef}
          initialTiles={state.tiles}
          selectMode={pendingPower ? POWER_SELECT_MODE[pendingPower] : null}
          on:swipe={(e) => handleMove(e.detail)}
          on:select={onBoardSelect}
        />
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

    <!-- Desktop: colonna destra (poteri) -->
    {#if POWERS_ENABLED}
      <div class="hidden lg:flex lg:w-32 lg:flex-col lg:gap-3">
        {@render powerButtons()}
      </div>
    {/if}
  </div>

  <!-- Mobile: poteri in riga sotto la board -->
  {#if POWERS_ENABLED}
    <div class="lg:hidden grid grid-cols-4 gap-2 max-w-md w-full mx-auto">
      {@render powerButtons()}
    </div>
  {/if}
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
  .next-tile {
    font-size: var(--fs-mobile);
  }
  @media (min-width: 1024px) {
    .next-tile {
      font-size: var(--fs-desktop);
    }
  }
</style>
