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
  
  const ITEMS_PER_SPORT = 10;

  function formatTennisMatch(match) {
    return {
      id: `tennis-${match.id}`,
      created_at: match.created_at,
      score: match.score,

      tennisData: {
        challenger: match.challenger,
        defender: match.defender,
        winner: match.winner,
        challenger_old_position:
          match.challenger_old_position,
        challenger_new_position:
          match.challenger_new_position,
        defender_old_position:
          match.defender_old_position,
        defender_new_position:
          match.defender_new_position,
        challengerWon:
          match.winner_id === match.challenger_id
      }
    };
  }

  // Funzione per caricare altri match da Supabase lato client
  async function loadMoreMatches() {
    if (loading || !hasMore) return;
    loading = true;

    const oldestMatch = [...matches].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    )[0];

    const oldestDate = oldestMatch?.created_at;

    try {
      let padelQuery = supabase
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
        .range(0, ITEMS_PER_SPORT - 1);

      let tennisQuery = supabase
        .from('tennis_matches')
        .select(`
          id,
          created_at,
          score,
          challenger_id,
          defender_id,
          winner_id,
          challenger_old_position,
          challenger_new_position,
          defender_old_position,
          defender_new_position,
          challenger:players!tennis_matches_challenger_id_fkey (
            id,
            name
          ),
          defender:players!tennis_matches_defender_id_fkey (
            id,
            name
          ),
          winner:players!tennis_matches_winner_id_fkey (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .range(0, ITEMS_PER_SPORT - 1);

      if (oldestDate) {
        padelQuery = padelQuery.lt('created_at', oldestDate);
        tennisQuery = tennisQuery.lt('created_at', oldestDate);
      }

      const [
        padelResponse,
        tennisResponse
      ] = await Promise.all([
        padelQuery,
        tennisQuery
      ]);

      if (padelResponse.error) throw padelResponse.error;
      if (tennisResponse.error) throw tennisResponse.error;

      const nextMatches = [
        ...(padelResponse.data || []),
        ...(tennisResponse.data || []).map(formatTennisMatch)
      ].sort((a, b) => (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      ));

      if (nextMatches.length > 0) {
        matches = [...matches, ...nextMatches];
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
      if (Array.isArray(match.match_players)) {
        return match.match_players.some(
          (mp) => mp.player_id === selectedPlayer
        );
      }

      // TENNIS
      if (match.tennisData) {
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
