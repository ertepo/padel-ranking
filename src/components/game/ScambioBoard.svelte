<script lang="ts">
  import { onDestroy } from 'svelte';
  import { generateRally, type GameParams } from '../../lib/game/matchup';

  export let params: GameParams;
  export let onResult: (win: boolean) => void;

  const sequence = generateRally(params.seqLength);
  const topCells = [0, 1, 2, 3, 4, 5];
  const bottomCells = [6, 7, 8, 9, 10, 11];
  const totalInputMs = params.inputMsPerStep * params.seqLength;

  let phase: 'playback' | 'input' | 'result' = 'playback';
  let activeCell = -1;
  let inputIndex = 0;
  let feedbackCell = -1;
  let feedbackType: 'correct' | 'wrong' | null = null;
  let timerPct = 100;
  let resultWin = false;

  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let inputDeadline = 0;

  function schedule(fn: () => void, delay: number) {
    timeouts.push(setTimeout(fn, delay));
  }

  function playCells() {
    let t = 300;
    for (const cell of sequence) {
      const showAt = t;
      const hideAt = t + params.showMs;
      schedule(() => { activeCell = cell; }, showAt);
      schedule(() => { activeCell = -1; }, hideAt);
      t = hideAt + params.gapMs;
    }
    schedule(startInput, t + 300);
  }

  function startInput() {
    phase = 'input';
    inputIndex = 0;
    inputDeadline = Date.now() + totalInputMs;
    timerPct = 100;
    timerInterval = setInterval(() => {
      const remaining = inputDeadline - Date.now();
      timerPct = Math.max(0, (remaining / totalInputMs) * 100);
      if (remaining <= 0) finish(false);
    }, 50);
  }

  function handleClick(cell: number) {
    if (phase !== 'input') return;
    if (cell === sequence[inputIndex]) {
      feedbackCell = cell;
      feedbackType = 'correct';
      inputIndex += 1;
      if (inputIndex === sequence.length) finish(true);
    } else {
      feedbackCell = cell;
      feedbackType = 'wrong';
      finish(false);
    }
  }

  function finish(win: boolean) {
    if (phase === 'result') return;
    resultWin = win;
    phase = 'result';
    if (timerInterval) clearInterval(timerInterval);
    schedule(() => onResult(win), 700);
  }

  // activeCell/feedback/phase passati come argomenti: servono nel template
  // perché Svelte (sintassi legacy) riesegua l'espressione quando cambiano
  function cellClass(
    cell: number,
    active: number,
    fbCell: number,
    fbType: 'correct' | 'wrong' | null,
    currentPhase: typeof phase,
  ) {
    const base = 'aspect-square border-2 border-black transition-colors';
    if (active === cell) return `${base} bg-[var(--viola-tennis)]`;
    if (fbCell === cell && fbType === 'correct') return `${base} bg-[var(--verde-tennis)]`;
    if (fbCell === cell && fbType === 'wrong') return `${base} bg-[var(--rosso-padel)]`;
    return `${base} bg-white ${currentPhase === 'input' ? 'hover:bg-slate-100' : ''}`;
  }

  playCells();

  onDestroy(() => {
    timeouts.forEach(clearTimeout);
    if (timerInterval) clearInterval(timerInterval);
  });
</script>

<div class="club-card p-4 md:p-6 flex flex-col gap-3">
  <p class="text-center text-xs uppercase tracking-widest font-black text-slate-600">Campo avversario</p>

  <div class="grid grid-cols-3 gap-2 md:gap-3">
    {#each topCells as cell}
      <button
        type="button"
        class={cellClass(cell, activeCell, feedbackCell, feedbackType, phase)}
        disabled={phase !== 'input'}
        aria-label={`Riquadro ${cell + 1}`}
        on:click={() => handleClick(cell)}
      ></button>
    {/each}
  </div>

  <div class="relative h-2 bg-black">
    <span class="absolute inset-x-0 -top-2.5 mx-auto w-fit border-2 border-black bg-[var(--giallo-club)] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
      Rete
    </span>
  </div>

  <div class="grid grid-cols-3 gap-2 md:gap-3">
    {#each bottomCells as cell}
      <button
        type="button"
        class={cellClass(cell, activeCell, feedbackCell, feedbackType, phase)}
        disabled={phase !== 'input'}
        aria-label={`Riquadro ${cell + 1}`}
        on:click={() => handleClick(cell)}
      ></button>
    {/each}
  </div>

  <p class="text-center text-xs uppercase tracking-widest font-black text-slate-600">Il tuo campo</p>

  <div class="mt-2 min-h-[2.5rem]">
    {#if phase === 'playback'}
      <p class="text-center font-black uppercase tracking-widest text-sm text-slate-600">
        Memorizza la sequenza…
      </p>
    {:else if phase === 'input'}
      <div class="h-4 border-2 border-black bg-white overflow-hidden">
        <div class="h-full bg-[var(--verde-tennis)]" style={`width:${timerPct}%`}></div>
      </div>
    {:else if phase === 'result'}
      <p class={`text-center font-black uppercase tracking-widest text-sm ${resultWin ? 'text-[var(--verde-tennis)]' : 'text-[var(--rosso-padel)]'}`}>
        {resultWin ? 'Punto vinto!' : 'Punto perso'}
      </p>
    {/if}
  </div>
</div>
