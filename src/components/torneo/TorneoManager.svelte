<script lang="ts">
  import { onMount } from 'svelte';
  import { generateSchedule, type ScheduleMatch } from '../../lib/torneo/schedule';

  const STORAGE_KEY = 'torneo-padel-state';
  const MIN_PLAYERS = 4;
  const MAX_PLAYERS = 12;

  interface MatchRow {
    teamA: [number, number];
    teamB: [number, number];
    sitOut: number[];
    scoreA: number | null;
    scoreB: number | null;
  }

  let phase: 'setup' | 'play' = 'setup';
  let playerCount = 6;
  let names: string[] = Array.from({ length: playerCount }, () => '');
  let matches: MatchRow[] = [];
  let error = '';
  let hydrated = false;

  $: {
    if (names.length < playerCount) {
      names = [...names, ...Array.from({ length: playerCount - names.length }, () => '')];
    } else if (names.length > playerCount) {
      names = names.slice(0, playerCount);
    }
  }

  $: serializedState = JSON.stringify({ phase, playerCount, names, matches });

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.names) && Array.isArray(saved.matches)) {
          phase = saved.phase === 'play' ? 'play' : 'setup';
          playerCount = saved.playerCount ?? saved.names.length;
          names = saved.names;
          matches = saved.matches;
        }
      }
    } catch {
      // stato salvato non valido: si riparte da un torneo nuovo
    }
    hydrated = true;
  });

  $: if (hydrated && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, serializedState);
  }

  function startTournament() {
    const trimmed = names.map((n) => n.trim());
    if (trimmed.some((n) => !n)) {
      error = 'Inserisci il nome di tutti i giocatori.';
      return;
    }
    const lower = trimmed.map((n) => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      error = 'I nomi dei giocatori devono essere diversi tra loro.';
      return;
    }

    error = '';
    names = trimmed;
    const schedule = generateSchedule(playerCount);
    matches = schedule.map((m: ScheduleMatch) => ({
      ...m,
      scoreA: null,
      scoreB: null,
    }));
    phase = 'play';
  }

  function newTournament() {
    if (!confirm('Vuoi davvero iniziare un nuovo torneo? La classifica attuale andrà persa.')) return;
    phase = 'setup';
    matches = [];
    error = '';
  }

  function teamLabel(team: [number, number]) {
    return `${names[team[0]]} / ${names[team[1]]}`;
  }

  interface Standing {
    name: string;
    points: number;
    played: number;
    wins: number;
  }

  $: standings = ((): Standing[] => {
    const rows: Standing[] = names.map((name) => ({ name, points: 0, played: 0, wins: 0 }));
    for (const m of matches) {
      if (m.scoreA === null || m.scoreB === null) continue;
      for (const idx of m.teamA) {
        rows[idx].points += m.scoreA;
        rows[idx].played += 1;
        if (m.scoreA > m.scoreB) rows[idx].wins += 1;
      }
      for (const idx of m.teamB) {
        rows[idx].points += m.scoreB;
        rows[idx].played += 1;
        if (m.scoreB > m.scoreA) rows[idx].wins += 1;
      }
    }
    return rows.sort((a, b) => b.points - a.points || b.wins - a.wins);
  })();

  $: matchesCompleted = matches.filter((m) => m.scoreA !== null && m.scoreB !== null).length;
</script>

