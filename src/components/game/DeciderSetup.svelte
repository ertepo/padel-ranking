<script lang="ts">
  import { diffScore, diffLabel, STYLE_LABELS, type Player, type Surface } from '../../lib/game/matchup';

  export let surface: Surface;
  export let playerFighter: Player;
  export let cpuFighter: Player;
  export let onStart: () => void;

  function strengthDots(strength: number) {
    return '★'.repeat(strength) + '☆'.repeat(5 - strength);
  }

  $: d = diffScore(playerFighter, cpuFighter, surface);
  $: label = diffLabel(d);
  $: labelClass =
    d <= -2 ? 'bg-[var(--verde-tennis)] text-white'
    : d === -1 ? 'bg-[var(--giallo-club)] text-black'
    : d === 0 ? 'bg-white text-black'
    : d === 1 ? 'bg-orange-400 text-black'
    : 'bg-[var(--rosso-padel)] text-white';
</script>

<div class="flex flex-col gap-3">
  <div class="text-center">
    <p class="font-black text-xs uppercase tracking-widest text-[var(--rosso-padel)]">6 a 6 · Game secco</p>
    <p class="text-sm text-slate-600">
      Il sistema ha scelto a caso un tennista per squadra: chi vince questo game vince la partita.
    </p>
  </div>

  <div class="flex flex-col gap-3">
    <div class="violet-club-card px-3 py-2 flex items-center justify-between gap-3">
      <p class="font-black text-lg truncate">{cpuFighter.name}</p>
      <div class="text-right shrink-0">
        <p class="text-[10px] uppercase font-bold text-slate-600">{STYLE_LABELS[cpuFighter.style]}</p>
        <p class="text-sm leading-none" aria-label={`Forza ${cpuFighter.strength}`}>{strengthDots(cpuFighter.strength)}</p>
      </div>
    </div>

    <div class={`mx-auto px-3 py-1 border-2 border-black font-black uppercase text-[10px] text-center ${labelClass}`}>
      Difficoltà: {label}
    </div>

    <div class="club-card px-3 py-2 flex items-center justify-between gap-3 bg-[var(--giallo-club)]">
      <p class="font-black text-lg truncate">{playerFighter.name}</p>
      <div class="text-right shrink-0">
        <p class="text-[10px] uppercase font-bold text-black/60">{STYLE_LABELS[playerFighter.style]}</p>
        <p class="text-sm leading-none" aria-label={`Forza ${playerFighter.strength}`}>{strengthDots(playerFighter.strength)}</p>
      </div>
    </div>
  </div>

  <button
    type="button"
    class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest self-center"
    on:click={onStart}
  >
    Gioca il game decisivo
  </button>
</div>
