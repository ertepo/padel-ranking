<script lang="ts">
  import { onMount } from 'svelte';
  import { generateSchedule, type ScheduleMatch } from '../../lib/torneo/schedule';
  import { slugify } from '../../lib/torneo/slug';
  import { supabase } from '../../lib/supabase';

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

  interface SavedTournament {
    id: string;
    nome: string;
    created_at: string;
    stato: { phase?: string; playerCount?: number; names?: string[]; matches?: MatchRow[] };
  }

  let phase: 'setup' | 'play' = 'setup';
  let playerCount = 6;
  let names: string[] = Array.from({ length: playerCount }, () => '');
  let matches: MatchRow[] = [];
  let torneoName = '';
  let lastSyncedAt: string | null = null;
  let error = '';
  let hydrated = false;
  let saving = false;
  let saveMessage = '';
  let saveError = '';
  let savedTournaments: SavedTournament[] = [];
  let selectedResumeId = '';
  let resumeError = '';
  let refreshing = false;
  let refreshError = '';

  $: {
    if (names.length < playerCount) {
      names = [...names, ...Array.from({ length: playerCount - names.length }, () => '')];
    } else if (names.length > playerCount) {
      names = names.slice(0, playerCount);
    }
  }

  $: serializedState = JSON.stringify({ phase, playerCount, names, matches, torneoName, lastSyncedAt });

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
          torneoName = typeof saved.torneoName === 'string' ? saved.torneoName : '';
          lastSyncedAt = typeof saved.lastSyncedAt === 'string' ? saved.lastSyncedAt : null;
        }
      }
    } catch {
      // stato salvato non valido: si riparte da un torneo nuovo
    }
    hydrated = true;
    loadSavedTournaments();
    if (phase === 'play' && torneoName) {
      checkForNewerSave();
    }
  });

  // All'apertura/ricarica della pagina, se un altro dispositivo ha salvato
  // una versione più recente di questo stesso torneo, la applica in automatico:
  // così F5 aggiorna davvero, invece di mostrare solo il localStorage locale
  // (che è per-dispositivo e non si sincronizza da solo). Aggiorna solo se il
  // salvataggio trovato è più recente dell'ultimo che questo dispositivo
  // conosce, quindi non cancella mai modifiche locali non ancora salvate.
  async function checkForNewerSave() {
    const { data } = await supabase
      .from('tornei_americani')
      .select('nome, stato, created_at')
      .eq('nome', torneoName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;
    if (lastSyncedAt && new Date(data.created_at) <= new Date(lastSyncedAt)) return;

    const stato = data.stato;
    if (!stato || !Array.isArray(stato.names) || !Array.isArray(stato.matches)) return;

    playerCount = stato.playerCount ?? stato.names.length;
    names = stato.names;
    matches = stato.matches;
    phase = stato.phase === 'play' ? 'play' : 'setup';
    lastSyncedAt = data.created_at;
    saveMessage = 'Aggiornato automaticamente con l\'ultimo salvataggio.';
  }

  async function loadSavedTournaments() {
    const { data, error: fetchError } = await supabase
      .from('tornei_americani')
      .select('id, nome, created_at, stato')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchError || !data) return;

    const seenNames = new Set<string>();
    const list: SavedTournament[] = [];
    for (const row of data as SavedTournament[]) {
      if (!row.nome || seenNames.has(row.nome)) continue;
      seenNames.add(row.nome);
      list.push(row);
    }
    savedTournaments = list;
  }

  function resumeSelected() {
    resumeError = '';
    const row = savedTournaments.find((t) => t.id === selectedResumeId);
    if (!row) {
      resumeError = 'Seleziona un torneo dalla lista.';
      return;
    }
    const stato = row.stato;
    if (!stato || !Array.isArray(stato.names) || !Array.isArray(stato.matches)) {
      resumeError = 'Dati del torneo non validi.';
      return;
    }
    torneoName = row.nome;
    playerCount = stato.playerCount ?? stato.names.length;
    names = stato.names;
    matches = stato.matches as MatchRow[];
    phase = stato.phase === 'play' ? 'play' : 'setup';
    lastSyncedAt = row.created_at;
    error = '';
  }

  $: if (hydrated && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, serializedState);
  }

  async function startTournament() {
    if (!torneoName.trim()) {
      error = 'Dai un nome al torneo.';
      return;
    }
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
    torneoName = torneoName.trim();
    names = trimmed;
    const schedule = generateSchedule(playerCount);
    matches = schedule.map((m: ScheduleMatch) => ({
      ...m,
      scoreA: null,
      scoreB: null,
    }));
    phase = 'play';
    await saveTournament();
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
    average: number;
  }

  $: standings = ((): Standing[] => {
    const rows: Standing[] = names.map((name) => ({ name, points: 0, played: 0, wins: 0, average: 0 }));
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
    for (const row of rows) {
      row.average = row.played > 0 ? row.points / row.played : 0;
    }
    return rows.sort((a, b) => b.average - a.average || b.wins - a.wins);
  })();

  $: matchesCompleted = matches.filter((m) => m.scoreA !== null && m.scoreB !== null).length;

  async function saveTournament() {
    const trimmedName = torneoName.trim();
    if (!trimmedName) {
      saveError = 'Dai un nome al torneo prima di salvare.';
      return;
    }
    torneoName = trimmedName;
    saving = true;
    saveMessage = '';
    saveError = '';
    try {
      const res = await fetch('/api/tornei-americani', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: trimmedName, stato: { phase, playerCount, names, matches } }),
      });
      const data = await res.json();
      if (!res.ok) {
        saveError = data.error || 'Errore nel salvataggio.';
        return;
      }
      saveMessage = 'Torneo salvato.';
      lastSyncedAt = data.created_at;
      await loadSavedTournaments();
    } catch {
      saveError = 'Errore di rete durante il salvataggio.';
    } finally {
      saving = false;
    }
  }

  async function refreshFromDatabase() {
    refreshError = '';
    if (!torneoName.trim()) {
      refreshError = 'Nessun torneo da aggiornare.';
      return;
    }
    if (!confirm('Aggiornare con l\'ultimo salvataggio dal database? Le modifiche fatte qui e non ancora salvate andranno perse.')) {
      return;
    }
    refreshing = true;
    try {
      const { data, error: fetchError } = await supabase
        .from('tornei_americani')
        .select('nome, stato, created_at')
        .eq('nome', torneoName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !data) {
        refreshError = 'Nessun salvataggio trovato per questo torneo.';
        return;
      }
      const stato = data.stato;
      if (!stato || !Array.isArray(stato.names) || !Array.isArray(stato.matches)) {
        refreshError = 'Dati del torneo non validi.';
        return;
      }
      playerCount = stato.playerCount ?? stato.names.length;
      names = stato.names;
      matches = stato.matches;
      phase = stato.phase === 'play' ? 'play' : 'setup';
      lastSyncedAt = data.created_at;
    } catch {
      refreshError = 'Errore di rete durante l\'aggiornamento.';
    } finally {
      refreshing = false;
    }
  }