{#if phase === 'setup'}
  <section class="club-card p-5 md:p-6">
    <p class="text-sm uppercase tracking-widest font-black text-slate-600 mb-3">
      Nuovo torneo
    </p>

    <div class="mb-5">
      <label for="player-count" class="block font-black uppercase text-sm mb-2">
        Numero di giocatori
      </label>
      <select
        id="player-count"
        class="border-2 border-black bg-white px-3 py-2 font-black"
        bind:value={playerCount}
      >
        {#each Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS) as n}
          <option value={n}>{n}</option>
        {/each}
      </select>
      <p class="mt-2 text-xs font-bold text-slate-500">
        Con un solo campo, ogni partita scendono in 4 e {playerCount - 4 > 0 ? `${playerCount - 4} ${playerCount - 4 === 1 ? 'riposa' : 'riposano'}` : 'nessuno riposa'}.
        Il calendario copre tutte le coppie possibili nel minor numero di partite.
      </p>
    </div>

    <div class="mb-5">
      <p class="font-black uppercase text-sm mb-2">Nomi dei giocatori</p>
      <div class="grid gap-3 sm:grid-cols-2">
        {#each names as _, i}
          <input
            type="text"
            placeholder={`Giocatore ${i + 1}`}
            class="border-2 border-black px-3 py-2 font-bold"
            bind:value={names[i]}
          />
        {/each}
      </div>
    </div>

    {#if error}
      <p class="mb-4 font-black text-[var(--rosso-padel)]">{error}</p>
    {/if}

    <button type="button" class="club-btn-yellow px-6 py-3 font-black uppercase tracking-widest" on:click={startTournament}>
      Genera calendario
    </button>
  </section>
{:else}
  <div class="flex flex-col gap-8">
    <section class="club-card p-5 md:p-6">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm uppercase tracking-widest font-black text-slate-600 mb-1">
            Calendario
          </p>
          <h2 class="text-2xl font-black leading-none text-black">
            {matches.length} partite &middot; {matchesCompleted}/{matches.length} giocate
          </h2>
        </div>
        <button type="button" class="club-btn px-4 py-2" on:click={newTournament}>
          Nuovo torneo
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[36rem] border-collapse">
          <thead>
            <tr class="border-b-2 border-black text-left text-xs uppercase font-black text-slate-600">
              <th class="py-2 pr-3">#</th>
              <th class="py-2 pr-3">Coppia 1</th>
              <th class="py-2 pr-3 text-center">Punti</th>
              <th class="py-2 pr-3 text-center">Punti</th>
              <th class="py-2 pr-3">Coppia 2</th>
              <th class="py-2 pr-3">Riposano</th>
            </tr>
          </thead>
          <tbody>
            {#each matches as match, i}
              <tr class="border-b border-slate-200">
                <td class="py-2 pr-3 font-black text-slate-500">{i + 1}</td>
                <td class="py-2 pr-3 font-black">{teamLabel(match.teamA)}</td>
                <td class="py-2 pr-3 text-center">
                  <input
                    type="number"
                    min="0"
                    inputmode="numeric"
                    class="w-16 border-2 border-black px-2 py-1 text-center font-black"
                    bind:value={match.scoreA}
                  />
                </td>
                <td class="py-2 pr-3 text-center">
                  <input
                    type="number"
                    min="0"
                    inputmode="numeric"
                    class="w-16 border-2 border-black px-2 py-1 text-center font-black"
                    bind:value={match.scoreB}
                  />
                </td>
                <td class="py-2 pr-3 font-black">{teamLabel(match.teamB)}</td>
                <td class="py-2 pr-3 text-xs font-bold text-slate-500">
                  {match.sitOut.map((idx) => names[idx]).join(', ') || '-'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="club-card p-5 md:p-6">
      <p class="text-sm uppercase tracking-widest font-black text-slate-600 mb-3">
        Classifica
      </p>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[24rem] border-collapse">
          <thead>
            <tr class="border-b-2 border-black text-left text-xs uppercase font-black text-slate-600">
              <th class="py-2 pr-3">#</th>
              <th class="py-2 pr-3">Giocatore</th>
              <th class="py-2 pr-3 text-center">Partite</th>
              <th class="py-2 pr-3 text-center">Vinte</th>
              <th class="py-2 pr-3 text-center">Punti</th>
            </tr>
          </thead>
          <tbody>
            {#each standings as row, i}
              <tr class={`border-b border-slate-200 ${i === 0 && row.played > 0 ? 'bg-[var(--giallo-club)]' : ''}`}>
                <td class="py-2 pr-3 font-black text-slate-500">{i + 1}</td>
                <td class="py-2 pr-3 font-black">{row.name}</td>
                <td class="py-2 pr-3 text-center font-bold">{row.played}</td>
                <td class="py-2 pr-3 text-center font-bold">{row.wins}</td>
                <td class="py-2 pr-3 text-center font-black">{row.points}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </div>
{/if}
