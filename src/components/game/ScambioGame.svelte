<script lang="ts">
  import playersData from '../../lib/game/players.json';
  import { diffScore, gameParams, type GameParams, type Player, type Surface } from '../../lib/game/matchup';
  import RosterDraft from './RosterDraft.svelte';
  import GameSetup from './GameSetup.svelte';
  import DeciderSetup from './DeciderSetup.svelte';
  import ScambioBoard from './ScambioBoard.svelte';
  import Scoreboard from './Scoreboard.svelte';

  const ALL_PLAYERS = playersData as Player[];
  const SURFACES: Surface[] = ['terra', 'erba', 'cemento'];

  type Difficulty = 'facile' | 'normale' | 'difficile';

  // moltiplicatori applicati sopra i parametri "grezzi" di matchup.ts (che restano
  // la taratura più difficile): facile/normale allungano tempi e accorciano la sequenza
  const DIFFICULTY_MULT: Record<Difficulty, { showMs: number; inputMs: number; seqLengthDelta: number }> = {
    facile: { showMs: 1.4, inputMs: 1.6, seqLengthDelta: -2 },
    normale: { showMs: 1.15, inputMs: 1.3, seqLengthDelta: -1 },
    difficile: { showMs: 1, inputMs: 1, seqLengthDelta: 0 },
  };

  function applyDifficulty(params: GameParams, tier: Difficulty): GameParams {
    const m = DIFFICULTY_MULT[tier];
    return {
      seqLength: Math.max(5, params.seqLength + m.seqLengthDelta),
      showMs: Math.round(params.showMs * m.showMs),
      gapMs: params.gapMs,
      inputMsPerStep: Math.round(params.inputMsPerStep * m.inputMs),
    };
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
  let surface: Surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
  let cpuRoster: Player[] = pickRandom(ALL_PLAYERS, 6);
  let playerRoster: Player[] = [];

  let playerScore = 0;
  let cpuScore = 0;
  let gameNumber = 1;

  // tennisti già schierati nel ciclo corrente: non riselezionabili finché non
  // sono stati usati tutti e 6, poi il pool si resetta (per entrambi i lati)
  let usedByPlayerNames = new Set<string>();
  let usedByCpuNames = new Set<string>();

  // sul 6 pari si gioca un game secco tra due tennisti a caso
  let deciderActive = false;
  let deciderWinnerIsPlayer: boolean | null = null;

  let cpuCurrentPlayer: Player;
  let playerCurrentPlayer: Player;
  let currentParams: ReturnType<typeof gameParams>;
  let difficulty: Difficulty = 'normale';

  $: target = playerScore >= 5 && cpuScore >= 5 ? 7 : 6;

  function startMatch() {
    phase = 'draft';
    surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
    cpuRoster = pickRandom(ALL_PLAYERS, 6);
    playerRoster = [];
    playerScore = 0;
    cpuScore = 0;
    gameNumber = 1;
    usedByPlayerNames = new Set();
    usedByCpuNames = new Set();
    deciderActive = false;
    deciderWinnerIsPlayer = null;
  }

  function onDraftConfirm(selected: Player[], chosenDifficulty: Difficulty) {
    playerRoster = selected;
    difficulty = chosenDifficulty;
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
    const d = diffScore(playerCurrentPlayer, cpuCurrentPlayer, surface);
    currentParams = applyDifficulty(gameParams(gameNumber, d), difficulty);
    phase = 'playing';
    window.scrollTo(0, 0);
  }

  function startDecider() {
    playerCurrentPlayer = randomFrom(playerRoster);
    cpuCurrentPlayer = randomFrom(cpuRoster);
    phase = 'decider';
  }

  function onStartDecider() {
    const d = diffScore(playerCurrentPlayer, cpuCurrentPlayer, surface);
    currentParams = applyDifficulty(gameParams(gameNumber + 1, d), difficulty);
    deciderActive = true;
    phase = 'playing';
    window.scrollTo(0, 0);
  }

  function onGameResult(win: boolean) {
    window.scrollTo(0, 0);
    if (deciderActive) {
      deciderActive = false;
      deciderWinnerIsPlayer = win;
      phase = 'matchEnd';
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
      <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Gioco dello scambio</h1>
      <p class="mt-5 max-w-3xl text-lg font-semibold leading-relaxed text-slate-700">
        Scegli il tuo roster di 6 leggende del tennis e sfida la CPU: memorizza la sequenza di colpi e ripetila prima che scada il tempo. Primo a 6 game vince il match.
      </p>
    </section>
  {:else}
    <Scoreboard {playerScore} {cpuScore} {target} playerName={playerCurrentPlayer?.name ?? 'Tu'} cpuName={cpuCurrentPlayer?.name ?? 'CPU'} />
  {/if}

  {#if phase === 'draft'}
    <RosterDraft {cpuRoster} allPlayers={ALL_PLAYERS} {surface} onConfirm={onDraftConfirm} />
  {:else if phase === 'setup'}
    <GameSetup
      {gameNumber}
      {surface}
      {playerRoster}
      selectedPlayer={playerCurrentPlayer}
      cpuPlayer={cpuCurrentPlayer}
      usedPlayerNames={usedByPlayerNames}
      {onSelectPlayer}
      onStart={onStartGame}
    />
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
      <button type="button" class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest" on:click={startMatch}>
        Nuova partita
      </button>
    </section>
  {/if}
</div>
