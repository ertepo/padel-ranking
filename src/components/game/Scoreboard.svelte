<script lang="ts">
  import type { Surface } from '../../lib/game/matchup';

  export let playerScore: number;
  export let cpuScore: number;
  export let playerName: string;
  export let cpuName: string;
  export let target: number = 6;
  export let gameNumber: number | undefined = undefined;
  export let surface: Surface | undefined = undefined;

  // stesso colore campo usato nel tabellone di gioco (ScambioBoard)
  const SURFACE_COLORS: Record<Surface, string> = {
    erba: '#578a33',
    terra: '#ad5f18',
    cemento: '#3b6582',
  };
  const SURFACE_LABELS: Record<Surface, string> = {
    terra: 'Terra rossa',
    erba: 'Erba',
    cemento: 'Cemento',
  };
</script>

<div
  class="club-card flex flex-col"
  style={surface ? `box-shadow: -0.5em 0.5em ${SURFACE_COLORS[surface]}` : ''}
>
  {#if gameNumber !== undefined && surface}
    <div
      class="border-b-2 border-black px-4 py-2 text-center font-black uppercase tracking-widest text-white"
      style={`background:${SURFACE_COLORS[surface]}`}
    >
      Game {gameNumber} · {SURFACE_LABELS[surface] || surface}
    </div>
  {/if}

  <div class="p-4 flex flex-col gap-3">
    <div class="flex items-center justify-between gap-4">
      <p class="font-black truncate flex-1 min-w-0">{playerName}</p>
      <div class="flex gap-1">
        {#each Array.from({ length: target }) as _, i}
          <span class={`h-4 w-4 border-2 border-black ${i < playerScore ? 'bg-[var(--giallo-club)]' : 'bg-white'}`}></span>
        {/each}
      </div>
      <p class="font-black text-xl w-6 text-right">{playerScore}</p>
    </div>

    <div class="h-px bg-black/20"></div>

    <div class="flex items-center justify-between gap-4">
      <p class="font-black truncate flex-1 min-w-0">{cpuName}</p>
      <div class="flex gap-1">
        {#each Array.from({ length: target }) as _, i}
          <span class={`h-4 w-4 border-2 border-black ${i < cpuScore ? 'bg-[var(--rosso-padel)]' : 'bg-white'}`}></span>
        {/each}
      </div>
      <p class="font-black text-xl w-6 text-right">{cpuScore}</p>
    </div>
  </div>
</div>
