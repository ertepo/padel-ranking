<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import {
    categoryBreakdown,
    currentQuestion,
    newGame,
    submitAnswer,
    QUESTION_TIME_MS,
    QUESTIONS_PER_GAME,
    type GameState,
    type RoundQuestion,
    type TriviaQuestion,
  } from '../../lib/trivia/engine';
  import questionsData from '../../lib/trivia/questions.json';

  const POOL = questionsData as TriviaQuestion[];
  const RESULT_DELAY_MS = 1400;

  // Le 4 opzioni sono tessere "dark-club-card" con ombra colorata, le stesse
  // usate per le foto in home e nelle gallerie dei tornei (vedi index.astro
  // e FieldGallery/PhotoCarousel): niente CSS nuovo, solo lo stesso ciclo di
  // 4 colori già in uso lì. "dark-club-card" da sola ha già l'ombra gialla.
  const OPTION_CARD_CLASSES = [
    'dark-club-card dark-club-card-blue',
    'dark-club-card dark-club-card-violet',
    'dark-club-card',
    'dark-club-card dark-club-card-green',
  ];

  let started = false;
  let showSummary = false;
  let rulesOpen = false;

  let state: GameState = newGame(POOL);
  // La domanda mostrata in campo NON segue state.currentIndex in diretta:
  // dopo aver risposto, state avanza subito ma la UI deve continuare a
  // mostrare la domanda appena risposta (con il feedback) per RESULT_DELAY_MS,
  // quindi questa variabile si aggiorna solo quando inizia la prossima domanda.
  let currentRound: RoundQuestion | null = null;
  let questionNumber = 0;
  let locked = false;
  let lastAnswer: { correct: boolean; points: number; chosenOrderIndex: number | null } | null = null;

  let timeLeftMs = QUESTION_TIME_MS;
  let questionStart = 0;
  let timerHandle: ReturnType<typeof setInterval> | undefined;
  let advanceTimeout: ReturnType<typeof setTimeout>;

  $: correctOrderIndex = currentRound ? currentRound.optionOrder.indexOf(currentRound.question.corretta) : -1;
  $: correctCount = state.answered.filter((a) => a.correct).length;

  const NICKNAME_KEY = 'tie-break:trivia-nickname';
  const NOMECOGNOME_KEY = 'tie-break:trivia-nomecognome';
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

  function clearTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = undefined;
  }

  function startTimer() {
    clearTimer();
    questionStart = Date.now();
    timeLeftMs = QUESTION_TIME_MS;
    timerHandle = setInterval(() => {
      timeLeftMs = Math.max(0, QUESTION_TIME_MS - (Date.now() - questionStart));
      if (timeLeftMs <= 0) {
        clearTimer();
        answer(null);
      }
    }, 100);
  }

  function beginQuestion() {
    currentRound = currentQuestion(state);
    questionNumber = state.currentIndex + 1;
    locked = false;
    lastAnswer = null;
    startTimer();
  }

  // il nickname va verificato/abbinato PRIMA di iniziare, non a fine partita:
  // altrimenti un nickname già in uso da qualcun altro si scopre solo a
  // partita finita, e il punteggio si perde perché non si può più tornare
  // indietro a correggerlo (stesso schema di ScambioGame.verifyNickname).
  // Nickname e nome/cognome sono facoltativi: lasciandoli entrambi vuoti si
  // gioca comunque, semplicemente la partita non entra in classifica.
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
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  function exitGame() {
    clearTimer();
    clearTimeout(advanceTimeout);
    started = false;
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  function newMatch() {
    clearTimer();
    clearTimeout(advanceTimeout);
    state = newGame(POOL);
    showSummary = false;
    scoreSaved = false;
    nicknameError = '';
    beginQuestion();
  }

  function answer(chosenOrderIndex: number | null) {
    if (locked || !currentRound || state.status !== 'playing') return;
    locked = true;
    clearTimer();

    const result = submitAnswer(state, chosenOrderIndex, timeLeftMs);
    state = result.state;
    lastAnswer = { correct: result.correct, points: result.points, chosenOrderIndex };

    advanceTimeout = setTimeout(() => {
      if (state.status === 'finished') {
        showSummary = true;
        submitScore();
      } else {
        beginQuestion();
      }
    }, RESULT_DELAY_MS);
  }

  // salvato a fine partita: se il nickname è già di qualcun altro il punteggio
  // non entra in classifica, ma il riepilogo resta comunque visibile
  async function submitScore() {
    if (!nickname.trim() || !nomecognome.trim()) return; // partita anonima: niente da salvare
    checkingNickname = true;
    try {
      const res = await fetch('/api/trivia-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          nomecognome: nomecognome.trim(),
          points: state.score,
          correctCount,
          totalQuestions: state.questions.length,
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

  const KEY_ANSWERS: Record<string, number> = {
    '1': 0, '2': 1, '3': 2, '4': 3,
    a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3,
  };

  function onKeydown(e: KeyboardEvent) {
    if (!started || showSummary || locked || !currentRound) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const idx = KEY_ANSWERS[e.key];
    if (idx === undefined || idx >= currentRound.optionOrder.length) return;
    e.preventDefault();
    answer(idx);
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', onKeydown);
  });

  onDestroy(() => {
    clearTimer();
    clearTimeout(advanceTimeout);
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', onKeydown);
  });
</script>

<div class="max-w-3xl">
  {#if !started}
    <section>
      <p class="text-sm uppercase tracking-widest font-black text-slate-600">Tennis</p>
      <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Trivia</h1>
      <p class="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-700">
        {QUESTIONS_PER_GAME} domande su regole, storia e curiosità del tennis. Rispondi veloce per il bonus
        velocità, incatena risposte giuste per il bonus streak.
      </p>

      <button
        type="button"
        class="club-btn-yellow mt-4 inline-flex items-center justify-center gap-2 px-5 py-3"
        aria-expanded={rulesOpen}
        aria-controls="trivia-rules"
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
        <div id="trivia-rules" transition:slide={{ duration: 220 }}>
          <div class="mt-3 max-w-3xl border-2 border-black bg-black p-5 md:p-6 text-white flex flex-col gap-4">
            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
                Come si gioca
              </h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                {QUESTIONS_PER_GAME} domande in fila, pescate a caso tra regole, storia e curiosità/terminologia
                del tennis. Per ognuna hai {(QUESTION_TIME_MS / 1000).toFixed(0)} secondi: rispondi toccando
                un'opzione (o con i tasti 1-4 / A-D da desktop).
              </p>
            </div>

            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
                Punteggio
              </h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                Risposta corretta: 100 punti base + fino a 50 di bonus velocità (più rispondi in fretta, più
                bonus prendi). Dalla 3ª risposta corretta consecutiva scatta uno streak che moltiplica il
                punteggio della domanda per 1.5. Risposta sbagliata o tempo scaduto: 0 punti e streak azzerata.
              </p>
            </div>
          </div>
        </div>
      {/if}

      <div class="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl">
        <div class="flex-1">
          <label for="trivia-nickname" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
            Il tuo nickname
          </label>
          <input
            id="trivia-nickname"
            type="text"
            maxlength="20"
            placeholder="Es. SIN"
            class="w-full border border-dashed border-black bg-white px-3 py-2 font-black uppercase tracking-widest text-lg focus:outline-none"
            value={nickname}
            on:input={(e) => onNicknameInput(e.currentTarget.value)}
          />
        </div>

        <div class="flex-1">
          <label for="trivia-nomecognome" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
            Nome e cognome
          </label>
          <input
            id="trivia-nomecognome"
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
        punteggio viene salvato insieme al nickname. Puoi anche lasciarli vuoti e giocare senza
        salvare il punteggio.
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
  {:else if !showSummary}
    <section>
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-black uppercase tracking-widest text-slate-600">
          Domanda {questionNumber}/{state.questions.length}
        </span>
        <span class="text-xs font-black uppercase tracking-widest text-slate-600">
          Streak <span class="text-black">{state.streak}</span>
        </span>
        <span class="text-xl font-black leading-none">{state.score} pt</span>
      </div>

      <div class="mt-2 h-2 w-full border-2 border-black bg-white overflow-hidden">
        <div
          class="h-full"
          style={`width:${(timeLeftMs / QUESTION_TIME_MS) * 100}%; background:${timeLeftMs < 4000 ? 'var(--rosso-padel)' : 'var(--giallo-club)'}; transition: width 100ms linear;`}
        ></div>
      </div>

      {#if currentRound}
        <div class="club-card mt-5 p-5 md:p-6">
          <p class="text-xs font-black uppercase tracking-widest text-slate-500">{currentRound.question.category}</p>
          <p class="mt-2 text-xl md:text-2xl font-black leading-snug text-black">{currentRound.question.domanda}</p>
        </div>

        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#each currentRound.optionOrder as optIndex, i}
            {@const isCorrectSlot = locked && i === correctOrderIndex}
            {@const isWrongChosen = locked && lastAnswer?.chosenOrderIndex === i && !isCorrectSlot}
            <button
              type="button"
              class={`${OPTION_CARD_CLASSES[i]} flex items-center gap-3 p-3 md:p-4 text-left text-sm md:text-base font-black disabled:cursor-not-allowed transition`}
              style={`${isCorrectSlot ? 'background:var(--verde-tennis); color:white;' : ''} ${isWrongChosen ? 'background:var(--rosso-padel); color:white;' : ''} ${locked && !isCorrectSlot && !isWrongChosen ? 'opacity:0.5;' : ''}`}
              disabled={locked}
              on:click={() => answer(i)}
            >
              {currentRound.question.opzioni[optIndex]}
            </button>
          {/each}
        </div>

        {#if locked && lastAnswer}
          <p class="mt-4 text-center text-sm font-black uppercase tracking-widest" style={`color:${lastAnswer.correct ? 'var(--verde-tennis)' : 'var(--rosso-padel)'}`}>
            {lastAnswer.correct ? `Corretto! +${lastAnswer.points} punti` : 'Risposta sbagliata'}
          </p>
        {/if}
      {/if}

      <div class="flex justify-center mt-6">
        <button type="button" class="club-btn px-4 py-2 text-xs font-black uppercase tracking-widest" on:click={exitGame}>
          ← Esci
        </button>
      </div>
    </section>
  {:else}
    <section class="text-center">
      <p class="text-sm uppercase tracking-widest font-black text-slate-600">Partita finita</p>
      <h1 class="text-5xl md:text-6xl font-black leading-none text-black">{state.score} pt</h1>
      <p class="mt-3 text-lg font-bold text-slate-700">
        {correctCount}/{state.questions.length} risposte corrette
      </p>

      <div class="club-card mt-6 p-5 text-left inline-block">
        <p class="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Per categoria</p>
        <ul class="flex flex-col gap-1">
          {#each categoryBreakdown(state) as cat}
            <li class="flex items-center justify-between gap-6 text-sm font-bold">
              <span>{cat.category}</span>
              <span>{cat.correct}/{cat.total}</span>
            </li>
          {/each}
        </ul>
      </div>

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
        <button type="button" class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest" on:click={newMatch}>
          Nuova partita
        </button>
        <button type="button" class="club-btn px-6 py-3 font-black uppercase tracking-widest" on:click={exitGame}>
          Esci
        </button>
      </div>
    </section>
  {/if}
</div>
