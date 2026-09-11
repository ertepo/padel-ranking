<script>
  import { onMount } from 'svelte';

  export let theme = 'neutral';
  export let accent = '#ffcc00';
  export let contrast = '#000';
  export let logoSrc = '/images/logo-b.svg';
  export let isHomePage = false;

  let headerEl;
  let isRankingOpen = false;
  let isTournamentsOpen = false;
  let isArcadeOpen = false;
  let desktopRankingContainer;
  let desktopTournamentsContainer;
  let desktopArcadeContainer;

  let hidden = false;
  let lastScrollY = 0;

  function handleScroll() {
    const y = window.scrollY;
    if (Math.abs(y - lastScrollY) < 5) return;

    if (y < 80) {
      hidden = false;
    } else if (y > lastScrollY) {
      // scroll verso il basso: nascondi l'header
      hidden = true;
      isRankingOpen = false;
      isTournamentsOpen = false;
      isArcadeOpen = false;
    } else {
      // scroll verso l'alto: mostra l'header
      hidden = false;
    }

    lastScrollY = y;
  }

  // Offset a cui si ancorano le barre "sticky" delle pagine (es. il selettore
  // Padel/Tennis in /regolamento): segue l'header, va a 0 quando l'header si
  // nasconde e torna alla sua altezza quando riappare.
  function syncHeaderOffset() {
    if (!headerEl) return;
    document.documentElement.style.setProperty(
      '--header-offset',
      hidden ? '0px' : `${headerEl.offsetHeight}px`,
    );
  }

  $: hidden, syncHeaderOffset();

  function closeDesktopRankingOnOutsideClick(event) {
    const isDesktop = window.innerWidth >= 1024;
    const clickedOutsideRanking =
      desktopRankingContainer &&
      !desktopRankingContainer.contains(event.target);
    const clickedOutsideTournaments =
      desktopTournamentsContainer &&
      !desktopTournamentsContainer.contains(event.target);
    const clickedOutsideArcade =
      desktopArcadeContainer &&
      !desktopArcadeContainer.contains(event.target);

    if (isDesktop && clickedOutsideRanking) {
      isRankingOpen = false;
    }

    if (isDesktop && clickedOutsideTournaments) {
      isTournamentsOpen = false;
    }

    if (isDesktop && clickedOutsideArcade) {
      isArcadeOpen = false;
    }
  }

  function toggleTournamentsMenu() {
    isTournamentsOpen = !isTournamentsOpen;
    if (isTournamentsOpen) {
      isRankingOpen = false;
      isArcadeOpen = false;
    }
  }

  function toggleRankingMenu() {
    isRankingOpen = !isRankingOpen;
    if (isRankingOpen) {
      isTournamentsOpen = false;
      isArcadeOpen = false;
    }
  }

  function toggleArcadeMenu() {
    isArcadeOpen = !isArcadeOpen;
    if (isArcadeOpen) {
      isTournamentsOpen = false;
      isRankingOpen = false;
    }
  }

  onMount(() => {
    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty('--header-h', `${headerEl.offsetHeight}px`);
      syncHeaderOffset();
    };

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    resizeObserver.observe(headerEl);

    lastScrollY = window.scrollY;
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  });
</script>

<svelte:window on:click={closeDesktopRankingOnOutsideClick} />

