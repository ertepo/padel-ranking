<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import playersData from '../../lib/game/players.json';
  import { matchParams, type Difficulty, type Player, type Surface } from '../../lib/game/matchup';
  import RosterDraft from './RosterDraft.svelte';
  import GameSetup from './GameSetup.svelte';
  import DeciderSetup from './DeciderSetup.svelte';
  import ScambioBoard from './ScambioBoard.svelte';
  import Scoreboard from './Scoreboard.svelte';

  const ALL_PLAYERS = playersData as Player[];
  const SURFACES: Surface[] = ['terra', 'erba', 'cemento'];

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

  async function submitScore() {
    try {
      await fetch('/api/game-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim() || 'Anonimo',
          nomecognome: nomecognome.trim(),
          match_score: `${playerScore}-${cpuScore}`,
          points: totalPoints,
          difficulty,
        }),
      });
    } catch {
      // punteggio non salvato: non blocchiamo la fine partita per un errore di rete
    }
  }

  let surface: Surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
  let cpuRoster: Player[] = pickRandom(ALL_PLAYERS, 6);
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
  let difficulty: Difficulty = '2';

  const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; color: string; textColor: string }[] = [
    { value: '1', label: '1', color: 'var(--verde-tennis)', textColor: 'text-white' },
    { value: '2', label: '2', color: 'var(--giallo-club)', textColor: 'text-black' },
    { value: '3', label: '3', color: 'var(--rosso-padel)', textColor: 'text-white' },
    { value: '4', label: '4', color: '#7a1010', textColor: 'text-white' },
    { value: '5', label: '5', color: '#1a1a1a', textColor: 'text-white' },
    { value: 'ultra', label: 'ULTRA', color: '#000000', textColor: 'text-white' },
  ];

  $: target = playerScore >= 5 && cpuScore >= 5 ? 7 : 6;

  function startMatch() {
    phase = 'draft';
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
        La prima volta abbina il nickname a nome e cognome, così resta solo tuo: compare nella
        <a href="/game/classifica" class="underline hover:text-black">classifica</a> insieme al punteggio.
      </p>

      {#if checkingNickname}
        <p class="mt-2 text-xs font-black uppercase tracking-widest text-slate-500">Verifico il nickname…</p>
      {:else if nicknameError}
        <p class="mt-2 text-xs font-black uppercase tracking-widest text-[var(--rosso-padel)]">{nicknameError}</p>
      {/if}

      <div class="mt-6 max-w-xl">
        <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-1">Difficoltà</p>
        <div class="flex gap-1">
          {#each DIFFICULTY_OPTIONS as opt}
            <button
              type="button"
              on:click={() => (difficulty = opt.value)}
              style={difficulty === opt.value ? `background:${opt.color}` : ''}
              class={`flex-1 min-w-0 border-2 border-black py-2 text-center font-black text-sm transition-colors ${
                difficulty === opt.value ? opt.textColor : 'bg-white hover:bg-slate-100'
              }`}
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
    <RosterDraft {cpuRoster} allPlayers={ALL_PLAYERS} {surface} onConfirm={onDraftConfirm} />
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

      <div class="flex flex-col sm:flex-row gap-3">
        <button type="button" class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest" on:click={startMatch}>
          Nuova partita
        </button>
        <a href="/game/classifica" class="club-btn px-6 py-3 font-black uppercase tracking-widest text-center">
          Classifica
        </a>
      </div>
    </section>
  {/if}
</div>
