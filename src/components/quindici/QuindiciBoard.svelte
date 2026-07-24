<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import type { Dir, MoveResult, Tile, Value } from '../../lib/quindici/engine';

  export let initialTiles: Tile[];

  const dispatch = createEventDispatcher<{ swipe: Dir }>();

  const SIZE = 4;
  const SLIDE_MS = 110;

  type TileState = 'idle' | 'spawn' | 'pop' | 'gone';
  interface RenderTile extends Tile {
    state: TileState;
  }

  let renderTiles: RenderTile[] = initialTiles.map((t) => ({ ...t, state: 'idle' }));

  let boardEl: HTMLDivElement;
  let cell = 0;
  let gap = 0;
  let resizeObserver: ResizeObserver | undefined;

  let flashDir: Dir | null = null;
  let flashMine = false;
  let flashTimeout: ReturnType<typeof setTimeout>;

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
    clearTimeout(flashTimeout);
  });

  function pos(i: number): number {
    return gap + i * (cell + gap);
  }

  function fontSize(value: Value): number {
    return Math.round(cell * (String(value).length > 2 ? 0.36 : 0.42));
  }

  function tileClasses(value: Value): string {
    switch (value) {
      case 15: return 'bg-white text-black border-2 border-black';
      case 30: return 'bg-[var(--giallo-club)] text-black border-2 border-black';
      case 40: return 'bg-[var(--viola-tennis)] text-white border-2 border-black';
      case 'AD': return 'bg-black text-[var(--giallo-club)] border-2 border-[var(--giallo-club)]';
      case 'G': return 'tile-g text-white border-2 border-black';
    }
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function flash(dir: Dir, mine: boolean) {
    flashDir = dir;
    flashMine = mine;
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => (flashDir = null), 320);
  }

  export async function applyMove(result: MoveResult, dir: Dir) {
    const slideMap = new Map(result.slides.map((s) => [s.id, s]));
    renderTiles = renderTiles.map((t) => {
      const s = slideMap.get(t.id);
      return s ? { ...t, row: s.row, col: s.col } : t;
    });

    await wait(SLIDE_MS);

    const removedIds = new Set(result.removed.map((r) => r.id));
    const created: RenderTile[] = result.created.map((t) => ({ ...t, state: 'pop' }));
    const spawned: RenderTile[] =
      !result.deadlock && result.spawned ? [{ ...result.spawned, state: 'spawn' }] : [];

    renderTiles = [...renderTiles.filter((t) => !removedIds.has(t.id)), ...created, ...spawned];

    if (result.pointsTo) flash(dir, result.pointsTo === 'player');

    if (result.deadlock) {
      await wait(260);
      flash('down', false);
      await wait(240);
      renderTiles = result.state.tiles.map((t) => ({ ...t, state: 'spawn' }));
    }

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

  function edgeClass(dir: 'up' | 'down'): string {
    const base = 'absolute left-3 right-3 h-1.5 rounded-full transition-colors duration-150';
    const position = dir === 'up' ? 'top-1' : 'bottom-1';
    const restColor = dir === 'up' ? 'bg-[var(--verde-tennis)]/40' : 'bg-[var(--rosso-padel)]/40';
    if (flashDir === dir) {
      return `${base} ${position} ${flashMine ? 'bg-[var(--verde-tennis)]' : 'bg-[var(--rosso-padel)]'}`;
    }
    return `${base} ${position} ${restColor}`;
  }
</script>

<div class="club-card p-4 md:p-6 flex flex-col gap-2">
  <p class="text-center text-xs uppercase tracking-widest font-black" style="color:var(--verde-tennis)">
    ▲ fai uscire la G da qui: game tuo
  </p>

  <div class="relative">
    <div class={edgeClass('up')}></div>
    <div class={edgeClass('down')}></div>

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
          class={`absolute flex items-center justify-center font-black transition-transform duration-[110ms] ease-out ${tileClasses(tile.value)} ${
            tile.state === 'spawn' ? 'tile-spawn' : ''
          } ${tile.state === 'pop' ? 'tile-pop' : ''}`}
          style={`width:${cell}px;height:${cell}px;font-size:${fontSize(tile.value)}px;--pos:translate(${pos(tile.col)}px,${pos(tile.row)}px);transform:var(--pos)`}
        >
          <span class="leading-none">{tile.value}</span>
        </div>
      {/each}
    </div>
  </div>

  <p class="text-center text-xs uppercase tracking-widest font-black" style="color:var(--rosso-padel)">
    ▼ da qui è game avversario
  </p>
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
  .tile-g {
    background: linear-gradient(
      180deg,
      var(--verde-tennis) 0%, var(--verde-tennis) 48%,
      black 48%, black 52%,
      var(--rosso-padel) 52%, var(--rosso-padel) 100%
    );
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }
</style>
