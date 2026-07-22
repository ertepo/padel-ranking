<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import playersData from '../../lib/game/players.json';
  import { matchParams, STYLE_LABELS, type Difficulty, type Player, type Surface } from '../../lib/game/matchup';
  import type { ReplayConfig } from '../../lib/game/replay';
  import RosterDraft from './RosterDraft.svelte';
  import GameSetup from './GameSetup.svelte';
  import DeciderSetup from './DeciderSetup.svelte';
  import ScambioBoard from './ScambioBoard.svelte';
  import Scoreboard from './Scoreboard.svelte';

  export let replayConfig: ReplayConfig | null = null;

  const ALL_PLAYERS = playersData as Player[];
  const SURFACES: Surface[] = ['terra', 'erba', 'cemento'];

  const SURFACE_LABELS: Record<Surface, string> = { terra: 'Terra rossa', erba: 'Erba', cemento: 'Cemento' };
  const SURFACE_COLORS: Record<Surface, string> = { erba: '#578a33', terra: '#ad5f18', cemento: '#3b6582' };

  function strengthDots(strength: number) {
    return '★'.repeat(strength) + '☆'.repeat(5 - strength);
  }

  function nameClass(name: string) {
    if (name.length >= 12) return 'text-[10px] tracking-tight';
    if (name.length >= 8) return 'text-xs';
    return 'text-sm';
  }

  function pickRandom<T>(arr: T[], count: number): T[] {
    const copy = [...arr];
    const picked: T[] = [];
    for (let i = 0; i < count && copy.length; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(idx, 1)[0]);
    }
    return picked;
  }

  function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  type Phase = 'draft' | 'setup' | 'decider' | 'playing' | 'matchEnd';

  let phase: Phase = 'draft';

  // durante il match il footer non serve: si vede già nella schermata di draft
  // in setup/playing la pagina non deve scorrere: su mobile lo scroll fa comparire/sparire
  // la barra degli indirizzi, spostando i tap a metà gesto (schermata di setup fixed più sotto)
  $: if (typeof document !== 'undefined') {
    const footer = document.querySelector('footer');
    if (footer) footer.style.display = phase === 'draft' ? '' : 'none';
    document.body.style.overflow = phase === 'setup' || phase === 'playing' ? 'hidden' : '';
  }
  onDestroy(() => {
    clearTimeout(shareStatusTimeout);
    if (typeof document === 'undefined') return;
    const footer = document.querySelector('footer');
    if (footer) footer.style.display = '';
    document.body.style.overflow = '';
  });

  // la schermata di setup occupa tutta l'altezza sotto l'header (anch'esso sticky)
  let headerOffset = 0;

  const NICKNAME_KEY = 'tie-break:scambio-nickname';
  const NOMECOGNOME_KEY = 'tie-break:scambio-nomecognome';
  let nickname = '';
  let nomecognome = '';
  let nicknameError = '';
  let checkingNickname = false;
  let regolamentoOpen = false;

  onMount(() => {
    const header = document.querySelector('header');
    if (header) headerOffset = header.getBoundingClientRect().height;
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

  // il nickname va abbinato la prima volta a nome e cognome: evita che due
  // giocatori diversi rivendichino lo stesso nickname in classifica
  async function verifyNickname(): Promise<boolean> {
    if (!nickname.trim() || !nomecognome.trim()) {
      nicknameError = 'Inserisci nickname e nome cognome per giocare.';
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

  let lastScoreId: string | number | null = null;

  async function submitScore() {
    lastScoreId = null;
    try {
      const res = await fetch('/api/game-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim() || 'Anonimo',
          nomecognome: nomecognome.trim(),
          match_score: `${playerScore}-${cpuScore}`,
          points: totalPoints,
          difficulty,
          surface,
          player_roster: playerRoster.map((p) => p.name),
          cpu_roster: cpuRoster.map((p) => p.name),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id != null) lastScoreId = data.id;
    } catch {
      // punteggio non salvato: non blocchiamo la fine partita per un errore di rete
    }
  }

  let shareStatus: '' | 'copied' | 'error' = '';
  let shareStatusTimeout: ReturnType<typeof setTimeout> | undefined;

  async function shareMatch() {
    if (!lastScoreId) return;
    const url = `${window.location.origin}/game?replay=${lastScoreId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Gioco delle leggende', text: 'Batti il mio punteggio!', url });
      } catch {
        // condivisione nativa annullata dall'utente: nessun fallback necessario
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      shareStatus = 'copied';
    } catch {
      shareStatus = 'error';
    }
    clearTimeout(shareStatusTimeout);
    shareStatusTimeout = setTimeout(() => (shareStatus = ''), 2500);
  }

  // vero finché non si preme "Nuova partita": mostra il roster bloccato della
  // sfida invece del draft libero, in coerenza con superficie/difficoltà
  let replayActive = !!replayConfig;

  let surface: Surface = replayConfig?.surface ?? SURFACES[Math.floor(Math.random() * SURFACES.length)];
  let cpuRoster: Player[] = replayConfig?.cpuRoster ?? pickRandom(ALL_PLAYERS, 6);
  let playerRoster: Player[] = [];

  let playerScore = 0;
  let cpuScore = 0;
  let gameNumber = 1;
  let totalPoints = 0;

  // tennisti già schierati nel ciclo corrente: non riselezionabili finché non
  // sono stati usati tutti e 6, poi il pool si resetta (per entrambi i lati)
  let usedByPlayerNames = new Set<string>();
  let usedByCpuNames = new Set<string>();

  // sul 6 pari si gioca un game secco tra due tennisti a caso
  let deciderActive = false;
  let deciderWinnerIsPlayer: boolean | null = null;

  let cpuCurrentPlayer: Player;
  let playerCurrentPlayer: Player;
  let currentParams: ReturnType<typeof matchParams>;
  let difficulty: Difficulty = replayConfig?.difficulty ?? '1';

  const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; color: string; textColor: string }[] = [
    { value: '1', label: '1', color: 'var(--blu-bilanciato)', textColor: 'text-white' },
    { value: '2', label: '2', color: 'var(--verde-tennis)', textColor: 'text-black' },
    { value: '3', label: '3', color: 'var(--giallo-club)', textColor: 'text-white' },
    { value: '4', label: '4', color: 'var(--rosso-padel)', textColor: 'text-white' },
    { value: '5', label: '5', color: 'var(--viola-tennis)', textColor: 'text-white' },
    { value: 'ultra', label: 'ULTRA', color: '#000000', textColor: 'text-white' },
  ];

  $: target = playerScore >= 5 && cpuScore >= 5 ? 7 : 6;

  function startMatch() {
    phase = 'draft';
    replayActive = false;
    surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
    cpuRoster = pickRandom(ALL_PLAYERS, 6);
    playerRoster = [];
    playerScore = 0;
    cpuScore = 0;
    gameNumber = 1;
    totalPoints = 0;
    usedByPlayerNames = new Set();
    usedByCpuNames = new Set();
    deciderActive = false;
    deciderWinnerIsPlayer = null;
    lastScoreId = null;
  }

  // "Rigioca": stessa superficie/difficoltà/roster già in memoria, nessuna
  // dipendenza dal salvataggio precedente. Sequenza colpi e abbinamento
  // CPU-per-game restano casuali come in una partita normale.
  function replaySameMatch() {
    phase = 'setup';
    playerScore = 0;
    cpuScore = 0;
    gameNumber = 1;
    totalPoints = 0;
    usedByPlayerNames = new Set();
    usedByCpuNames = new Set();
    deciderActive = false;
    deciderWinnerIsPlayer = null;
    lastScoreId = null;
    cpuCurrentPlayer = randomFrom(cpuRoster);
    playerCurrentPlayer = playerRoster[0];
    window.scrollTo(0, 0);
  }

  async function onDraftConfirm(selected: Player[]) {
    const verified = await verifyNickname();
    if (!verified) {
      window.scrollTo(0, 0);
      return;
    }

    playerRoster = selected;
    usedByPlayerNames = new Set();
    usedByCpuNames = new Set();
    cpuCurrentPlayer = randomFrom(cpuRoster);
    playerCurrentPlayer = playerRoster[0];
    phase = 'setup';
    window.scrollTo(0, 0);
  }

  function onSelectPlayer(player: Player) {
    if (usedByPlayerNames.has(player.name)) return;
    playerCurrentPlayer = player;
  }

  function onStartGame() {
    currentParams = matchParams(difficulty, playerCurrentPlayer, cpuCurrentPlayer, surface, gameNumber);
    phase = 'playing';
    window.scrollTo(0, 0);
  }

  function startDecider() {
    playerCurrentPlayer = randomFrom(playerRoster);
    cpuCurrentPlayer = randomFrom(cpuRoster);
    phase = 'decider';
  }

  function onStartDecider() {
    currentParams = matchParams(difficulty, playerCurrentPlayer, cpuCurrentPlayer, surface, gameNumber + 1);
    deciderActive = true;
    phase = 'playing';
    window.scrollTo(0, 0);
  }

  function onGameResult(win: boolean, points: number) {
    window.scrollTo(0, 0);
    totalPoints += points;

    if (deciderActive) {
      deciderActive = false;
      deciderWinnerIsPlayer = win;
      phase = 'matchEnd';
      submitScore();
      return;
    }

    if (win) playerScore += 1;
    else cpuScore += 1;

    usedByPlayerNames = new Set(usedByPlayerNames).add(playerCurrentPlayer.name);
    usedByCpuNames = new Set(usedByCpuNames).add(cpuCurrentPlayer.name);
    if (usedByPlayerNames.size >= playerRoster.length) usedByPlayerNames = new Set();
    if (usedByCpuNames.size >= cpuRoster.length) usedByCpuNames = new Set();

    if (playerScore === 6 && cpuScore === 6) {
      startDecider();
      return;
    }

    const nextTarget = playerScore >= 5 && cpuScore >= 5 ? 7 : 6;
    if (playerScore >= nextTarget || cpuScore >= nextTarget) {
      phase = 'matchEnd';
      submitScore();
      return;
    }

    gameNumber += 1;
    cpuCurrentPlayer = randomFrom(cpuRoster.filter((p) => !usedByCpuNames.has(p.name)));
    playerCurrentPlayer = playerRoster.find((p) => !usedByPlayerNames.has(p.name)) ?? playerRoster[0];
    phase = 'setup';
  }
</script>

<div class="flex flex-col gap-4">
  {#if phase === 'draft'}
    <section class="mb-2">
      <p class="text-sm uppercase tracking-widest font-black text-slate-600">Tennis</p>
      <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Gioco delle leggende</h1>
      <p class="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-700">
        Scegli il tuo roster di 6 leggende del tennis e sfida l'avversario: memorizza la sequenza di colpi e ripetila prima che scada il tempo. Primo a 6 game vince il match.
      </p>

      {#if replayActive && replayConfig}
        <div class="mt-4 max-w-3xl border-2 border-black bg-[var(--giallo-club)] p-4 font-black text-sm uppercase tracking-widest">
          Stai giocando la sfida di {replayConfig.challengerNickname || 'un amico'} — superficie {SURFACE_LABELS[replayConfig.surface]}, difficoltà {DIFFICULTY_OPTIONS.find((o) => o.value === replayConfig.difficulty)?.label ?? replayConfig.difficulty} — punteggio da battere: {replayConfig.targetPoints}
        </div>
      {/if}

      <button
        type="button"
        class="club-btn-yellow mt-4 inline-flex items-center justify-center gap-2 px-5 py-3"
        aria-expanded={regolamentoOpen}
        aria-controls="regolamento-panel"
        on:click={() => (regolamentoOpen = !regolamentoOpen)}
      >
        {regolamentoOpen ? 'Nascondi regolamento' : 'Regolamento'}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class={`shrink-0 transition-transform ${regolamentoOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
        </svg>
      </button>

      {#if regolamentoOpen}
        <div id="regolamento-panel" transition:slide={{ duration: 220 }}>
          <div class="mt-3 max-w-3xl border-2 border-black bg-black p-5 md:p-6 text-white flex flex-col gap-5">
            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">Come funziona</h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                Guarda la sequenza di colpi che si accende sul campo, poi ripetila cliccando le stesse caselle prima che scada il tempo. Se completi la sequenza in tempo vinci il game, altrimenti lo vince l'avversario. Il primo che arriva a 6 game vince la partita (7 se si arriva 5 pari); sul 6 pari si gioca un game secco di spareggio.
              </p>
            </div>

            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--verde-tennis)">Tipi di giocatore</h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                Ogni tennista ha uno stile: Serve&amp;Volley batte Regolarista, Regolarista batte Attaccante, Attaccante batte Serve&amp;Volley. Schierare lo stile favorevole rende la sequenza più corta.
              </p>
              <p class="mt-2 text-sm font-semibold leading-relaxed">
                Conta anche la forza (da 1 a 5 stelle, indicata nel roster): più l'avversario è più forte di te, più lunga sarà la sequenza.
              </p>
            </div>

            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--blu-padel)">Superficie</h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                Ogni giocatore ha una superficie preferita (terra, erba o cemento), indicata dal colore del bordo nella sua scheda. Se la partita si gioca sulla tua superficie preferita la sequenza si accorcia; se è quella preferita dall'avversario si allunga.
              </p>
            </div>

            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--rosso-padel)">Difficoltà</h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                I livelli 1-5 stabiliscono un range minimo/massimo di colpi (es. livello 1: 3-6, livello 5: 8-16): il confronto tra i due giocatori in campo sposta la sequenza verso il massimo. La modalità Ultra parte come il livello 5 ma la sequenza cresce di un colpo a ogni game, senza limite massimo.
              </p>
            </div>

            <div>
              <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--viola-tennis)">Punteggio</h3>
              <p class="mt-1 text-sm font-semibold leading-relaxed">
                Ogni game vinto vale 100 punti, ogni game perso -50: il valore si moltiplica per la lunghezza della sequenza e per un fattore che premia la velocità di risposta (più tempo resta sul cronometro, più punti). Il totale della partita finisce in classifica insieme al tuo nickname.
              </p>
            </div>
          </div>
        </div>
      {/if}

      <div class="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl">
        <div class="flex-1">
          <label for="nickname" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
            Il tuo nickname
          </label>
          <input
            id="nickname"
            type="text"
            maxlength="20"
            placeholder="Es. SIN"
            class="w-full border border-dashed border-black bg-white px-3 py-2 font-black uppercase tracking-widest text-lg focus:outline-none"
            value={nickname}
            on:input={(e) => onNicknameInput(e.currentTarget.value)}
          />
        </div>

        <div class="flex-1">
          <label for="nomecognome" class="block text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
            Nome e cognome
          </label>
          <input
            id="nomecognome"
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
        La prima volta abbina il nickname a nome e cognome, così resta solo tuo: solo il nickname compare nella
        <a href="/game/classifica" class="underline hover:text-black">classifica</a> insieme al punteggio.
      </p>

      {#if checkingNickname}
        <p class="mt-2 text-xs font-black uppercase tracking-widest text-slate-500">Verifico il nickname…</p>
      {:else if nicknameError}
        <p class="mt-2 text-xs font-black uppercase tracking-widest text-[var(--rosso-padel)]">{nicknameError}</p>
      {/if}

      <div class="mt-6 max-w-xl">
        <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
          {replayActive ? 'Difficoltà (fissata dalla sfida)' : 'Difficoltà'}
        </p>
        <div class="flex gap-1">
          {#each DIFFICULTY_OPTIONS as opt}
            <button
              type="button"
              on:click={() => { if (!replayActive) difficulty = opt.value; }}
              disabled={replayActive}
              style={difficulty === opt.value ? `background:${opt.color}` : ''}
              class={`flex-1 min-w-0 border-2 border-black py-2 text-center font-black text-sm transition-colors disabled:cursor-default ${
                difficulty === opt.value ? opt.textColor : 'bg-white hover:bg-slate-100'
              } ${replayActive && difficulty !== opt.value ? 'opacity-30' : ''}`}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    </section>
  {:else if phase !== 'setup'}
    <Scoreboard {playerScore} {cpuScore} {target} playerName={playerCurrentPlayer?.name ?? 'Tu'} cpuName={cpuCurrentPlayer?.name ?? 'CPU'} />
  {/if}

  {#if phase === 'draft'}
    {#if replayActive && replayConfig}
      <section class="club-card p-4 md:p-6 flex flex-col gap-6">
        <div>
          <p class="text-s uppercase tracking-widest font-black text-slate-600 mb-2">Il tuo roster (fissato dalla sfida)</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {#each replayConfig.playerRoster as player}
              <div class="min-w-0 border-4 bg-white p-2 text-center" style={`border-color:${SURFACE_COLORS[player.surface]}`}>
                <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
                <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
                <p class="text-xs" aria-label={`Forza ${player.strength}`}>{strengthDots(player.strength)}</p>
                <p class="text-[9px] uppercase font-bold text-slate-400">{SURFACE_LABELS[player.surface]}</p>
              </div>
            {/each}
          </div>
        </div>

        <div>
          <p class="text-s uppercase tracking-widest font-black text-slate-600 mb-2">Avversario</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {#each cpuRoster as player}
              <div class="min-w-0 border-4 bg-white p-2 text-center" style={`border-color:${SURFACE_COLORS[player.surface]}`}>
                <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
                <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
                <p class="text-xs" aria-label={`Forza ${player.strength}`}>{strengthDots(player.strength)}</p>
                <p class="text-[9px] uppercase font-bold text-slate-400">{SURFACE_LABELS[player.surface]}</p>
              </div>
            {/each}
          </div>
        </div>

        <button
          type="button"
          class="club-btn-yellow self-center px-6 py-3 font-black uppercase tracking-widest"
          on:click={() => onDraftConfirm(replayConfig.playerRoster)}
        >
          Scendi in campo
        </button>
      </section>
    {:else}
      <RosterDraft {cpuRoster} allPlayers={ALL_PLAYERS} {surface} onConfirm={onDraftConfirm} />
    {/if}
  {:else if phase === 'setup'}
    <div
      class="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-6 px-4 pt-4 pb-4"
      style={`top: ${headerOffset}px; background: hsl(38, 17%, 91%);`}
    >
      <Scoreboard {playerScore} {cpuScore} {target} {gameNumber} {surface} playerName={playerCurrentPlayer?.name ?? 'Tu'} cpuName={cpuCurrentPlayer?.name ?? 'CPU'} />
      <GameSetup
        {surface}
        {playerRoster}
        selectedPlayer={playerCurrentPlayer}
        cpuPlayer={cpuCurrentPlayer}
        usedPlayerNames={usedByPlayerNames}
        {onSelectPlayer}
        onStart={onStartGame}
      />
    </div>
  {:else if phase === 'decider'}
    <DeciderSetup
      {surface}
      playerFighter={playerCurrentPlayer}
      cpuFighter={cpuCurrentPlayer}
      onStart={onStartDecider}
    />
  {:else if phase === 'playing'}
    <div class="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/60 p-4">
      <div class="w-full max-w-sm md:max-w-md">
        {#key gameNumber}
          <ScambioBoard params={currentParams} {surface} onResult={onGameResult} />
        {/key}
      </div>
    </div>
  {:else if phase === 'matchEnd'}
    <section class="club-card p-6 md:p-8 text-center flex flex-col items-center gap-4">
      <p class="text-xs uppercase tracking-widest font-black text-slate-600">Partita finita</p>
      {#if deciderWinnerIsPlayer !== null}
        <p class="font-black text-xs uppercase tracking-widest text-[var(--rosso-padel)]">Deciso al game secco sul 6 pari</p>
        <h2 class="font-black text-3xl md:text-4xl">
          {deciderWinnerIsPlayer ? 'Hai vinto!' : 'Ha vinto la CPU'}
        </h2>
      {:else}
        <h2 class="font-black text-3xl md:text-4xl">
          {playerScore > cpuScore ? 'Hai vinto!' : 'Ha vinto la CPU'}
        </h2>
      {/if}
      <p class="font-black text-xl">{playerScore} - {cpuScore}</p>

      <div class="dark-club-card px-4 py-2 flex flex-col items-center">
        <p class="text-[10px] uppercase tracking-widest font-black text-slate-600">Punteggio arcade</p>
        <p class="font-black text-3xl">{totalPoints}</p>
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
        <button type="button" class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest" on:click={replaySameMatch}>
          Rigioca
        </button>
        <button
          type="button"
          class="club-btn px-6 py-3 font-black uppercase tracking-widest disabled:opacity-40"
          disabled={!lastScoreId}
          on:click={shareMatch}
        >
          {shareStatus === 'copied' ? 'Link copiato!' : shareStatus === 'error' ? 'Errore link' : 'Condividi partita'}
        </button>
        <button type="button" class="club-btn px-6 py-3 font-black uppercase tracking-widest" on:click={startMatch}>
          Nuova partita
        </button>
        <a href="/game/classifica" class="club-btn px-6 py-3 font-black uppercase tracking-widest text-center">
          Classifica
        </a>
      </div>
    </section>
  {/if}
</div>
