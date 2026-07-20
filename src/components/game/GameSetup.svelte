<script lang="ts">
  import { diffScore, diffLabel, STYLE_LABELS, type Player, type Surface } from '../../lib/game/matchup';

  export let surface: Surface;
  export let playerRoster: Player[];
  export let selectedPlayer: Player;
  export let cpuPlayer: Player;
  export let usedPlayerNames: Set<string> = new Set();
  export let onSelectPlayer: (player: Player) => void;
  export let onStart: () => void;

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

<div class="flex flex-1 flex-col gap-3">
  <div class="flex-1 flex flex-col justify-center gap-3">
    <div class="flex flex-col gap-3">
      <div class="violet-club-card px-3 py-2 flex items-center justify-between gap-3">
        <p class="font-black text-lg truncate">{cpuPlayer.name}</p>
        <div class="text-right shrink-0">
          <p class="text-[10px] uppercase font-bold text-slate-600">{STYLE_LABELS[cpuPlayer.style]}</p>
          <p class="text-sm leading-none" aria-label={`Forza ${cpuPlayer.strength}`}>{strengthDots(cpuPlayer.strength)}</p>
        </div>
      </div>

      <div class={`mx-auto px-3 py-1 border-2 border-black font-black uppercase text-[10px] text-center ${labelClass}`}>
        Difficoltà: {label}
      </div>
    </div>

    <section class="club-card">
      <div class="px-3 py-2 flex items-center justify-between gap-3 bg-[var(--giallo-club)] border-b-2 border-black">
        <p class="font-black text-lg truncate">{selectedPlayer.name}</p>
        <div class="text-right shrink-0">
          <p class="text-[10px] uppercase font-bold text-black/60">{STYLE_LABELS[selectedPlayer.style]}</p>
          <p class="text-sm leading-none" aria-label={`Forza ${selectedPlayer.strength}`}>{strengthDots(selectedPlayer.strength)}</p>
        </div>
      </div>

      <div class="p-3">
        <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-2">Seleziona il giocatore</p>
        <div class="grid grid-cols-3 sm:grid-cols-6">
          {#each playerRoster as player}
            <button
              type="button"
              on:click={() => onSelectPlayer(player)}
              disabled={usedPlayerNames.has(player.name)}
              class={`min-w-0 border border-dashed border-black p-2 text-center transition-colors ${
                player === selectedPlayer
                  ? 'bg-[var(--giallo-club)]'
                  : usedPlayerNames.has(player.name)
                    ? 'bg-slate-100 opacity-40 cursor-not-allowed'
                    : 'bg-white hover:bg-slate-100'
              }`}
            >
              <p class={`font-black ${nameClass(player.name)} leading-tight break-words`}>{player.name}</p>
              <p class="text-[10px] uppercase font-bold text-slate-500">{STYLE_LABELS[player.style]}</p>
              {#if usedPlayerNames.has(player.name)}
                <p class="text-[9px] uppercase font-black text-[var(--rosso-padel)]">Già usato</p>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </section>
  </div>

  <button
    type="button"
    class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest self-center"
    on:click={onStart}
  >
    Inizia lo scambio
  </button>
</div>
