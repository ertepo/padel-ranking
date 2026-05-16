<script>
  import { supabase } from '../lib/supabase';
  import MatchCard from './MatchCard.svelte';

  // Riceviamo i dati iniziali da Astro
  export let initialMatches = [];
  export let players = []; // Ora viene usato correttamente per il filtro!

  // Stato locale reattivo per gestire i match totali accumulati
  let matches = [...initialMatches];
  let selectedPlayer = '';
  let loading = false;
  let hasMore = true;
  
  const ITEMS_PER_PAGE = 20; // Quanti match caricare a ogni click

  // Funzione per caricare altri match da Supabase lato client
  async function loadMoreMatches() {
    if (loading || !hasMore) return;
    loading = true;

    const from = matches.length;
    const to = from + ITEMS_PER_PAGE - 1;

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          created_at,
          winner_team,
          score,
          team_a_avg_elo,
          team_b_avg_elo,
          match_type,
          match_players (
            id,
            player_id,
            team,
            result,
            delta,
            players (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data && data.length > 0) {
        matches = [...matches, ...data];
        if (data.length < ITEMS_PER_PAGE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error("Errore nel caricamento dei match:", err.message);
    } finally {
      loading = false;
    }
  }

  // Il tuo filtro reattivo originale (ora lavora sull'array 'matches' che cresce dinamico)
  $: filteredMatches = selectedPlayer
    ? matches.filter((match) =>
        match.match_players.some((mp) =>
          mp.player_id === selectedPlayer
        )
      )
    : matches;
</script>

<!-- BLOCCO FILTRO (ORIGINALE) -->
<div class="club-card p-5 mb-6 bg-[var(--giallo-club)]">
  <label class="block font-black text-xl mb-3">
    Filtra per giocatore
  </label>

  <select
    bind:value={selectedPlayer}
    class="w-full border-2 border-black bg-white p-3 font-bold"
  >
    <option value="">Tutti i giocatori</option>
    {#each players as player}
      <option value={player.id}>
        {player.name}
      </option>
    {/each}
  </select>

  <p class="mt-3 text-sm font-bold">
    Selezionato: {selectedPlayer || 'nessuno'} · Match visibili: {filteredMatches.length}
  </p>
</div>

<!-- LISTA DEI MATCH (CON MATCHCARD) -->
{#if filteredMatches.length === 0}
  <div class="club-card p-5">
    <p class="font-black">Nessun match trovato.</p>
  </div>
{:else}
  <div class="space-y-5">
    {#each filteredMatches as match}
      <MatchCard {match} />
    {/each}
  </div>
{/if}

<!-- PULSANTE CARICA ALTRI (STILE CLUB) -->
<div class="mt-8 flex justify-center mb-12">
  {#if hasMore}
    <button 
      on:click={loadMoreMatches} 
      disabled={loading}
      class="club-btn px-6 py-4 text-xl w-full max-w-md disabled:opacity-50"
    >
      {#if loading}
        Caricamento in corso...
      {:else}
        Carica Altri Match
      {/if}
    </button>
  {:else}
    <p class="text-slate-500 font-bold italic text-sm bg-slate-100 px-4 py-2 border border-slate-300 rounded">
      Finito lo storico! Non ci sono altre partite.
    </p>
  {/if}
</div>