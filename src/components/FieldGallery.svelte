<script>
  import { tick } from 'svelte';
  import { slide } from 'svelte/transition';

  export let images = [];
  export let extraImages = [];

  let galleryRoot;
  let isExpanded = false;

  const toggleGallery = async () => {
    if (!isExpanded) {
      isExpanded = true;
      return;
    }

    isExpanded = false;
    await tick();

    const section = galleryRoot?.closest('section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
</script>

<div bind:this={galleryRoot}>
  <div class="grid gap-6 md:grid-cols-3">
    {#each images as image}
      <figure class={`border-2 border-black bg-white p-3 ${image.accentClass}`}>
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          class="aspect-[4/3] w-full border-2 border-black object-cover"
        />

        <figcaption class="mt-3 flex items-center justify-between gap-3 text-sm font-black uppercase text-black">
          <span>{image.caption}</span>
          <span class="border-2 border-black bg-[var(--giallo-club)] px-2 py-1 text-xs">
            2026
          </span>
        </figcaption>
      </figure>
    {/each}
  </div>

  {#if extraImages.length > 0}
    {#if isExpanded}
      <div id="extra-field-gallery" transition:slide={{ duration: 220 }}>
        <div class="mt-6 grid gap-6 md:grid-cols-3">
          {#each extraImages as image}
            <figure class={`border-2 border-black bg-white p-3 ${image.accentClass}`}>
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                class="aspect-[4/3] w-full border-2 border-black object-cover"
              />

              <figcaption class="mt-3 flex items-center justify-between gap-3 text-sm font-black uppercase text-black">
                <span>{image.caption}</span>
                <span class="border-2 border-black bg-[var(--giallo-club)] px-2 py-1 text-xs">
                  2026
                </span>
              </figcaption>
            </figure>
          {/each}
        </div>
      </div>
    {/if}

    <div class="mt-8 flex justify-center">
      <button
        type="button"
        class="club-btn-yellow inline-flex items-center justify-center gap-2 px-5 py-3"
        aria-expanded={isExpanded}
        aria-controls="extra-field-gallery"
        on:click={toggleGallery}
      >
        {isExpanded ? 'Nascondi foto' : 'Carica altre foto'}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  {/if}
</div>
