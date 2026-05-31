<script>
  export let theme = 'neutral';

  let isOpen = false;
  let isRankingOpen = false;
  let desktopRankingContainer;

  function closeDesktopRankingOnOutsideClick(event) {
    const isDesktop = window.innerWidth >= 768;
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
  style="background: var(--theme-accent);"
>
  <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
   <a href="/" aria-label="Torna alla Home">
     <svg 
     fill="white"
      viewBox="0 0 3227 455" 
      class="h-8  max-w-[200px] sm:max-w-[300px] md:h-10 md:max-w-none"
      version="1.1" 
      xmlns="http://www.w3.org/2000/svg" 
      xmlns:xlink="http://www.w3.org/1999/xlink" 
      xml:space="preserve" 
      xmlns:serif="http://www.serif.com/" 
      style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"
>
    <g id="Tavola-da-disegno1" transform="matrix(0.935799,0,0,0.721373,0,-180.537452)">
        <rect x="0" y="250.269" width="3447.394" height="630.221" style="fill:none;"/>
        <g transform="matrix(1.068606,0,0,1.386246,-68.445629,-1062.564046)">
            <path d="M2053.837,1189.714L2053.837,959.413L2381.661,959.413L2381.661,1059.963L2185.03,1059.963L2185.03,1123.166L2304.483,1123.166C2227.379,1143.218 2143.999,1165.332 2053.837,1189.714Z"/>
            <path d="M2498.251,1073.762L2533.603,959.413L2675.011,959.413L2695.816,1025.919C2636.523,1039.795 2570.891,1055.651 2498.251,1073.762Z"/>
            <path d="M2851.532,990.782L2851.532,959.413L2977.618,959.413L2977.618,964.857C2940.807,971.976 2898.999,980.527 2851.532,990.782Z"/>
            <path d="M1602.799,1315.299L1602.799,959.413L1830.393,959.413C1880.615,959.413 1919.611,971.17 1947.382,994.685C1975.153,1018.2 1989.038,1049.216 1989.038,1087.734C1989.038,1112.845 1983.931,1135.029 1973.716,1154.288C1963.502,1173.547 1942.86,1190.518 1911.79,1205.201L1920.46,1226.085C1908.437,1229.39 1896.305,1232.732 1884.064,1236.11C1852.672,1244.774 1821.783,1253.354 1791.394,1261.85L1778.682,1228.503L1736.546,1228.503L1736.546,1277.243C1690.799,1290.133 1646.223,1302.82 1602.799,1315.299ZM1736.546,1135.295L1793.684,1135.295C1810.496,1135.295 1824.009,1131.784 1834.223,1124.762C1844.438,1117.739 1849.545,1107.418 1849.545,1093.799C1849.545,1065.921 1832.415,1051.983 1798.153,1051.983L1736.546,1051.983L1736.546,1135.295Z"/>
            <path d="M1330.916,1395.129L1182.725,1395.129L1182.725,959.413L1403.934,959.413C1449.9,959.413 1483.416,971.011 1504.484,994.206C1525.551,1017.402 1536.085,1043.896 1536.085,1073.689C1536.085,1095.395 1529.967,1115.026 1517.731,1132.582C1505.495,1150.138 1487.247,1162.215 1462.987,1168.812C1519.38,1182.431 1547.577,1216.267 1547.577,1270.319C1547.577,1294.036 1542.228,1315.893 1531.532,1335.891C1461.535,1356.228 1394.69,1375.983 1330.916,1395.129ZM1305.938,1298.09L1371.056,1298.09C1387.229,1298.09 1399.093,1294.1 1406.647,1286.12C1414.202,1278.14 1417.979,1269.149 1417.979,1259.147C1417.979,1249.145 1414.308,1239.942 1406.967,1231.536C1399.625,1223.13 1386.165,1218.927 1366.587,1218.927L1305.938,1218.927L1305.938,1298.09ZM1305.938,1126.358L1367.864,1126.358C1383.399,1126.358 1394.358,1122.421 1400.742,1114.547C1407.126,1106.673 1410.318,1098.268 1410.318,1089.33C1410.318,1065.07 1395.422,1052.94 1365.629,1052.94L1305.938,1052.94L1305.938,1126.358Z"/>
            <rect x="973.964" y="1180.303" width="161.837" height="100.231"/>
            <path d="M950.024,1291.068L950.024,1395.129L622.2,1395.129L622.2,959.413L950.024,959.413L950.024,1059.963L753.393,1059.963L753.393,1123.166L912.357,1123.166L912.357,1219.885L753.393,1219.885L753.393,1291.068L950.024,1291.068Z"/>
            <rect x="412.481" y="959.413" width="133.747" height="435.716"/>
            <path d="M284.161,1063.793L284.161,1395.129L157.436,1395.129L157.436,1063.793L67.101,1063.793L67.101,959.413L374.496,959.413L374.496,1063.793L284.161,1063.793Z"/>
        </g>
        <g transform="matrix(1.068606,0,0,1.386246,-39.982887,-1062.564046)">
            <path d="M2977.618,964.857L2977.618,1139.275L3097.958,959.413L3217.98,959.413L3107.854,1118.552L3244.474,1395.129L3097.958,1395.129L3022.626,1230.279L2977.618,1294.579L2977.618,1395.129L2851.532,1395.129L2851.532,990.782C2898.999,980.527 2940.807,971.976 2977.618,964.857Z"/>
            <path d="M2695.816,1025.919L2811.312,1395.129L2675.011,1395.129L2650.432,1309.262L2533.603,1309.262L2507.428,1395.129L2398.898,1395.129L2498.251,1073.762C2570.891,1055.651 2636.523,1039.795 2695.816,1025.919ZM2556.267,1214.139L2627.13,1214.139L2591.698,1087.928L2556.267,1214.139Z"/>
            <path d="M2304.483,1123.166L2343.995,1123.166L2343.995,1219.885L2185.03,1219.885L2185.03,1291.068L2381.661,1291.068L2381.661,1395.129L2053.837,1395.129L2053.837,1189.714C2143.999,1165.332 2227.379,1143.218 2304.483,1123.166Z"/>
            <path d="M1920.46,1226.085L1990.634,1395.129L1842.203,1395.129L1791.394,1261.85C1821.783,1253.354 1852.672,1244.774 1884.064,1236.11C1896.305,1232.732 1908.437,1229.39 1920.46,1226.085Z"/>
            <path d="M1736.546,1277.243L1736.546,1395.129L1602.799,1395.129L1602.799,1315.299C1646.223,1302.82 1690.799,1290.133 1736.546,1277.243Z"/>
            <path d="M1531.532,1335.891C1527.64,1343.168 1523.039,1350.199 1517.731,1356.984C1497.834,1382.414 1455.326,1395.129 1390.208,1395.129L1330.916,1395.129C1394.69,1375.983 1461.535,1356.228 1531.532,1335.891Z"/>
        </g>
    </g>
</svg></a>

    <!-- Desktop -->
    <nav class="hidden md:flex items-center gap-3">
      <a href="/" class="club-btn-yellow px-4 py-2">
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
