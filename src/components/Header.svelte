<script>
  let isOpen = false;
</script>

<header class="sticky top-0 z-50 bg-[var(--giallo-club)] border-b-2 border-black">
  <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
    <a href="/" class="font-black text-2xl uppercase tracking-tight">
      Poggio's Championship
    </a>

    <!-- Desktop -->
    <nav class="hidden md:flex items-center gap-3">
      <a href="/" class="club-btn px-4 py-2">
        Home
      </a>

      <a href="/classifica" class="club-btn px-4 py-2">
        Classifica
      </a>

      <a href="/matches" class="club-btn px-4 py-2">
        Match
      </a>
    </nav>

    <!-- Hamburger -->
    <button
      class="md:hidden relative w-10 h-10"
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
      class="fixed inset-0 bg-black/40 md:hidden"
      on:click={() => (isOpen = false)}
      aria-label="Close menu"
    ></button>
  {/if}

  <!-- Drawer -->
  <aside
    class={`fixed top-0 right-0 h-full w-72 bg-white border-l-2 border-black shadow-2xl transition-transform duration-300 z-50 md:hidden ${
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
        href="/classifica"
        class="club-btn p-4 text-center"
        on:click={() => (isOpen = false)}
      >
        Classifica
      </a>

      <a
        href="/matches"
        class="club-btn p-4 text-center"
        on:click={() => (isOpen = false)}
      >
        Match
      </a>
    </div>
  </aside>
</header>