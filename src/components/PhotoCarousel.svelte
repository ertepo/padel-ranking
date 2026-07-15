<script>
  export let images = [];

  let trackEl;
  let isDragging = false;
  let startX = 0;
  let scrollStart = 0;
  let moved = false;

  const onPointerDown = (event) => {
    if (event.pointerType === "touch") return;

    isDragging = true;
    moved = false;
    startX = event.clientX;
    scrollStart = trackEl.scrollLeft;
    trackEl.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!isDragging) return;

    const delta = event.clientX - startX;

    if (Math.abs(delta) > 3) moved = true;

    trackEl.scrollLeft = scrollStart - delta;
  };

  const stopDragging = () => {
    isDragging = false;
  };

  const onClickCapture = (event) => {
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={trackEl}
  role="region"
  aria-label="Galleria foto, scorri orizzontalmente"
  tabindex="0"
  class="photo-carousel flex gap-6 overflow-x-auto p-4"
  class:is-dragging={isDragging}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={stopDragging}
  on:pointercancel={stopDragging}
  on:pointerleave={stopDragging}
  on:click|capture={onClickCapture}
>
  {#each images as image}
    <figure class={`shrink-0 select-none border-2 border-black bg-white p-3 ${image.accentClass || "dark-club-card"}`}>
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        draggable="false"
        class={`h-64 w-auto border-2 border-black object-cover sm:h-72 md:h-80 ${image.orientation === "portrait" ? "aspect-[2/3]" : "aspect-[3/2]"}`}
      />

      {#if image.caption}
        <figcaption class="mt-3 text-sm font-black uppercase text-black">
          {image.caption}
        </figcaption>
      {/if}
    </figure>
  {/each}
</div>

<style>
  .photo-carousel {
    cursor: grab;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .photo-carousel::-webkit-scrollbar {
    display: none;
  }

  .photo-carousel.is-dragging {
    cursor: grabbing;
    scroll-snap-type: none;
    user-select: none;
  }
</style>