</script>

{#if phase === 'setup'}
  {#if savedTournaments.length > 0}
    <section class="club-card p-5 md:p-6 mb-6">
      <p class="text-sm uppercase tracking-widest font-black text-slate-600 mb-3">
        Riprendi un torneo salvato
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <select class="border-2 border-black bg-white px-3 py-2 font-black" bind:value={selectedResumeId}>
          <option value="">-- seleziona torneo --</option>
          {#each savedTournaments as t}
            <option value={t.id}>{t.nome} &middot; {new Date(t.created_at).toLocaleDateString('it-IT')}</option>
          {/each}
        </select>
        <button type="button" class="club-btn px-4 py-2" on:click={resumeSelected} disabled={!selectedResumeId}>
          Riprendi
        </button>
      </div>
      {#if resumeError}
        <p class="mt-3 font-black text-[var(--rosso-padel)]">{resumeError}</p>
      {/if}
    </section>
  {/if}

  <section class="club-card p-5 md:p-6">
    <p class="text-sm uppercase tracking-widest font-black text-slate-600 mb-3">
      Nuovo torneo
    </p>

    <div class="mb-5">
      <label for="torneo-name" class="block font-black uppercase text-sm mb-2">
        Nome del torneo
      </label>
      <input
        id="torneo-name"
        type="text"
        placeholder="Es. Americano del venerdì"
        class="w-full border-2 border-black px-3 py-2 font-bold"
        bind:value={torneoName}
      />
      <p class="mt-2 text-xs font-bold text-slate-500">
        Obbligatorio: appena generi il calendario il torneo viene salvato subito su Supabase con questo nome,
        così lo ritrovi nella lista qui sopra anche da un altro dispositivo.
      </p>
    </div>

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
            {torneoName || 'Calendario'}
          </p>
          <h2 class="text-2xl font-black leading-none text-black">
            {matches.length} partite &middot; {matchesCompleted}/{matches.length} giocate
          </h2>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          {#if saveMessage}<span class="text-xs font-bold text-emerald-600">{saveMessage}</span>{/if}
          {#if saveError}<span class="text-xs font-bold text-[var(--rosso-padel)]">{saveError}</span>{/if}
          {#if refreshError}<span class="text-xs font-bold text-[var(--rosso-padel)]">{refreshError}</span>{/if}
          <button type="button" class="club-btn px-4 py-2" on:click={refreshFromDatabase} disabled={refreshing}>
            {refreshing ? 'Aggiornamento...' : 'Aggiorna da database'}
          </button>
          <button type="button" class="club-btn-yellow px-4 py-2" on:click={saveTournament} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva torneo'}
          </button>
          {#if torneoName}
            <a
              href={`/tornei/americani/${slugify(torneoName)}`}
              target="_blank"
              rel="noopener"
              class="club-btn-pastelgreen px-4 py-2"
            >
              Condividi
            </a>
          {/if}
          <button type="button" class="club-btn px-4 py-2" on:click={newTournament}>
            Nuovo torneo
          </button>
        </div>
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
              <th class="py-2 pr-3 text-center">Media</th>
            </tr>
          </thead>
          <tbody>
            {#each standings as row, i}
              <tr class={`border-b border-slate-200 ${i === 0 && row.played > 0 ? 'bg-[var(--giallo-club)]' : ''}`}>
                <td class="py-2 pr-3 font-black text-slate-500">{i + 1}</td>
                <td class="py-2 pr-3 font-black">{row.name}</td>
                <td class="py-2 pr-3 text-center font-bold">{row.played}</td>
                <td class="py-2 pr-3 text-center font-bold">{row.wins}</td>
                <td class="py-2 pr-3 text-center font-bold">{row.points}</td>
                <td class="py-2 pr-3 text-center font-black">{row.average.toFixed(1)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </div>
{/if}
