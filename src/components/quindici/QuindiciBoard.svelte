<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import type { Dir, MoveResult, Step, Tile, Value } from '../../lib/quindici/engine';

  export let initialTiles: Tile[];

  const dispatch = createEventDispatcher<{ swipe: Dir }>();

  const SIZE = 4;
  const SLIDE_MS = 80;

  type TileState = 'idle' | 'spawn' | 'pop';
  interface RenderTile extends Tile {
    state: TileState;
  }

  let renderTiles: RenderTile[] = initialTiles.map((t) => ({ ...t, state: 'idle' }));

  let boardEl: HTMLDivElement;
  let cell = 0;
  let gap = 0;
  let resizeObserver: ResizeObserver | undefined;

  function measure() {
    if (!boardEl) return;
    const w = boardEl.clientWidth;
    gap = Math.round(w * 0.026);
    cell = (w - gap * (SIZE + 1)) / SIZE;
  }

  onMount(() => {
    if (typeof ResizeObserver === 'undefined') return;
    measure();
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(boardEl);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  function pos(i: number): number {
    return gap + i * (cell + gap);
  }

  function fontSize(step: Step): number {
    return Math.round(cell * (String(step).length > 2 ? 0.34 : 0.42));
  }

  // colore base di ogni livello: 0 blu, 1 verde, 2 giallo, 3 rosso, 4 viola, 5 nero
  const LEVEL_COLORS = [
    'var(--blu-padel)',
    'var(--verde-tennis)',
    'var(--giallo-club)',
    'var(--rosso-padel)',
    'var(--viola-tennis)',
    'black',
  ];
  // livelli il cui colore resta chiaro anche alla massima intensità (il giallo
  // non diventa mai scuro): il testo ci resta sempre nero.
  const LIGHT_LEVELS = new Set([2]);

  // intensità del colore per ogni step, dal più tenue (seme) al più intenso (AD).
  const STEP_INTENSITY: Record<Step, number> = { 0: 12, 15: 35, 30: 60, 40: 80, AD: 100 };

  function levelColor(level: number): string {
    return LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
  }

  function tileBackground(value: Value): string {
    const pct = STEP_INTENSITY[value.step];
    return `color-mix(in srgb, ${levelColor(value.level)} ${pct}%, white)`;
  }

  function tileTextColor(value: Value): string {
    if (LIGHT_LEVELS.has(value.level)) return 'black';
    return STEP_INTENSITY[value.step] >= 80 ? 'white' : 'black';
  }

  // pallina "0": colore pieno, stessa tonalità del livello.
  function ballBackground(level: number): string {
    return levelColor(level);
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  export async function applyMove(result: MoveResult) {
    const slideMap = new Map(result.slides.map((s) => [s.id, s]));
    renderTiles = renderTiles.map((t) => {
      const s = slideMap.get(t.id);
      return s ? { ...t, row: s.row, col: s.col } : t;
    });

    await wait(SLIDE_MS);

    const removedIds = new Set(result.removed.map((r) => r.id));
    const created: RenderTile[] = result.created.map((t) => ({ ...t, state: 'pop' }));
    const spawned: RenderTile[] = result.spawned ? [{ ...result.spawned, state: 'spawn' }] : [];

    renderTiles = [...renderTiles.filter((t) => !removedIds.has(t.id)), ...created, ...spawned];

    await wait(20);
    renderTiles = renderTiles.map((t) => ({ ...t, state: 'idle' }));
  }

  let touchStart: { x: number; y: number } | null = null;
  const SWIPE_THRESHOLD = 24;

  function onTouchStart(e: TouchEvent) {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }

  function onTouchMove(e: TouchEvent) {
    if (touchStart) e.preventDefault();
  }

  function onTouchEnd(e: TouchEvent) {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    const dir: Dir =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    dispatch('swipe', dir);
  }
</script>

<div class="club-card p-4 md:p-6">
  <div
    bind:this={boardEl}
    role="application"
    aria-label="Campo di gioco: 4 per 4, swipe per muovere le tessere"
    class="relative w-full aspect-square border-2 border-black bg-slate-100 touch-none select-none"
    on:touchstart={onTouchStart}
    on:touchmove={onTouchMove}
    on:touchend={onTouchEnd}
  >
    {#each Array(SIZE * SIZE) as _, i}
      <div
        class="absolute bg-slate-200"
        style={`width:${cell}px;height:${cell}px;left:${pos(i % SIZE)}px;top:${pos(Math.floor(i / SIZE))}px`}
      ></div>
    {/each}

    {#each renderTiles as tile (tile.id)}
      <div
        class={`absolute flex items-center justify-center border-2 border-black font-black transition-transform duration-[80ms] ease-out ${
          tile.state === 'spawn' ? 'tile-spawn' : ''
        } ${tile.state === 'pop' ? 'tile-pop' : ''}`}
        style={`width:${cell}px;height:${cell}px;font-size:${fontSize(tile.value.step)}px;background:${tileBackground(tile.value)};color:${tileTextColor(tile.value)};--pos:translate(${pos(tile.col)}px,${pos(tile.row)}px);transform:var(--pos)`}
      >
        <span
          class="absolute top-0.5 left-1 leading-none font-black opacity-90"
          style={`font-size:${Math.max(8, Math.round(cell * 0.22))}px`}
        >{tile.value.level}</span>
        {#if tile.value.step === 0}
          <span
            class="quindici-ball"
            style={`width:${cell * 0.35}px;height:${cell * 0.35}px;background:${ballBackground(tile.value.level)}`}
          ></span>
        {:else}
          <span class="leading-none">{tile.value.step}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  @keyframes quindici-spawn {
    from { transform: var(--pos) scale(0.4); opacity: 0; }
  }
  @keyframes quindici-pop {
    50% { transform: var(--pos) scale(1.16); }
  }
  .tile-spawn { animation: quindici-spawn 160ms ease-out; }
  .tile-pop { animation: quindici-pop 180ms ease-out; }
  .quindici-ball {
    display: block;
    border-radius: 9999px;
    border: 1px solid black;
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }
</style>
