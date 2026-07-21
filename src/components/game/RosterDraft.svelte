<script lang="ts">
  import { onMount } from 'svelte';
  import { STYLE_LABELS, type Player } from '../../lib/game/matchup';

  export let cpuRoster: Player[];
  export let allPlayers: Player[];
  export let surface: string;
  export let onConfirm: (selected: Player[]) => void;

  // il banner sticky deve fermarsi sotto l'header del sito (anch'esso sticky),
  // non sotto la cima del viewport: misuriamo la sua altezza reale a runtime
  let headerOffset = 0;
  onMount(() => {
    const header = document.querySelector('header');
    if (header) headerOffset = header.getBoundingClientRect().height;
  });

  const surfaceLabels: Record<string, string> = {
    terra: 'Terra rossa',
    erba: 'Erba',
    cemento: 'Cemento',
  };

  // stesso colore campo usato nel tabellone di gioco (ScambioBoard)
  const surfaceColors: Record<string, string> = {
    erba: '#578a33',
    terra: '#ad5f18',
    cemento: '#3b6582',
  };

  // esattamente 1 tennista di forza 5, 2 di forza 4, 2 di forza 3, 1 di forza 2
  const QUOTAS: Record<number, number> = { 5: 1, 4: 2, 3: 2, 2: 1 };
  const QUOTA_ORDER = [5, 4, 3, 2];

  let selected: Player[] = [];

  $: countsByStrength = selected.reduce<Record<number, number>>((acc, p) => {
    acc[p.strength] = (acc[p.strength] ?? 0) + 1;
    return acc;
  }, {});

  function quotaFull(strength: number) {
    return (countsByStrength[strength] ?? 0) >= (QUOTAS[strength] ?? 0);
  }

  function toggle(player: Player) {
    if (selected.includes(player)) {
      selected = selected.filter((p) => p !== player);
      return;
    }
    if (selected.length >= 6) return;
    if (quotaFull(player.strength)) return;
    selected = [...selected, player];
  }

  function strengthDots(strength: number) {
    return '★'.repeat(strength) + '☆'.repeat(5 - strength);
  }

  // corpo ridotto per i nomi lunghi, così restano dentro il riquadro senza spezzarsi
  function nameClass(name: string) {
    if (name.length >= 12) return 'text-[10px] tracking-tight';
    if (name.length >= 8) return 'text-xs';
    return 'text-sm';
  }

  $: eras = [...new Set(allPlayers.map((p: any) => p.era))];
  $: playersByEra = eras.map((era) => ({
    era,
    players: allPlayers.filter((p: any) => p.era === era),
  }));
</script>

<div class="flex flex-col gap-6 pb-24">
  <section class="club-card p-4 md:p-6">
    <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-3">
      Il roster avversario ({surfaceLabels[surface] || surface})
    </p>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
      {#each cpuRoster as player}
        <div class="min-w-0 border-4 bg-white p-2 text-center" style={`border-color:${surfaceColors[player.surface]}`}>
          <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
          <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
          <p class="text-xs" aria-label={`Forza ${player.strength}`}>{strengthDots(player.strength)}</p>
          <p class="text-[9px] uppercase font-bold text-slate-400">{surfaceLabels[player.surface] || player.surface}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="club-card p-4 md:p-6">
    <div
      class="sticky z-20 bg-white -mx-4 -mt-4 px-4 pt-4 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 pb-3 border-b-2 border-black"
      style={`top: ${headerOffset}px`}
    >
      <div class="flex items-center justify-between gap-4 mb-2">
        <p class="text-xs uppercase tracking-widest font-black text-slate-600">
          Scegli i tuoi 6 tennisti
        </p>
        <p class="font-black text-sm">{selected.length} / 6</p>
      </div>

      <div class="flex flex-wrap gap-2">
        {#each QUOTA_ORDER as s}
          <div
            class={`border-2 border-black px-3 py-1 text-xs font-black uppercase ${
              (countsByStrength[s] ?? 0) >= QUOTAS[s] ? 'bg-[var(--verde-tennis)] text-white' : 'bg-white'
            }`}
          >
            Forza {s}: {countsByStrength[s] ?? 0}/{QUOTAS[s]}
          </div>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-5 pr-1 pt-4">
      {#each playersByEra as group}
        <div>
          <p class="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">{group.era}</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {#each group.players as player}
              <button
                type="button"
                on:click={() => toggle(player)}
                disabled={!selected.includes(player) && (selected.length >= 6 || quotaFull(player.strength))}
                style={`border-color:${surfaceColors[player.surface]}`}
                class={`min-w-0 border-4 p-2 text-left transition-colors ${
                  selected.includes(player)
                    ? 'bg-[var(--giallo-club)]'
                    : 'bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
                <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
                <p class="text-xs" aria-label={`Forza ${player.strength}`}>{strengthDots(player.strength)}</p>
                <p class="text-[9px] uppercase font-bold text-slate-400">{surfaceLabels[player.surface] || player.surface}</p>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>

</div>

<div class="fixed inset-x-0 bottom-0 z-[1000] border-t-2 border-black bg-white p-3 flex items-center justify-center">
  <button
    type="button"
    class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest disabled:opacity-40"
    disabled={selected.length !== 6}
    on:click={() => onConfirm(selected)}
  >
    Scendi in campo
  </button>
</div>
