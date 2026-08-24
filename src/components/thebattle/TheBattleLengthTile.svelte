<script lang="ts">
  export let length: number;
  export let count: number;
  export let disabled: boolean = false;
  /** Non è il turno del proprietario di questa tessera: sempre visibile, ma spenta e non cliccabile. */
  export let inactive: boolean = false;
  export let selected: boolean = false;
  export let onClick: () => void = () => {};
  export let tileSize: number = 44;
  export let peekStep: number = 8;

  const MAX_PEEKS = 4;

  $: peekCount = Math.max(0, Math.min(count - 1, MAX_PEEKS));
  $: peeks = Array.from({ length: peekCount }, (_, i) => i);
  $: isDisabled = disabled || inactive || count <= 0;
  $: fontSize = tileSize * 0.36;
</script>

<button
  type="button"
  class="tb-len"
  class:tb-len-inactive={inactive}
  class:tb-len-selected={selected}
  style={`width:${tileSize}px; height:${tileSize + peekStep * peekCount}px;`}
  disabled={isDisabled}
  on:click={onClick}
  aria-label={`Mossa da ${length} caselle, ${count} disponibili`}
>
  {#each peeks as i (i)}
    <span
      class="tb-len-peek"
      style={`top:${peekStep * (i + 1)}px; width:${tileSize}px; height:${tileSize}px; z-index:${peekCount - i};`}
    ></span>
  {/each}
  <span class="tb-len-face" style={`width:${tileSize}px; height:${tileSize}px; font-size:${fontSize}px;`}>
    {length}
  </span>
</button>

<style>
  .tb-len {
    position: relative;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .tb-len:disabled {
    cursor: default;
  }

  .tb-len-peek {
    position: absolute;
    left: 0;
    background: #e2e8f0;
    border: 2px solid black;
  }

  .tb-len-face {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 2px solid black;
    font-weight: 900;
    color: black;
    z-index: 10;
  }

  .tb-len:disabled .tb-len-face {
    background: #f1f5f9;
    color: #94a3b8;
  }

  .tb-len:not(:disabled):hover .tb-len-face {
    background: var(--giallo-club);
  }

  .tb-len-selected .tb-len-face {
    background: var(--giallo-club) !important;
    color: black;
  }

  .tb-len-inactive {
    opacity: 0.4;
    filter: grayscale(1);
  }
</style>
