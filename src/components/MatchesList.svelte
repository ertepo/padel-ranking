<script>
  import MatchCard from './MatchCard.svelte';

  export let matches = [];
  export let players = [];

  let selectedPlayer = '';

  $: filteredMatches = selectedPlayer
    ? matches.filter((match) =>
        match.match_players.some((mp) =>
          mp.player_id === selectedPlayer
        )
      )
    : matches;
</script>

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
<!--  <pre class="mt-3 text-xs overflow-auto bg-white p-2 border-2 border-black">
  {JSON.stringify(matches[0]?.match_players, null, 2)}
</pre>-->
</div>

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