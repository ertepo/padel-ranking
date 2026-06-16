<script>
  export let theme = 'neutral';
  export let accent = 'var(--theme-accent)';
  export let contrast = 'var(--theme-accent-contrast)';
  export let logoSrc = '/images/logo-b.svg';

  let isOpen = false;
  let isRankingOpen = false;
  let desktopRankingContainer;

  function closeDesktopRankingOnOutsideClick(event) {
    const isDesktop = window.innerWidth >= 1024;
    const clickedOutside =
      desktopRankingContainer &&
      !desktopRankingContainer.contains(event.target);

    if (isDesktop && clickedOutside) {
      isRankingOpen = false;
    }
  }
</script>

<svelte:window on:click={closeDesktopRankingOnOutsideClick} />

<header
  class="sticky top-0 z-50 border-b-2 border-black"
  style={`background-color: ${accent}; background: ${accent}; color: ${contrast};`}
>
  <div class="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
   <a href="/" aria-label="Torna alla Home" class="block shrink-0">
     <img
      src={`${logoSrc}?v=2`}
      alt="Tie-Break"
      class="block h-10 w-[240px] object-contain object-left sm:w-[227px] md:h-14 md:w-[320px]"
      width="3240"
      height="602"
    />
  </a>

    <!-- Desktop -->
    <nav class="hidden lg:flex items-center gap-3">
      <a href="/" class="club-btn px-4 py-2">
        Home
      </a>

      <a href="/tornei/cascualian-open" class="club-btn-yellow px-4 py-2">
        Torneo Padel
      </a>

      <div class="relative" bind:this={desktopRankingContainer}>
        <button
          type="button"
          class="club-btn flex items-center gap-2 px-4 py-2"
          aria-expanded={isRankingOpen}
          aria-controls="desktop-ranking-menu"
          on:click={() => (isRankingOpen = !isRankingOpen)}
        >
          Campionati
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class={`transition-transform ${isRankingOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
          </svg>
        </button>

        {#if isRankingOpen}
          <div
            id="desktop-ranking-menu"
            class="absolute right-0 top-full mt-3 flex min-w-56 flex-col gap-3 border-2 border-black bg-white p-5 pl-6 club-card ombra"
          >
          <a
              href="/#regolamento"
              class="club-btn-pastelyellow px-4 py-2"
              on:click={() => (isRankingOpen = false)}
            >
              Regolamento
            </a>
            <a
              href="/ranking/tennis"
              class="club-btn-violet px-4 py-2"
              on:click={() => (isRankingOpen = false)}
            >
              Tennis Ranking
            </a>

            <a
              href="/ranking/padel"
              class="club-btn-blue
              
              
              
               px-4 py-2"
              on:click={() => (isRankingOpen = false)}
            >
              Padel Ranking
            </a>
      <a href="/matches" class="club-btn-yellow px-4 py-2 !text-black">
        Matches
      </a>
            
          </div>
        {/if}
      </div>

      
      <a
        href="/prenotazioni"
        class="club-btn-pastelgreen  px-4 py-2"
      >
        Prenotazioni
      </a>
    </nav>

    <!-- Hamburger -->
    <button
      class="lg:hidden relative w-10 h-10"
      on:click={() => (isOpen = !isOpen)}
      aria-label="Menu"
    >
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span
          class={`block h-0.5 w-7 bg-black transition ${
            isOpen ? 'rotate-45 translate-y-2' : ''
          }`}
        ></span>

        <span
          class={`block h-0.5 w-7 bg-black transition ${
            isOpen ? 'opacity-0' : ''
          }`}
        ></span>

        <span
          class={`block h-0.5 w-7 bg-black transition ${
            isOpen ? '-rotate-45 -translate-y-2' : ''
          }`}
        ></span>
      </div>
    </button>
  </div>

  <!-- Overlay -->
  {#if isOpen}
    <button
      class="fixed inset-0 bg-black/40 lg:hidden"
      on:click={() => (isOpen = false)}
      aria-label="Close menu"
    ></button>
  {/if}

  <!-- Drawer -->
  <aside
    class={`fixed top-0 right-0 h-full w-72 border-l-2 border-black bg-white/45 shadow-2xl backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300 z-50 lg:hidden ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}
  >
    <div class="p-6 flex flex-col gap-4">
      <a
        href="/"
        class="club-btn p-4 text-center"
        on:click={() => (isOpen = false)}
      >
        Home
      </a>

      <a
        href="/tornei/cascualian-open"
        class="club-btn-yellow p-4 text-center"
        on:click={() => (isOpen = false)}
      >
        Torneo Padel
      </a>

      <button
        type="button"
        class="club-btn flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap p-4 text-center"
        aria-expanded={isRankingOpen}
        aria-controls="mobile-ranking-menu"
        on:click={() => (isRankingOpen = !isRankingOpen)}
      >
        Campionati<svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class={`shrink-0 transition-transform ${isRankingOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
        </svg>
      </button>

      {#if isRankingOpen}
        <div id="mobile-ranking-menu" class="flex flex-col gap-3 pl-4">
          <a
            href="/#regolamento"
            class="club-btn-pastelyellow p-4 text-center"
            on:click={() => {
              isRankingOpen = false;
              isOpen = false;
            }}
          >
            Regolamento
          </a><a
            href="/ranking/tennis"
            class="club-btn p-4 text-center"
            on:click={() => {
              isRankingOpen = false;
              isOpen = false;
            }}
          >
            Tennis Ranking
          </a>

          <a
            href="/ranking/padel"
            class="club-btn p-4 text-center"
            on:click={() => {
              isRankingOpen = false;
              isOpen = false;
            }}
          >
            Padel Ranking
          </a>
          <a
        href="/matches"
        class="club-btn p-4 text-center"
        on:click={() => (isOpen = false)}
      >
        Match
      </a>
          
        </div>
      {/if}

      <a
        href="/prenotazioni"
        class="club-btn-pastelgreen p-4 text-center"
        on:click={() => (isOpen = false)}
      >
        Disponibilita campi
      </a>
    </div>
  </aside>
</header>
