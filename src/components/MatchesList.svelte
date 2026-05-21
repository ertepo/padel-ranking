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
  ? matches.filter((match) => {

      // PADEL
      if (match.sport === 'padel') {
        return match.match_players.some(
          (mp) => mp.player_id === selectedPlayer
        );
      }

      // TENNIS
      if (match.sport === 'tennis') {
        return (
          match.tennisData.challenger.id === selectedPlayer ||
          match.tennisData.defender.id === selectedPlayer
        );
      }

      return false;
    })
  : matches;
</script>

<!-- BLOCCO FILTRO CORRETTO -->
<div class="club-card p-5 mb-6 bg-[var(--giallo-club)]">
  <!-- Aggiunto l'attributo for -->
  <label for="player-filter" class="block font-black text-xl mb-3">
    Filtra per giocatore
  </label>

  <!-- Aggiunto l'id "player-filter" -->
  <select
    id="player-filter"
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

<!-- LISTA DEI MATCH CORRETTA -->
{#if filteredMatches.length === 0}
  <div class="club-card p-5">
    <p class="font-black">Nessun match trovato.</p>
  </div>
{:else}
  <div class="mt-5 grid gap-3 md:grid-cols-2 space-y-5">
    <!-- MODIFICATO QUI: da matches a filteredMatches -->
    {#each filteredMatches as match (match.id)}
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