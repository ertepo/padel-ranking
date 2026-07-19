<script lang="ts">
  import { diffScore, diffLabel, STYLE_LABELS, type Player, type Surface } from '../../lib/game/matchup';

  export let gameNumber: number;
  export let surface: Surface;
  export let playerRoster: Player[];
  export let selectedPlayer: Player;
  export let cpuPlayer: Player;
  export let onSelectPlayer: (player: Player) => void;
  export let onStart: () => void;

  const surfaceLabels: Record<string, string> = {
    terra: 'Terra rossa',
    erba: 'Erba',
    cemento: 'Cemento',
  };

  function strengthDots(strength: number) {
    return '★'.repeat(strength) + '☆'.repeat(5 - strength);
  }

  // corpo ridotto per i nomi lunghi, così restano dentro il riquadro senza spezzarsi
  function nameClass(name: string) {
    if (name.length >= 12) return 'text-[10px] tracking-tight';
    if (name.length >= 8) return 'text-xs';
    return 'text-sm';
  }

  $: d = diffScore(selectedPlayer, cpuPlayer, surface);
  $: label = diffLabel(d);
  $: labelClass =
    d <= -2 ? 'bg-[var(--verde-tennis)] text-white'
    : d === -1 ? 'bg-[var(--giallo-club)] text-black'
    : d === 0 ? 'bg-white text-black'
    : d === 1 ? 'bg-orange-400 text-black'
    : 'bg-[var(--rosso-padel)] text-white';
</script>

<div class="flex flex-col gap-6">
  <p class="text-center font-black text-sm uppercase tracking-widest text-slate-600">
    Game {gameNumber} · {surfaceLabels[surface] || surface}
  </p>

  <div class="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-center">
    <section class="violet-club-card p-4 text-center">
      <p class="text-xs uppercase tracking-widest font-bold text-slate-600 mb-2">La CPU schiera</p>
      <p class="font-black text-2xl">{cpuPlayer.name}</p>
      <p class="text-xs uppercase font-bold text-slate-500">{STYLE_LABELS[cpuPlayer.style]}</p>
      <p aria-label={`Forza ${cpuPlayer.strength}`}>{strengthDots(cpuPlayer.strength)}</p>
    </section>

    <div class={`mx-auto px-4 py-2 border-2 border-black font-black uppercase text-xs text-center ${labelClass}`}>
      Difficoltà<br />{label}
    </div>

    <section class="club-card p-4 text-center bg-[var(--giallo-club)]">
      <p class="text-xs uppercase tracking-widest font-bold text-black/60 mb-2">Tu schieri</p>
      <p class="font-black text-2xl">{selectedPlayer.name}</p>
      <p class="text-xs uppercase font-bold text-black/60">{STYLE_LABELS[selectedPlayer.style]}</p>
      <p aria-label={`Forza ${selectedPlayer.strength}`}>{strengthDots(selectedPlayer.strength)}</p>
    </section>
  </div>

  <section class="club-card p-4">
    <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-3">Il tuo roster</p>
    <div class="grid grid-cols-3 sm:grid-cols-6">
      {#each playerRoster as player}
        <button
          type="button"
          on:click={() => onSelectPlayer(player)}
          class={`min-w-0 border border-dashed border-black p-2 text-center transition-colors ${
            player === selectedPlayer ? 'bg-[var(--giallo-club)]' : 'bg-white hover:bg-slate-100'
          }`}
        >
          <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
          <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
        </button>
      {/each}
    </div>
  </section>

  <button
    type="button"
    class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest self-center"
    on:click={onStart}
  >
    Inizia lo scambio
  </button>
</div>
