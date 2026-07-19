<script lang="ts">
  import { STYLE_LABELS, type Player } from '../../lib/game/matchup';

  export let cpuRoster: Player[];
  export let allPlayers: Player[];
  export let surface: string;
  export let onConfirm: (selected: Player[]) => void;

  const surfaceLabels: Record<string, string> = {
    terra: 'Terra rossa',
    erba: 'Erba',
    cemento: 'Cemento',
  };

  let selected: Player[] = [];

  function toggle(player: Player) {
    if (selected.includes(player)) {
      selected = selected.filter((p) => p !== player);
      return;
    }
    if (selected.length >= 6) return;
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

<div class="flex flex-col gap-6">
  <section class="club-card p-4 md:p-6">
    <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-3">
      Il roster della CPU ({surfaceLabels[surface] || surface})
    </p>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
      {#each cpuRoster as player}
        <div class="min-w-0 border-2 border-black bg-white p-2 text-center">
          <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
          <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
          <p class="text-xs" aria-label={`Forza ${player.strength}`}>{strengthDots(player.strength)}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="club-card p-4 md:p-6">
    <div class="flex items-center justify-between gap-4 mb-4">
      <p class="text-xs uppercase tracking-widest font-black text-slate-600">
        Scegli i tuoi 6 tennisti
      </p>
      <p class="font-black text-sm">{selected.length} / 6</p>
    </div>

    <div class="flex flex-col gap-5 max-h-[28rem] overflow-y-auto pr-1">
      {#each playersByEra as group}
        <div>
          <p class="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">{group.era}</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {#each group.players as player}
              <button
                type="button"
                on:click={() => toggle(player)}
                disabled={!selected.includes(player) && selected.length >= 6}
                class={`min-w-0 border-2 border-black p-2 text-left transition-colors ${
                  selected.includes(player)
                    ? 'bg-[var(--giallo-club)]'
                    : 'bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
                <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
                <p class="text-xs" aria-label={`Forza ${player.strength}`}>{strengthDots(player.strength)}</p>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <button
    type="button"
    class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest self-center disabled:opacity-40"
    disabled={selected.length !== 6}
    on:click={() => onConfirm(selected)}
  >
    Scendi in campo
  </button>
</div>
