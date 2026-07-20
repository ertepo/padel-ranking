<script lang="ts">
  export let playerScore: number;
  export let cpuScore: number;
  export let playerName: string;
  export let cpuName: string;
  export let target: number = 6;
</script>

<div class="club-card p-4 flex flex-col gap-3">
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
