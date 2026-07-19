<script lang="ts">
  import playersData from '../../lib/game/players.json';
  import { diffScore, gameParams, type Player, type Surface } from '../../lib/game/matchup';
  import RosterDraft from './RosterDraft.svelte';
  import GameSetup from './GameSetup.svelte';
  import ScambioBoard from './ScambioBoard.svelte';
  import Scoreboard from './Scoreboard.svelte';

  const ALL_PLAYERS = playersData as Player[];
  const SURFACES: Surface[] = ['terra', 'erba', 'cemento'];
  const CPU_SWITCH_CHANCE = 0.4;

  function pickRandom<T>(arr: T[], count: number): T[] {
    const copy = [...arr];
    const picked: T[] = [];
    for (let i = 0; i < count && copy.length; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(idx, 1)[0]);
    }
    return picked;
  }

  type Phase = 'draft' | 'setup' | 'playing' | 'matchEnd';

  let phase: Phase = 'draft';
  let surface: Surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
  let cpuRoster: Player[] = pickRandom(ALL_PLAYERS, 6);
  let playerRoster: Player[] = [];

  let playerScore = 0;
  let cpuScore = 0;
  let gameNumber = 1;

  let cpuCurrentPlayer: Player;
  let playerCurrentPlayer: Player;
  let currentParams: ReturnType<typeof gameParams>;

  function startMatch() {
    phase = 'draft';
    surface = SURFACES[Math.floor(Math.random() * SURFACES.length)];
    cpuRoster = pickRandom(ALL_PLAYERS, 6);
    playerRoster = [];
    playerScore = 0;
    cpuScore = 0;
    gameNumber = 1;
  }

  function onDraftConfirm(selected: Player[]) {
    playerRoster = selected;
    cpuCurrentPlayer = cpuRoster[Math.floor(Math.random() * cpuRoster.length)];
    playerCurrentPlayer = playerRoster[0];
    phase = 'setup';
  }

  function onSelectPlayer(player: Player) {
    playerCurrentPlayer = player;
  }

  function onStartGame() {
    const d = diffScore(playerCurrentPlayer, cpuCurrentPlayer, surface);
    currentParams = gameParams(gameNumber, d);
    phase = 'playing';
  }

  function onGameResult(win: boolean) {
    if (win) playerScore += 1;
    else cpuScore += 1;

    if (playerScore >= 6 || cpuScore >= 6) {
      phase = 'matchEnd';
      return;
    }

    gameNumber += 1;
    if (Math.random() < CPU_SWITCH_CHANCE) {
      cpuCurrentPlayer = cpuRoster[Math.floor(Math.random() * cpuRoster.length)];
    }
    phase = 'setup';
  }
</script>

<div class="flex flex-col gap-6">
  {#if phase !== 'draft'}
    <Scoreboard {playerScore} {cpuScore} playerName={playerCurrentPlayer?.name ?? 'Tu'} cpuName={cpuCurrentPlayer?.name ?? 'CPU'} />
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
      {onSelectPlayer}
      onStart={onStartGame}
    />
  {:else if phase === 'playing'}
    <div class="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/60 p-4">
      <div class="w-full max-w-sm md:max-w-md">
        {#key gameNumber}
          <ScambioBoard params={currentParams} onResult={onGameResult} />
        {/key}
      </div>
    </div>
  {:else if phase === 'matchEnd'}
    <section class="club-card p-6 md:p-8 text-center flex flex-col items-center gap-4">
      <p class="text-xs uppercase tracking-widest font-black text-slate-600">Partita finita</p>
      <h2 class="font-black text-3xl md:text-4xl">
        {playerScore > cpuScore ? 'Hai vinto!' : 'Ha vinto la CPU'}
      </h2>
      <p class="font-black text-xl">{playerScore} - {cpuScore}</p>
      <button type="button" class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest" on:click={startMatch}>
        Nuova partita
      </button>
    </section>
  {/if}
</div>
