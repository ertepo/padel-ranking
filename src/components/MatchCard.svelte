<script>
  export let match;

  const teamA = match.match_players.filter((p) => p.team === 'A');
  const teamB = match.match_players.filter((p) => p.team === 'B');

  const winners = match.winner_team === 'A' ? teamA : teamB;

  const teamAName = teamA.map((p) => p.players.name).join(' / ');
  const teamBName = teamB.map((p) => p.players.name).join(' / ');
  const winnersName = winners.map((p) => p.players.name).join(' / ');

  const date = new Date(match.created_at).toLocaleString('it-IT');
</script>

<div class="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-sm">
  <div class="text-sm text-zinc-500 mb-3">
    {date}
  </div>

  <div class="space-y-2 mb-4">
    <div
      class={match.winner_team === 'A'
        ? 'text-green-400 font-bold text-xl'
        : 'text-white font-semibold text-xl'}
    >
      {teamAName}
    </div>

    <div class="text-xs uppercase tracking-wide text-zinc-500">
      vs
    </div>

    <div
      class={match.winner_team === 'B'
        ? 'text-green-400 font-bold text-xl'
        : 'text-white font-semibold text-xl'}
    >
      {teamBName}
    </div>
  </div>

  <div class="text-sm text-zinc-300">
    Vincitori:
    <span class="font-semibold text-white">
      {winnersName}
    </span>
    {#if match.score}
      <div class="mt-3 text-lg font-bold text-zinc-200">
        {match.score}
      </div>
    {/if}
  </div>

  <div class="mt-4 flex flex-wrap gap-2 text-xs">
    <span class="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300">
      {match.match_type}
    </span>

    <span class="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300">
      +{match.elo_delta_winner} / {match.elo_delta_loser}
    </span>

    <span class="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300">
      MEDIA PUNTI A {Math.round(match.team_a_avg_elo)}
    </span>

    <span class="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300">
      MEDIA PUNTI B {Math.round(match.team_b_avg_elo)}
    </span>
  </div>
</div>