<script lang="ts">
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

  const displayDate = () => new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${selectedDate}T12:00:00`));

  const displayTime = (value: string) => value.slice(11, 16);

  const slotsForCourt = (courtId: string) =>
    availability?.slots.filter((slot) => slot.courtId === courtId) || [];

  const unavailableLabel = (slot: Slot) =>
    slot.status === 'closed' || slot.status === 'closed_slot' ? 'Chiuso' : 'Occupato';

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

  loadAvailability();
</script>

<section aria-busy={loading}>
  <div class="mb-7 flex flex-col gap-4 border-2 border-black bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
    <button class="club-btn px-4 py-3" type="button" on:click={() => shiftDay(-1)}>
      Giorno prima
    </button>

    <label class="text-center font-black capitalize">
      <span class="block text-xs uppercase tracking-widest text-slate-500">Giorno selezionato</span>
      <span class="mt-1 block text-xl">{displayDate()}</span>
      <input
        class="mt-2 border-2 border-black bg-white px-3 py-2 text-sm font-bold"
        type="date"
        bind:value={selectedDate}
        on:change={loadAvailability}
      />
    </label>

    <button class="club-btn px-4 py-3" type="button" on:click={() => shiftDay(1)}>
      Giorno dopo
    </button>
  </div>

  {#if availability?.demo}
    <p class="mb-5 border-2 border-black bg-[var(--giallo-club)] p-3 text-sm font-bold">
      Anteprima con dati dimostrativi. Collegando il token OpenResa compariranno le disponibilita reali.
    </p>
  {/if}

  {#if loading}
    <p class="club-card p-6 text-lg font-black">Caricamento disponibilita...</p>
  {:else if error}
    <p class="club-card p-6 font-bold text-red-700">{error}</p>
  {:else if !availability?.courts.length}
    <p class="club-card p-6 font-bold">Nessun campo disponibile per questa data.</p>
  {:else}
    <div class="grid gap-6 md:grid-cols-2">
      {#each availability.courts as court}
        <article class="club-card overflow-hidden">
          <header class:padel={court.sport === 'padel'} class:tennis={court.sport === 'tennis'} class="court-header">
            <p class="text-xs uppercase tracking-widest opacity-75">{court.sport}</p>
            <h2 class="text-2xl font-black">{court.name}</h2>
            {#if court.surface || court.inoutdoor}
              <p class="mt-1 text-xs font-bold uppercase opacity-80">
                {[court.surface, court.inoutdoor].filter(Boolean).join(' - ')}
              </p>
            {/if}
          </header>

          <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            {#each slotsForCourt(court.id) as slot}
              {#if slot.available}
                <a
                  class="slot available"
                  href={availability.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Prenota ${court.name} dalle ${displayTime(slot.start)} alle ${displayTime(slot.end)}`}
                >
                  <strong>{displayTime(slot.start)}</strong>
                  <span>Disponibile</span>
                </a>
              {:else}
                <div class="slot occupied" aria-label={`${court.name} occupato dalle ${displayTime(slot.start)} alle ${displayTime(slot.end)}`}>
                  <strong>{displayTime(slot.start)}</strong>
                  <span>{unavailableLabel(slot)}</span>
                </div>
              {/if}
            {/each}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .court-header {
    border-bottom: 2px solid black;
    background: var(--giallo-club);
    padding: 1rem;
  }

  .court-header.padel {
    background: var(--blu-padel);
    color: white;
  }

  .court-header.tennis {
    background: var(--verde-tennis);
    color: white;
  }

  .slot {
    display: flex;
    min-height: 4.5rem;
    flex-direction: column;
    justify-content: center;
    border: 2px solid black;
    padding: 0.65rem;
    text-align: center;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .slot strong {
    font-size: 1.1rem;
  }

  .slot span {
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .available {
    background: hsl(150, 50%, 82%);
    box-shadow: -3px 3px black;
  }

  .available:hover {
    transform: translate(-2px, 2px);
    background: hsl(150, 50%, 65%);
    box-shadow: -1px 1px black;
  }

  .occupied {
    background: #e2e8f0;
    color: #64748b;
  }
</style>
