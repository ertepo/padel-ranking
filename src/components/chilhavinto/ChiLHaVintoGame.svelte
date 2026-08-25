<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { currentRound, newGame, submitAnswer, LEVEL_TIME_MS, type GameState, type RoundLevel } from '../../lib/chilhavinto/engine';
  import levelsData from '../../lib/chilhavinto/levels.json';
  import type { SlamLevel } from '../../lib/chilhavinto/engine';

  const LEVELS = levelsData as SlamLevel[];
  const TOTAL_LEVELS = LEVELS.length;
  const RESULT_DELAY_MS = 1600;

  // Stessi colori delle tessere di TheBattleGame: sfondo a piena pagina che
  // segue lo stato di gioco invece di una classe su una singola sezione,
  // perché durante il turno il gioco occupa tutto lo schermo (niente header/footer).
  const GENDER_BACKGROUND: Record<'M' | 'F', string> = { M: '#93c5fd', F: '#fca5a5' };

  let started = false;
  let showSummary = false;
  let rulesOpen = false;

  let state: GameState = newGame(LEVELS);
  let currentLevel: RoundLevel | null = null;
  let levelNumber = 0;
  let locked = false;
  let lastAnswer: { correct: boolean; chosen: string | null } | null = null;

  let timeLeftMs = LEVEL_TIME_MS;
  let questionStart = 0;
  let timerHandle: ReturnType<typeof setInterval> | undefined;
  let advanceTimeout: ReturnType<typeof setTimeout>;

  $: bestLevel = state.currentIndex;
  // A schermo intero (senza header/footer del sito) solo mentre si gioca
  // davvero: la schermata iniziale e il riepilogo finale restano nella
  // pagina normale.
  $: playing = started && !showSummary && currentLevel !== null;

  const NICKNAME_KEY = 'tie-break:chilhavinto-nickname';
  const NOMECOGNOME_KEY = 'tie-break:chilhavinto-nomecognome';
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

  /** "Jannik Sinner" -> ["Jannik", "SINNER"]; cognomi con più parole restano insieme. */
  function splitName(full: string): [string, string] {
    const idx = full.indexOf(' ');
    if (idx === -1) return [full, ''];
    return [full.slice(0, idx), full.slice(idx + 1).toUpperCase()];
  }

  function setChromeHidden(hidden: boolean) {
    if (typeof document === 'undefined') return;
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    if (header) header.style.display = hidden ? 'none' : '';
    if (footer) footer.style.display = hidden ? 'none' : '';
    document.body.style.overflow = hidden ? 'hidden' : '';
  }

  onMount(() => {
    document.body.style.transition = 'background 200ms ease';
  });

  $: if (typeof document !== 'undefined') {
    setChromeHidden(playing);
    document.body.style.background = playing && currentLevel ? GENDER_BACKGROUND[currentLevel.level.gender] : '';
  }

  function clearTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = undefined;
  }

  function startTimer() {
    clearTimer();
    questionStart = Date.now();
    timeLeftMs = LEVEL_TIME_MS;
    timerHandle = setInterval(() => {
      timeLeftMs = Math.max(0, LEVEL_TIME_MS - (Date.now() - questionStart));
      if (timeLeftMs <= 0) {
        clearTimer();
        answer(null);
      }
    }, 100);
  }

  function beginLevel() {
    currentLevel = currentRound(state);
    levelNumber = state.currentIndex + 1;
    locked = false;
    lastAnswer = null;
    startTimer();
  }

  async function verifyNickname(): Promise<boolean> {
    const hasNickname = nickname.trim() !== '';
    const hasNomecognome = nomecognome.trim() !== '';
    if (!hasNickname && !hasNomecognome) return true;
    if (!hasNickname || !hasNomecognome) {
      nicknameError = 'Inserisci sia nickname che nome e cognome, oppure lasciali entrambi vuoti per giocare senza salvare il punteggio.';
      return false;
    }
    checkingNickname = true;
    try {
      const res = await fetch('/api/game-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), nomecognome: nomecognome.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        nicknameError = data.error || 'Nickname non disponibile.';
        return false;
      }
      return true;
    } catch {
      nicknameError = 'Impossibile verificare il nickname: controlla la connessione.';
      return false;
    } finally {
      checkingNickname = false;
    }
  }

  async function startGame() {
    const verified = await verifyNickname();
    if (!verified) return;
    newMatch();
    started = true;
  }

  function newMatch() {
    clearTimer();
    clearTimeout(advanceTimeout);
    state = newGame(LEVELS);
    showSummary = false;
    scoreSaved = false;
    nicknameError = '';
    beginLevel();
  }

  function answer(chosen: string | null) {
    if (locked || !currentLevel || state.status !== 'playing') return;
    locked = true;
    clearTimer();

    const result = submitAnswer(state, chosen);
    state = result.state;
    lastAnswer = { correct: result.correct, chosen };

    advanceTimeout = setTimeout(() => {
      if (state.status !== 'playing') {
        showSummary = true;
        submitScore();
      } else {
        beginLevel();
      }
    }, RESULT_DELAY_MS);
  }

  async function submitScore() {
    if (!nickname.trim() || !nomecognome.trim()) return;
    checkingNickname = true;
    try {
      const res = await fetch('/api/chilhavinto-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          nomecognome: nomecognome.trim(),
          levelReached: state.currentIndex,
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

  onDestroy(() => {
    clearTimer();
    clearTimeout(advanceTimeout);
    if (typeof document === 'undefined') return;
    document.body.style.background = '';
    setChromeHidden(false);
  });
</script>

{#if !started}
  <div class="max-w-3xl">
    <section>
      <p class="text-sm uppercase tracking-widest font-black text-slate-600">Tennis</p>
      <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Chi l'ha vinto?</h1>
      <p class="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-700">
        {TOTAL_LEVELS} finali Slam dal 1980 a oggi: indovina chi ha vinto prima
        che scadano gli {(LEVEL_TIME_MS / 1000).toFixed(0)} secondi. Se sbagli o scade il tempo hai perso: arriva più lontano che puoi.
      </p>

      <button
        type="button"
        class="club-btn-yellow mt-4 inline-flex items-center justify-center gap-2 px-5 py-3"
        aria-expanded={rulesOpen}
        aria-controls="chilhavinto-rules"
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
        <div id="chilhavinto-rules" transition:slide={{ duration: 220 }}>
          <div class="mt-3 max-w-3xl border-2 border-black bg-black p-5 md:p-6 text-white flex flex-col gap-4">
            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
                Come si gioca
              </h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                Ogni livello mostra una finale Slam (torneo e anno) e i suoi due finalisti: tocca il nome di chi
                ha vinto quella finale. Hai {(LEVEL_TIME_MS / 1000).toFixed(0)} secondi per rispondere. Sfondo blu per le
                finali maschili, rosa per quelle femminili.
              </p>
            </div>

            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
                Punteggio
              </h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                Il punteggio è il numero di livelli superati: appena sbagli o il tempo scade, la corsa finisce.
                I primi livelli sono le finali più recenti, poi si torna indietro nel tempo verso quelle più
                antiche e meno conosciute.
              </p>
            </div>
          </div>
        </div>
      {/if}

      <div class="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl">
        <div class="flex-1">
          <label for="chilhavinto-nickname" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
            Il tuo nickname
          </label>
          <input
            id="chilhavinto-nickname"
            type="text"
            maxlength="20"
            placeholder="Es. SIN"
            class="w-full border border-dashed border-black bg-white px-3 py-2 font-black uppercase tracking-widest text-lg focus:outline-none"
            value={nickname}
            on:input={(e) => onNicknameInput(e.currentTarget.value)}
          />
        </div>

        <div class="flex-1">
          <label for="chilhavinto-nomecognome" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
            Nome e cognome
          </label>
          <input
            id="chilhavinto-nomecognome"
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
        La prima volta abbina il nickname a nome e cognome, così resta solo tuo: a fine partita il livello
        raggiunto viene salvato insieme al nickname. Puoi anche lasciarli vuoti e giocare senza salvare il
        punteggio.
      </p>

      {#if nicknameError}
        <p class="mt-2 text-xs font-black uppercase tracking-widest text-[var(--rosso-padel)]">{nicknameError}</p>
      {/if}

      <div class="flex justify-center mt-6">
        <button
          type="button"
          class="club-btn-yellow px-8 py-4 text-lg font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={checkingNickname}
          on:click={startGame}
        >
          {checkingNickname ? 'Verifico nickname…' : 'Inizia gioco'}
        </button>
      </div>
    </section>
  </div>
{:else if playing && currentLevel}
  <div class="fixed inset-0 z-40 flex flex-col overflow-y-auto p-4 md:p-6" style="height: 100dvh;">
    <a href="/arcade/chilhavinto" class="self-start shrink-0 text-xs font-black uppercase tracking-widest text-black/60 hover:text-black">
      ← Esci
    </a>

    <div class="flex flex-1 items-center justify-center py-4">
      <div class="w-full max-w-2xl">
      
        <section>
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-black uppercase tracking-widest text-black/70">
              Livello {levelNumber}/{TOTAL_LEVELS}
            </span>
            <span class="text-xl font-black leading-none text-black">Superati: {levelNumber - 1}</span>
          </div>

          <div class="mt-2 h-2 w-full border-2 border-black bg-white overflow-hidden">
            <div
              class="h-full"
              style={`width:${(timeLeftMs / LEVEL_TIME_MS) * 100}%; background:${timeLeftMs < 3000 ? 'var(--rosso-padel)' : 'var(--giallo-club)'}; transition: width 100ms linear;`}
            ></div>
          </div>

          <div class="club-card mt-5 p-5 md:p-6 text-center">
            <p class="text-xs font-black uppercase tracking-widest text-slate-500">
              {currentLevel.level.gender === 'F' ? 'Finale femminile' : 'Finale maschile'}
            </p>
            <h2 class="mt-2 text-2xl md:text-3xl font-black leading-tight text-black">
              {currentLevel.level.tournament} {currentLevel.level.year}
            </h2>
            <p class="mt-2 text-sm font-bold text-slate-600">Chi ha vinto questa finale?</p>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3">
            {#each currentLevel.options as name}
              {@const [nome, cognome] = splitName(name)}
              {@const isWinner = name === currentLevel.level.winner}
              {@const isChosen = locked && lastAnswer?.chosen === name}
              {@const revealWinner = locked && isWinner}
              <button
                type="button"
                class="dark-club-card flex flex-col items-center justify-center gap-1 p-4 md:p-6 text-center disabled:cursor-not-allowed transition"
                style={`${revealWinner ? 'background:var(--verde-tennis); color:white;' : ''} ${isChosen && !isWinner ? 'background:var(--rosso-padel); color:white;' : ''} ${locked && !revealWinner && !isChosen ? 'opacity:0.5;' : ''}`}
                disabled={locked}
                on:click={() => answer(name)}
              >
                <span class="text-sm md:text-base font-bold">{nome}</span>
                <span class="text-lg md:text-2xl font-black uppercase tracking-wide leading-none">{cognome}</span>
              </button>
            {/each}
          </div>

          <div class="mt-4 min-h-20 text-center">
            {#if locked && lastAnswer}
              <p class="text-sm font-black uppercase tracking-widest" style={`color:${lastAnswer.correct ? 'var(--verde-tennis)' : 'var(--rosso-padel)'}`}>
                {lastAnswer.correct ? 'Corretto!' : lastAnswer.chosen === null ? 'Tempo scaduto' : 'Sbagliato'}
              </p>
              <p class="mt-1 text-xs font-bold text-black/70">{currentLevel.level.score} — {currentLevel.level.note}</p>
            {/if}
          </div>
        </section>
      </div>
    </div>
  </div>
{:else}
  <div class="max-w-3xl">
    <a href="/arcade/chilhavinto" class="self-start shrink-0 text-xs font-black uppercase tracking-widest text-black/60 hover:text-black">
      ← Esci
    </a><section class="text-center">
    
      <p class="text-sm uppercase tracking-widest font-black text-slate-600">Partita finita</p>
      <h1 class="text-5xl md:text-6xl font-black leading-none text-black">
        Livello {bestLevel}/{TOTAL_LEVELS}
      </h1>
      <p class="mt-3 text-lg font-bold text-slate-700">
        {bestLevel === 0 ? 'Sbagliato subito il primo livello: riprova!' : `${bestLevel} finali indovinate di fila.`}
      </p>

      <div class="mt-6">
        {#if checkingNickname}
          <p class="text-xs font-black uppercase tracking-widest text-slate-500">Salvo il punteggio…</p>
        {:else if scoreSaved}
          <p class="text-xs font-black uppercase tracking-widest" style="color: var(--verde-tennis)">Punteggio salvato!</p>
        {:else if nicknameError}
          <p class="text-xs font-black uppercase tracking-widest text-[var(--rosso-padel)]">{nicknameError}</p>
        {/if}
      </div>

      <div class="flex flex-wrap justify-center gap-3 mt-4">
        <button type="button" class="club-btn-yellow px-8 py-4 text-lg font-black uppercase tracking-widest" on:click={newMatch}>
          Nuova partita
        </button>
      </div>
    </section>
  </div>
{/if}
