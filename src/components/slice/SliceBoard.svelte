<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { LABELS, mergeRule, type Dir, type MoveResult, type Tile } from '../../lib/slice/engine';
  import { tileBackground, tileTextColor } from '../../lib/slice/tileStyle';

  export let initialTiles: Tile[];
  /** Quando impostata, la board mostra bersagli cliccabili invece di reagire allo swipe. */
  export let selectMode: 'row' | 'col' | 'value' | null = null;

  const dispatch = createEventDispatcher<{
    swipe: Dir;
    select: { row: number } | { col: number } | { level: number };
  }>();

  const SIZE = 4;
  const SLIDE_MS = 80;

  type TileState = 'idle' | 'spawn' | 'pop' | 'vanish';
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

  function ballBackground(): string {
    return 'var(--giallo-club)';
  }

  /**
   * true se la tessera ha un vicino ortogonale con cui la mossa di fusione
   * del gioco (mergeRule) è valida — non "stesso livello": PUNTO si accoppia
   * solo con 15 (e viceversa), da 30 in su solo con un livello identico.
   */
  function canHop(tile: RenderTile): boolean {
    const deltas: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    return deltas.some(([dr, dc]) =>
      renderTiles.some(
        (t) =>
          t.row === tile.row + dr &&
          t.col === tile.col + dc &&
          mergeRule(tile.level, t.level) !== null,
      ),
    );
  }

  /** Ampiezza (px) del "sobbalzo" verso l'alto: minima, mai oltre il gap tra le celle. */
  function hopDistance(): number {
    return gap * 0.5;
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

    // Micro-vibrazione al momento della fusione (silenziosa su dispositivi/browser senza supporto).
    if (created.length > 0) navigator.vibrate?.(15);

    renderTiles = [...renderTiles.filter((t) => !removedIds.has(t.id)), ...created, ...spawned];

    await wait(20);
    renderTiles = renderTiles.map((t) => ({ ...t, state: 'idle' }));
  }

  /**
   * Da chiamare dopo un potere che cancella tessere (riga/colonna/valore): a
   * differenza di applyMove, nessuna tessera scorre, alcune spariscono e
   * basta. Le tessere rimaste sono già passate come `remainingTiles` (stesso
   * riferimento id): senza questa sincronizzazione esplicita `renderTiles`
   * (interno, aggiornato solo qui e in applyMove) continuerebbe a mostrare
   * quelle cancellate come "fantasmi" finché una nuova tessera non ne
   * riusasse per caso la stessa cella.
   */
  export async function applyPowerClear(remainingTiles: Tile[]) {
    const remainingIds = new Set(remainingTiles.map((t) => t.id));
    renderTiles = renderTiles.map((t) =>
      remainingIds.has(t.id) ? t : { ...t, state: 'vanish' },
    );

    await wait(160);

    renderTiles = remainingTiles.map((t) => ({ ...t, state: 'idle' }));
  }

  /** Sincronizzazione istantanea (senza animazione): usata per l'undo. */
  export function syncTiles(tiles: Tile[]) {
    renderTiles = tiles.map((t) => ({ ...t, state: 'idle' }));
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
    if (selectMode) {
      touchStart = null;
      return;
    }
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
      {@const hop = canHop(tile)}
      <div
        class={`absolute flex items-center justify-center border-2 border-black font-black text-center transition-transform duration-[80ms] ease-out ${
          tile.state === 'spawn' ? 'tile-spawn' : ''
        } ${tile.state === 'pop' ? 'tile-pop' : ''} ${tile.state === 'vanish' ? 'tile-vanish' : ''} ${hop ? 'tile-hop' : ''}`}
        style={`width:${cell}px;height:${cell}px;font-size:${fontSize(tile.level)}px;background:${tileBackground(tile.level)};color:${tileTextColor(tile.level)};--pos:translate(${pos(tile.col)}px,${pos(tile.row)}px);transform:var(--pos)${hop ? `;--hop:0px, -${hopDistance()}px` : ''}`}
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

    {#if selectMode === 'row'}
      {#each Array(SIZE) as _, r}
        <button
          type="button"
          class="select-overlay absolute"
          style={`left:0px;top:${pos(r)}px;width:100%;height:${cell}px`}
          on:click={() => dispatch('select', { row: r })}
          aria-label={`Cancella riga ${r + 1}`}
        ></button>
      {/each}
    {:else if selectMode === 'col'}
      {#each Array(SIZE) as _, c}
        <button
          type="button"
          class="select-overlay absolute"
          style={`top:0px;left:${pos(c)}px;height:100%;width:${cell}px`}
          on:click={() => dispatch('select', { col: c })}
          aria-label={`Cancella colonna ${c + 1}`}
        ></button>
      {/each}
    {:else if selectMode === 'value'}
      {#each renderTiles as tile (tile.id)}
        <button
          type="button"
          class="select-overlay-tile absolute"
          style={`width:${cell}px;height:${cell}px;left:${pos(tile.col)}px;top:${pos(tile.row)}px`}
          on:click={() => dispatch('select', { level: tile.level })}
          aria-label={`Cancella tutte le tessere ${LABELS[tile.level]}`}
        ></button>
      {/each}
    {/if}
  </div>
</div>

<style>
  @keyframes slice-spawn {
    from { transform: var(--pos) scale(0.4); opacity: 0; }
  }
  @keyframes slice-pop {
    50% { transform: var(--pos) scale(1.16); }
  }
  @keyframes slice-vanish {
    to { transform: var(--pos) scale(0.3); opacity: 0; }
  }
  @keyframes slice-hop {
    0%, 16%, 100% { transform: var(--pos); }
    8% { transform: var(--pos) translate(var(--hop)); }
  }
  /* Definita prima di .tile-spawn/.tile-pop/.tile-vanish: se una tessera è
     anche in una di quelle transizioni, la loro animation (definita dopo,
     stessa specificità) vince sulla cascata e sostituisce momentaneamente
     il sobbalzo, che riprende non appena lo stato torna 'idle'. */
  .tile-hop { animation: slice-hop 3s ease-in-out infinite; }
  .tile-spawn { animation: slice-spawn 160ms ease-out; }
  .tile-pop { animation: slice-pop 180ms ease-out; }
  .tile-vanish { animation: slice-vanish 160ms ease-in forwards; }
  .slice-ball {
    display: block;
    border-radius: 9999px;
    border: 1px solid black;
  }
  .select-overlay,
  .select-overlay-tile {
    padding: 0;
    background: rgba(220, 38, 38, 0);
    border: none;
    cursor: pointer;
    transition: background 100ms ease;
  }
  .select-overlay:hover,
  .select-overlay:focus-visible {
    background: rgba(220, 38, 38, 0.25);
  }
  .select-overlay-tile:hover,
  .select-overlay-tile:focus-visible {
    background: rgba(220, 38, 38, 0.35);
    outline: 3px solid black;
    outline-offset: -3px;
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }
</style>
