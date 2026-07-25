<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { LABELS, type Dir, type MoveResult, type Tile } from '../../lib/slice/engine';

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

  function fontSize(level: number): number {
    const len = LABELS[level].length;
    if (len > 5) return Math.round(cell * 0.24);
    if (len > 2) return Math.round(cell * 0.3);
    return Math.round(cell * 0.42);
  }

  // colore e testo per livello: PUNTO (pallina), 15, 30, 40, GAME, SET, MATCH.
  // PUNTO e 15 sono entrambi gialli: è un indizio visivo che si fondono solo fra loro.
  function tileBackground(level: number): string {
    if (level === 0 || level === 1) return 'var(--giallo-paglierino)';
    if (level === 2) return 'var(--verde-tennis)';
    if (level === 3) return 'var(--viola-tennis)';
    if (level >= 4 && level <= 9) return 'white';
    if (level >= 10 && level <= 12) return 'var(--rosa-salmone)';
    return 'var(--giallo-club)'; // MATCH
  }

  function tileTextColor(level: number): string {
    if (level === 2 || level === 3) return 'white';
    return 'black';
  }

  function ballBackground(): string {
    return 'var(--giallo-club)';
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
        class={`absolute flex items-center justify-center border-2 border-black font-black text-center transition-transform duration-[80ms] ease-out ${
          tile.state === 'spawn' ? 'tile-spawn' : ''
        } ${tile.state === 'pop' ? 'tile-pop' : ''}`}
        style={`width:${cell}px;height:${cell}px;font-size:${fontSize(tile.level)}px;background:${tileBackground(tile.level)};color:${tileTextColor(tile.level)};--pos:translate(${pos(tile.col)}px,${pos(tile.row)}px);transform:var(--pos)`}
      >
        {#if tile.level === 0}
          <span
            class="slice-ball"
            style={`width:${cell * 0.35}px;height:${cell * 0.35}px;background:${ballBackground()}`}
          ></span>
        {:else if tile.level >= 4 && tile.level <= 9}
          <span class="leading-none" style={`font-size:${Math.round(cell * 0.46)}px`}>{tile.level - 3}</span>
          <span
            class="absolute bottom-1 left-0 right-0 text-center leading-none tracking-widest"
            style={`font-size:${Math.round(cell * 0.13)}px`}
          >GAME</span>
        {:else}
          <span class="leading-none">{LABELS[tile.level]}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  @keyframes slice-spawn {
    from { transform: var(--pos) scale(0.4); opacity: 0; }
  }
  @keyframes slice-pop {
    50% { transform: var(--pos) scale(1.16); }
  }
  .tile-spawn { animation: slice-spawn 160ms ease-out; }
  .tile-pop { animation: slice-pop 180ms ease-out; }
  .slice-ball {
    display: block;
    border-radius: 9999px;
    border: 1px solid black;
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }
</style>