<header
  bind:this={headerEl}
  class={`sticky top-0 z-50 border-b-2 border-black transition-transform duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}
  style={`background-color: ${accent}; background: ${accent}; color: ${contrast};`}
>
  <div class="md:max-w-[80vw] mx-auto px-4 py-2 flex items-center justify-center lg:justify-between">
   <a href="/" aria-label="Torna alla Home" class="block shrink-0">
     <img
      src={`${logoSrc}?v=2`}
      alt="Tie-Break"
      class="block h-10 w-[240px] object-contain object-center sm:w-[227px] md:h-14 md:w-[320px] lg:object-left"
      width="3240"
      height="602"
    />
  </a>

    <!-- Desktop -->
    <nav class="hidden lg:flex items-center gap-3">
      {#if !isHomePage}
        <a href="/" class="club-btn inline-flex items-center gap-2 px-4 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.5v3.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5"/>
          </svg>
          Home
        </a>
      {/if}

      <div class="relative" bind:this={desktopTournamentsContainer}>
        <button
          type="button"
          class="club-btn flex items-center gap-2 px-4 py-2"
          aria-expanded={isTournamentsOpen}
          aria-controls="desktop-tournaments-menu"
          on:click={toggleTournamentsMenu}
        >
          Tornei Padel
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class={`transition-transform ${isTournamentsOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
          </svg>
        </button>

        {#if isTournamentsOpen}
          <div
            id="desktop-tournaments-menu"
            class="absolute right-0 top-full mt-3 flex min-w-72 flex-col gap-3 border-2 border-black bg-blue-100/45 p-5 pl-6 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
          >
            <a
              href="/tornei/cascualian-open"
              class="club-btn inline-flex items-center whitespace-nowrap px-4 py-2"
              on:click={() => (isTournamentsOpen = false)}
            >
              Cascualian Open
            </a>

            <a
              href="/tornei/serronchioland-garros"
              class="club-btn inline-flex items-center whitespace-nowrap px-4 py-2"
              on:click={() => (isTournamentsOpen = false)}
            >
              Serronchioland Garros
            </a>

            <a
            href="/tornei/cordivinbledon"
            class="club-btn inline-flex items-center whitespace-nowrap px-4 py-2"
            on:click={() => (isTournamentsOpen = false)}
            >
              Cordivimbledon
        </a>

            <span class="club-btn inline-flex cursor-not-allowed items-center px-4 py-2 opacity-60">
              PalazzUS Open
            </span>
          </div>
        {/if}
      </div>

      <div class="relative" bind:this={desktopRankingContainer}>
        <button
          type="button"
          class="club-btn flex items-center gap-2 px-4 py-2"
          aria-expanded={isRankingOpen}
          aria-controls="desktop-ranking-menu"
          on:click={toggleRankingMenu}
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
            class="absolute right-0 top-full mt-3 flex min-w-56 flex-col gap-3 border-2 border-black bg-blue-100/45 p-5 pl-6 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
          >
          <a
              href="/regolamento"
              class="club-btn inline-flex items-center gap-2 px-4 py-2"
              on:click={() => (isRankingOpen = false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2z"/>
              </svg>
              Regolamento
            </a>
            <a
              href="/ranking/tennis"
              class="club-btn inline-flex items-center gap-2 px-4 py-2"
              on:click={() => (isRankingOpen = false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
                <path fill-rule="evenodd" d="M0 0h1v15h15v1H0zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5"/>
              </svg>
              Tennis
            </a>

            <a
              href="/ranking/padel"
              class="club-btn inline-flex items-center gap-2 px-4 py-2"
              on:click={() => (isRankingOpen = false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
                <path fill-rule="evenodd" d="M0 0h1v15h15v1H0zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5"/>
              </svg>
              Padel
            </a>
      <a href="/matches" class="club-btn inline-flex items-center gap-2 px-4 py-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M0 1a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1zm0 9a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z"/>
        </svg>
        Matches
      </a>

            <a
              href="/tornei/gestione"
              class="club-btn-pastelyellow inline-flex items-center whitespace-nowrap px-4 py-2"
              on:click={() => (isRankingOpen = false)}
            >
              Organizza torneo
            </a>
          </div>
        {/if}
      </div>

      <div class="relative" bind:this={desktopArcadeContainer}>
        <button
          type="button"
          class="club-btn flex items-center gap-2 px-4 py-2"
          aria-expanded={isArcadeOpen}
          aria-controls="desktop-arcade-menu"
          on:click={toggleArcadeMenu}
        >
          Arcade
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class={`transition-transform ${isArcadeOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
          </svg>
        </button>

        {#if isArcadeOpen}
          <div
            id="desktop-arcade-menu"
            class="absolute right-0 top-full mt-3 flex min-w-56 flex-col gap-3 border-2 border-black bg-blue-100/45 p-5 pl-6 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
          >
            <a
              href="/arcade"
              class="club-btn inline-flex items-center gap-2 px-4 py-2"
              on:click={() => (isArcadeOpen = false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M14 1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM4 0a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM2 10a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>
              </svg>
              Vai ai giochi
            </a>

            <a
              href="/arcade/classifica"
              class="club-btn inline-flex items-center gap-2 px-4 py-2"
              on:click={() => (isArcadeOpen = false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
                <path fill-rule="evenodd" d="M0 0h1v15h15v1H0zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5"/>
              </svg>
              Highlights
            </a>
          </div>
        {/if}
      </div>

      <a
        href="/prenotazioni"
        class="club-btn-pastelgreen inline-flex items-center gap-2 px-4 py-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5 shrink-0" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
        </svg>
        Prenotazioni
      </a>
    </nav>
  </div>
</header>
