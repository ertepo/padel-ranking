<script lang="ts">
  import { onMount } from 'svelte';

  type Court = {
    id: string;
    name: string;
    sport: 'padel' | 'tennis' | 'altro';
    color: string;
    surface: string | null;
    inoutdoor: string;
    closureLabel: string | null;
  };

  type Slot = {
    id: string;
    courtId: string;
    start: string;
    end: string;
    available: boolean;
    status: 'available' | 'booked' | 'closed' | 'closed_slot';
  };

  type Availability = {
    bookingUrl: string;
    courts: Court[];
    slots: Slot[];
    demo?: boolean;
  };

  const localDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  let selectedDate = localDate(new Date());
  let availability: Availability | null = null;
  let error = '';
  let loading = true;
  let dateInput: HTMLInputElement;

  const displayDate = () => new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${selectedDate}T12:00:00`));

  const displayTime = (value: string) => value.slice(11, 16);

  const slotsForCourt = (courtId: string) =>
    availability?.slots.filter((slot) => slot.courtId === courtId) || [];

  const minutesFromMidnight = (value: string) => {
    const [hours, minutes] = displayTime(value).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const timelineStart = () =>
    Math.min(...(availability?.slots.map((slot) => minutesFromMidnight(slot.start)) || [0]));

  const timelineRow = (slot: Slot) =>
    Math.floor((minutesFromMidnight(slot.start) - timelineStart()) / 15) + 1;

  const timelineSpan = (slot: Slot) =>
    Math.max(Math.round((minutesFromMidnight(slot.end) - minutesFromMidnight(slot.start)) / 15), 1);

  const timelineStyle = (slot: Slot) =>
    `grid-row: ${timelineRow(slot)} / span ${timelineSpan(slot)};`;

  const skeletonSlots = (courtId: string) => {
    const count = slotsForCourt(courtId).length;
    return Array.from({ length: count || 6 });
  };

  const unavailableLabel = (slot: Slot) =>
    slot.status === 'closed' || slot.status === 'closed_slot' ? 'Chiuso' : 'Occupato';

  const availableSlotClasses = (sport: Court['sport']) => {
    if (sport === 'padel') {
      return 'bg-[color-mix(in_oklab,var(--blu-padel)_22%,white)] hover:bg-[color-mix(in_oklab,var(--blu-padel)_35%,white)]';
    }
    if (sport === 'tennis') {
      return 'bg-[color-mix(in_oklab,var(--viola-tennis)_22%,white)] hover:bg-[color-mix(in_oklab,var(--viola-tennis)_35%,white)]';
    }
    return 'bg-green-200 hover:bg-green-300';
  };

  async function loadAvailability() {
    loading = true;
    error = '';

    try {
      const response = await fetch(`/api/openresa/slots?date=${selectedDate}`);
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error);
      availability = payload;
    } catch (requestError) {
      availability = null;
      error = requestError instanceof Error
        ? requestError.message
        : 'Non riusciamo a caricare le disponibilita.';
    } finally {
      loading = false;
    }
  }

  function shiftDay(offset: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    selectedDate = localDate(date);
    loadAvailability();
  }

  onMount(() => {
    loadAvailability();

    const refreshInterval = window.setInterval(loadAvailability, 60_000);
    return () => window.clearInterval(refreshInterval);
  });
</script>

<section aria-busy={loading}>
  <div class="sticky top-[var(--header-h,4.6rem)] z-40 mb-7 grid min-h-[5.5rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-2 border-black bg-white px-3 py-3 shadow-[-1rem_1rem_0_rgb(0_0_0_/_45%)] sm:gap-4 sm:px-4">
    <button class="club-btn-yellow grid h-10 w-10 shrink-0 place-items-center !text-black sm:h-12 sm:w-12" type="button" on:click={() => shiftDay(-1)} aria-label="Giorno precedente">
      <svg class="h-5 w-5 rotate-90 sm:h-6 sm:w-6" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
      </svg>
    </button>

    <button
      class="club-btn min-w-0 px-2 py-2 text-center font-black capitalize sm:px-3"
      type="button"
      on:click={() => dateInput.showPicker()}
      aria-label="Scegli una data"
    >
      <span class="block text-[0.65rem] uppercase tracking-widest text-slate-500 sm:text-xs">Disponibilità</span>
      <span class="mt-1 flex items-center justify-center gap-1 text-sm sm:gap-2 sm:text-xl">
        <span class="truncate">{displayDate()}</span>
        <svg class="h-4 w-4 shrink-0 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 3V6M17 3V6M4 9H20M5 5H19C19.5523 5 20 5.44772 20 6V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V6C4 5.44772 4.44772 5 5 5Z" stroke="currentColor" stroke-width="2" stroke-linecap="square" />
        </svg>
      </span>
      <span class="mt-1 block text-[0.6rem] uppercase tracking-widest text-slate-500 sm:text-[0.65rem]">
        {loading && availability ? 'Aggiornamento...' : 'Cambia data'}
      </span>
      <input
        class="sr-only"
        type="date"
        bind:value={selectedDate}
        bind:this={dateInput}
        on:change={loadAvailability}
      />
    </button>

    <button class="club-btn-yellow grid h-10 w-10 shrink-0 place-items-center !text-black sm:h-12 sm:w-12" type="button" on:click={() => shiftDay(1)} aria-label="Giorno successivo">
      <svg class="h-5 w-5 -rotate-90 sm:h-6 sm:w-6" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
      </svg>
    </button>
  </div>

  {#if availability?.demo}
    <p class="mb-5 border-2 border-black bg-[var(--giallo-club)] p-3 text-sm font-bold">
      Anteprima con dati dimostrativi. Collegando il token OpenResa compariranno le disponibilita reali.
    </p>
  {/if}

  {#if loading && !availability}
    <div class="grid gap-6 md:grid-cols-2" aria-label="Caricamento disponibilita">
      {#each Array.from({ length: 2 }) as _}
        <article class="club-card overflow-hidden">
          <div class="border-b-2 border-black bg-slate-300 p-4">
            <div class="h-3 w-20 animate-pulse bg-slate-400"></div>
            <div class="mt-3 h-7 w-36 animate-pulse bg-slate-400"></div>
          </div>
          <div class="flex flex-col gap-3 p-4">
            {#each Array.from({ length: 6 }) as _}
              <div class="min-h-[4.5rem] animate-pulse border-2 border-slate-300 bg-slate-200"></div>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  {:else if error}
    <p class="club-card p-6 font-bold text-red-700">{error}</p>
  {:else if !availability?.courts.length}
    <p class="club-card p-6 font-bold">Nessun campo disponibile per questa data.</p>
  {:else}
    <div class="grid gap-6 md:grid-cols-2">
      {#each availability.courts as court}
        <article class="club-card overflow-hidden">
          <header
            class={`border-b-2 border-black p-4 text-white md:min-h-[7.25rem] ${
              court.sport === 'padel'
                ? 'bg-[var(--blu-padel)]'
                : court.sport === 'tennis'
                  ? 'bg-[var(--viola-tennis)]'
                  : 'bg-[var(--giallo-club)] !text-black'
            }`}
          >
            <p class="text-xs uppercase tracking-widest opacity-75">{court.sport}</p>
            <h2 class="text-2xl font-black">{court.name}</h2>
            {#if court.surface || court.inoutdoor}
              <p class="mt-1 text-xs font-bold uppercase opacity-80">
                {[court.surface, court.inoutdoor].filter(Boolean).join(' - ')}
              </p>
            {/if}
          </header>

          <div class="flex flex-col gap-3 p-4 md:grid md:auto-rows-[1.25rem] md:gap-0">
            {#if loading}
              {#each skeletonSlots(court.id) as _}
                <div class="min-h-[4.5rem] animate-pulse border-2 border-slate-300 bg-slate-200"></div>
              {/each}
            {:else}
              {#each slotsForCourt(court.id) as slot}
                {#if slot.available}
                  <a
                    class={`flex min-h-[4.5rem] flex-col justify-center border-2 border-black p-3 text-center shadow-[-3px_3px_black] transition hover:translate-x-[-2px] hover:translate-y-[2px] hover:shadow-[-1px_1px_black] md:min-h-0 ${availableSlotClasses(court.sport)}`}
                    style={timelineStyle(slot)}
                    href={availability.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Prenota ${court.name} dalle ${displayTime(slot.start)} alle ${displayTime(slot.end)}`}
                  >
                    <strong class="text-lg">{displayTime(slot.start)}</strong>
                    <span class="text-xs font-extrabold uppercase">Disponibile</span>
                  </a>
                {:else}
                  <div class="flex min-h-[4.5rem] flex-col justify-center border-2 border-black bg-slate-200 p-3 text-center text-slate-500 md:min-h-0" style={timelineStyle(slot)} aria-label={`${court.name} occupato dalle ${displayTime(slot.start)} alle ${displayTime(slot.end)}`}>
                    <strong class="text-lg">{displayTime(slot.start)}</strong>
                    <span class="text-xs font-extrabold uppercase">{unavailableLabel(slot)}</span>
                  </div>
                {/if}
              {/each}
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
