<script lang="ts">
  import { onDestroy } from 'svelte';
  import { generateRally, type GameParams, type Surface } from '../../lib/game/matchup';

  export let params: GameParams;
  export let surface: Surface;
  export let onResult: (win: boolean, points: number) => void;

  // colore del campo per superficie; le linee restano sempre bianche
  const SURFACE_COLORS: Record<Surface, string> = {
    erba: '#578a33',
    terra: '#ad5f18',
    cemento: '#3b6582',
  };
  $: courtFill = SURFACE_COLORS[surface];

  const sequence = generateRally(params.seqLength);
  // 5 riquadri per metà: fila larga da 3 (verso il fondo) + fila stretta da 2
  // (verso la rete), a formare una clessidra e staccarsi dalle linee del campo
  const topOuterRow = [0, 1, 2];
  const topInnerRow = [3, 4];
  const bottomInnerRow = [5, 6];
  const bottomOuterRow = [7, 8, 9];
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

  // punteggio arcade: base per vittoria/sconfitta, scalato per lunghezza
  // sequenza e per quanto tempo era rimasto (bonus se rispondi in fretta)
  function finish(win: boolean) {
    if (phase === 'result') return;
    resultWin = win;
    phase = 'result';
    if (timerInterval) clearInterval(timerInterval);
    const remainingMs = Math.max(0, inputDeadline - Date.now());
    const timeFactor = 1 + remainingMs / totalInputMs;
    const points = Math.round((win ? 100 : -50) * params.seqLength * timeFactor);
    schedule(() => onResult(win, points), 700);
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
    const base = 'border-2 border-black/70 transition-colors';
    if (active === cell) return `${base} bg-white/95`;
    if (fbCell === cell && fbType === 'correct') return `${base} bg-[var(--verde-tennis)]/90`;
    if (fbCell === cell && fbType === 'wrong') return `${base} bg-[var(--rosso-padel)]/90`;
    return `${base} bg-white/10 ${currentPhase === 'input' ? 'hover:bg-white/30' : ''}`;
  }

  playCells();

  onDestroy(() => {
    timeouts.forEach(clearTimeout);
    if (timerInterval) clearInterval(timerInterval);
  });
</script>

<div class="club-card p-4 md:p-6 flex flex-col gap-3">
  <p class="text-center text-xs uppercase tracking-widest font-black text-slate-600">Campo avversario</p>

  <div class="relative w-full max-w-xs mx-auto aspect-[1223/1639]">
    <!-- campo: sfondo SVG fornito, campo singolo ricavato dalla geometria della trasformazione originale -->
    <svg viewBox="0 0 1223 1639" class="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <g transform="matrix(1,0,0,1,23.790043,-343.292609)">
        <g transform="matrix(-0,0.814196,-1.1158,-0,1405.147467,266.789933)">
          <rect x="99" y="253" width="2002" height="960" fill={courtFill} />
        </g>
        <g transform="matrix(-0,0.814196,-1.1158,-0,1405.147467,266.789933)">
          <path
            d="M1105.04,1207.96L1105.04,1112.04L2095.96,1112.04L2095.96,1207.96L1105.04,1207.96ZM104.038,1207.96L104.038,1112.04L1094.96,1112.04L1094.96,1207.96L104.038,1207.96ZM1094.96,258.038L1094.96,353.962L104.038,353.962L104.038,258.038L1094.96,258.038ZM1105.04,738.038L1598.85,738.038L1598.85,1101.96L1105.04,1101.96L1105.04,738.038ZM601.151,738.038L1094.96,738.038L1094.96,1101.96L601.151,1101.96L601.151,738.038ZM1094.96,727.962L601.151,727.962L601.151,364.038L1094.96,364.038L1094.96,727.962ZM1598.85,727.962L1105.04,727.962L1105.04,364.038L1598.85,364.038L1598.85,727.962ZM104.038,727.962L104.038,364.038L591.075,364.038L591.075,1101.96L104.038,1101.96L104.038,738.038L135.514,738.038L135.514,727.962L104.038,727.962ZM2095.96,738.038L2095.96,1101.96L1608.92,1101.96L1608.92,364.038L2095.96,364.038L2095.96,727.962L2064.49,727.962L2064.49,738.038L2095.96,738.038ZM2095.96,258.038L2095.96,353.962L1105.04,353.962L1105.04,258.038L2095.96,258.038ZM2106.04,247.962L1105.04,247.962L1105.04,185.36L1094.96,185.36L1094.96,247.962L93.961,247.962L93.961,1218.04L1094.96,1218.04L1094.96,1280.64L1105.04,1280.64L1105.04,1218.04L2106.04,1218.04L2106.04,247.962Z"
            fill="white"
          />
        </g>
      </g>
    </svg>

    <!-- griglia colpi: allineata al campo singolo (esclusi i corridoi laterali) -->
    <div class="absolute flex flex-col gap-1" style="left:16.3%; width:67.32%; top:0.5%; height:49.23%">
      <div class="flex-1 flex gap-1">
        {#each topOuterRow as cell}
          <button
            type="button"
            class={`w-1/3 ${cellClass(cell, activeCell, feedbackCell, feedbackType, phase)}`}
            disabled={phase !== 'input'}
            aria-label={`Riquadro ${cell + 1}`}
            on:click={() => handleClick(cell)}
          ></button>
        {/each}
      </div>
      <div class="flex-1 flex gap-1">
        {#each topInnerRow as cell}
          <button
            type="button"
            class={`w-1/2 ${cellClass(cell, activeCell, feedbackCell, feedbackType, phase)}`}
            disabled={phase !== 'input'}
            aria-label={`Riquadro ${cell + 1}`}
            on:click={() => handleClick(cell)}
          ></button>
        {/each}
      </div>
    </div>

    <div class="absolute flex flex-col gap-1" style="left:16.3%; width:67.32%; top:50.23%; height:49.23%">
      <div class="flex-1 flex gap-1">
        {#each bottomInnerRow as cell}
          <button
            type="button"
            class={`w-1/2 ${cellClass(cell, activeCell, feedbackCell, feedbackType, phase)}`}
            disabled={phase !== 'input'}
            aria-label={`Riquadro ${cell + 1}`}
            on:click={() => handleClick(cell)}
          ></button>
        {/each}
      </div>
      <div class="flex-1 flex gap-1">
        {#each bottomOuterRow as cell}
          <button
            type="button"
            class={`w-1/3 ${cellClass(cell, activeCell, feedbackCell, feedbackType, phase)}`}
            disabled={phase !== 'input'}
            aria-label={`Riquadro ${cell + 1}`}
            on:click={() => handleClick(cell)}
          ></button>
        {/each}
      </div>
    </div>
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
