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

<article class="club-card p-5 md:p-6 relative">
  <div class="flex items-start justify-between gap-4 mb-5">
    <div>
      <p class="text-xs uppercase tracking-widest font-bold text-slate-600">
        Match ranking
      </p>

      <p class="text-sm text-slate-600 mt-1">
        {date}
      </p>
    </div>

    <div class="bg-[var(--giallo-club)] border-2 border-black px-3 py-1 font-black uppercase text-xs">
      {match.match_type}
    </div>
  </div>

  <div class="grid gap-3">
    <div
      class={match.winner_team === 'A'
        ? 'border-2 border-black bg-[var(--giallo-club)] p-4 font-black text-xl md:text-2xl'
        : 'border-2 border-black bg-white p-4 font-bold text-xl md:text-2xl'}
    >
      {teamAName}
    </div>

    <div class="flex items-center gap-3">
      <div class="h-1 bg-black flex-1"></div>
      <span class="bg-black text-white px-3 py-1 font-black text-xs uppercase">
        vs
      </span>
      <div class="h-1 bg-black flex-1"></div>
    </div>

    <div
      class={match.winner_team === 'B'
        ? 'border-2 border-black bg-[var(--giallo-club)] p-4 font-black text-xl md:text-2xl'
        : 'border-2 border-black bg-white p-4 font-bold text-xl md:text-2xl'}
    >
      {teamBName}
    </div>
  </div>

  {#if match.score}
    <div class="mt-5 bg-black text-white inline-block px-4 py-2 font-black text-lg">
      {match.score}
    </div>
  {/if}

  <div class="mt-5 grid gap-3 md:grid-cols-3">
    <div class="border-2 border-black bg-white p-3">
      <p class="text-xs uppercase font-bold text-slate-500">
        Vincitori
      </p>
      <p class="font-black">
        {winnersName}
      </p>
    </div>

    <div class="border-2 border-black bg-white p-3">
      <p class="text-xs uppercase font-bold text-slate-500">
        Delta ELO
      </p>
      <p class="font-black">
        +{match.elo_delta_winner} / {match.elo_delta_loser}
      </p>
    </div>

    <div class="border-2 border-black bg-white p-3">
      <p class="text-xs uppercase font-bold text-slate-500">
        Media ELO
      </p>
      <p class="font-black">
        A {Math.round(match.team_a_avg_elo)} · B {Math.round(match.team_b_avg_elo)}
      </p>
    </div>
  </div>
</article>