<script>
  import { onMount, onDestroy, tick } from "svelte";

  export let images = [];

  let trackEl;
  let isDragging = false;
  let startX = 0;
  let scrollStart = 0;
  let moved = false;
  let canScrollLeft = false;
  let canScrollRight = false;
  let resizeObserver;

  const updateScrollState = () => {
    if (!trackEl) return;

    canScrollLeft = trackEl.scrollLeft > 4;
    canScrollRight = trackEl.scrollLeft < trackEl.scrollWidth - trackEl.clientWidth - 4;
  };

  const scrollByPage = (direction) => {
    if (!trackEl) return;

    trackEl.scrollBy({ left: direction * trackEl.clientWidth * 0.7, behavior: "smooth" });
  };

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

  onMount(async () => {
    await tick();
    updateScrollState();

    resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(trackEl);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });
</script>

<div class="relative">
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
    on:scroll={updateScrollState}
    on:scrollend={updateScrollState}
  >
    {#each images as image}
      <figure class={`shrink-0 select-none border-2 border-black bg-white p-3 ${image.accentClass || "dark-club-card"}`}>
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          draggable="false"
          class={`h-64 w-auto border-2 border-black object-cover sm:h-72 md:h-100 ${image.orientation === "portrait" ? "aspect-[2/3]" : "aspect-[3/2]"}`}
        />

        {#if image.caption}
          <figcaption class="mt-3 text-sm font-black uppercase text-black">
            {image.caption}
          </figcaption>
        {/if}
      </figure>
    {/each}
  </div>

  {#if canScrollLeft}
    <button
      type="button"
      aria-label="Scorri a sinistra"
      class="club-btn-yellow absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border-2 border-black bg-white text-black md:flex"
      on:click={() => scrollByPage(-1)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5" aria-hidden="true">
        <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
      </svg>
    </button>
  {/if}

  {#if canScrollRight}
    <button
      type="button"
      aria-label="Scorri a destra"
      class="club-btn-yellow absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border-2 border-black bg-white text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition hover:bg-[var(--giallo-club)] md:flex"
      on:click={() => scrollByPage(1)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5" aria-hidden="true">
        <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z" clip-rule="evenodd" />
      </svg>
    </button>
  {/if}
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
