<script>
  export let match;

  const isPadel = Array.isArray(match.match_players);
  const isTennis = Boolean(match.tennisData);

  // =========================
  // PADEL
  // =========================

  let teamA = [];
  let teamB = [];
  let eloDiff = 0;

  if (isPadel) {
    teamA = match.match_players.filter((p) => p.team === 'A');
    teamB = match.match_players.filter((p) => p.team === 'B');

    eloDiff = Math.abs(
      Math.round(match.team_a_avg_elo) -
      Math.round(match.team_b_avg_elo)
    );
  }

  // =========================
  // DATA
  // =========================

  const date = new Date(match.created_at).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  function formatDelta(delta) {
    return delta > 0 ? `+${delta}` : delta;
  }

  function getMatchUrl() {
    if (isPadel) return `/match/padel/${match.id}`;
    if (isTennis) return `/match/tennis/${String(match.id).replace('tennis-', '')}`;
    return '/matches';
  }
</script>

<!-- ========================= -->
<!-- PADEL -->
<!-- ========================= -->

{#if isPadel}

<article class="club-card p-5 md:p-6 relative">

  <div class="flex items-start justify-between gap-4 mb-5">
    <div>
      <p class="text-xs uppercase tracking-widest font-bold text-slate-600">
        Match Padel
      </p>

      <p class="text-sm text-slate-600 mt-1">
        {date}
      </p>
    </div>

    <div class={`px-3 py-1 font-black uppercase text-xs border-2 ${
      {
        expected: 'bg-white text-black border-black',
        balanced: 'bg-[var(--blu-bilanciato)] text-slate-100 border-black',
        upset: 'bg-[var(--giallo-club)] text-black border-black border-dashed'
      }[match.match_type?.toLowerCase()] || 'bg-slate-200 text-slate-700'
    }`}>
      {match.match_type}
    </div>
  </div>

  <div class="grid gap-3">

    <div
      class={match.winner_team === 'A'
        ? 'border-2 border-black bg-[var(--giallo-club)] px-4 py-3 font-black text-xl md:text-2xl flex flex-wrap gap-x-2'
        : 'border-2 border-black bg-white px-4 py-3 font-bold text-xl md:text-2xl flex flex-wrap gap-x-2'}
    >
      {#each teamA as p, i}
        <span><a href={`/player/${p.player_id}`} class="font-black text-2xl break-words hover:underline">
              {p.players.name}
              </a> ({formatDelta(p.delta)})</span>
        {#if i < teamA.length - 1}
          <span class="text-slate-400">/</span>
        {/if}
      {/each}
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
        ? 'border-2 border-black bg-[var(--giallo-club)] px-4 py-3 font-black text-xl md:text-2xl flex flex-wrap gap-x-2'
        : 'border-2 border-black bg-white px-4 py-3 font-bold text-xl md:text-2xl flex flex-wrap gap-x-2'}
    >
      {#each teamB as p, i}
        <span><a href={`/player/${p.player_id}`} class="font-black text-2xl break-words hover:underline">
              {p.players.name}
              </a> ({formatDelta(p.delta)})</span>

        {#if i < teamB.length - 1}
          <span class="text-slate-400">/</span>
        {/if}
      {/each}
    </div>

  </div>

  <div class="mt-5 grid gap-3 md:grid-cols-3">

    <div class="bg-black text-white px-3 py-2">
      <p class="text-xs uppercase font-bold text-slate-400">
        Punteggio
      </p>

      <p class="font-black text-xl">
        {match.score || 'N/D'}
      </p>
    </div>

    <div class="border-2 border-black bg-white px-3 py-2">
      <p class="text-xs uppercase font-bold text-slate-500">
        Media ELO
      </p>

      <p class="font-black text-lg">
        A {Math.round(match.team_a_avg_elo)} · B {Math.round(match.team_b_avg_elo)}
      </p>
    </div>

    <div class="border-2 border-black bg-white px-3 py-2">
      <p class="text-xs uppercase font-bold text-slate-500">
        Diff. Equilibrio
      </p>

      <p class="font-black text-lg">
        {eloDiff} punti
      </p>
    </div>

  </div>

  {#if match.note || match.best_player}
    <div class="mt-5 grid gap-3 md:grid-cols-2">
      {#if match.best_player}
        <div class="border-2 border-black bg-[var(--giallo-club)] px-3 py-2">
          <p class="text-xs uppercase font-bold text-black opacity-60">
            Best player
          </p>
          <p class="font-black text-xl">
            {match.best_player.name}
          </p>
        </div>
      {/if}

      {#if match.note}
        <blockquote class="border-2 border-black bg-white px-3 py-2 font-black">
          "{match.note}"
        </blockquote>
      {/if}
    </div>
  {/if}

  <div class="mt-5 flex justify-end">
    <a href={getMatchUrl()} class="club-btn px-4 py-2">
      Apri match
    </a>
  </div>

</article>

{/if}

<!-- ========================= -->
<!-- TENNIS -->
<!-- ========================= -->

{#if isTennis}

<article class="club-card p-5 md:p-6 relative">

  <div class="flex items-start justify-between gap-4 mb-5">

    <div>
      <p class="text-xs uppercase tracking-widest font-bold text-slate-600">
        Match Tennis
      </p>

      <p class="text-sm text-slate-600 mt-1">
        {date}
      </p>
    </div>

    <div class="px-3 py-1 font-black uppercase text-xs border-2 border-black bg-[var(--giallo-club)]">
      SFIDA TENNIS
    </div>

  </div>

  <div class="mt-5 grid gap-3 md:grid-cols-[4fr_1fr_4fr]">

     <div class="border-2 border-black bg-white p-4 min-w-0">

      <div class="text-sm uppercase font-bold text-slate-500 mb-2">
        Sfidante
      </div>

      <div class="font-black text-2xl break-words">
       <a
  href={`/player/${match.tennisData.challenger.id}`}
  class="font-black text-2xl break-words hover:underline"
>
  {match.tennisData.challenger.name}
</a>
      </div>

      <div class="text-sm font-bold mt-2">
        #{match.tennisData.challenger_old_position}
        →
        #{match.tennisData.challenger_new_position}
      </div>

    </div>

    <div class="flex items-center gap-3  md:max-w-1/6 ">
      <div class="h-1 bg-black flex-1 md:hidden"></div>

      <span class="bg-black text-white px-3 py-1 font-black text-xs uppercase">
        vs
      </span>

      <div class="h-1 bg-black flex-1  md:hidden"></div>
    </div>

    <div class="border-2 border-black bg-white p-4 min-w-0">

      <div class="text-sm uppercase font-bold text-slate-500 mb-2">
        Sfidato
      </div>

      <div class="font-black text-2xl break-words">
        <a
  href={`/player/${match.tennisData.defender.id}`}
  class="font-black text-2xl break-words hover:underline"
>
  {match.tennisData.defender.name}
</a>
      </div>

      <div class="text-sm font-bold mt-2">
        #{match.tennisData.defender_old_position}
        →
        #{match.tennisData.defender_new_position}
      </div>

    </div>

  </div>

  <div class="mt-5 grid gap-3 md:grid-cols-2">

    <div class="bg-black text-white px-3 py-2">
      <p class="text-xs uppercase font-bold text-slate-400">
        Punteggio
      </p>

      <p class="font-black text-xl">
        {match.score || 'N/D'}
      </p>
    </div>

    <div class="border-2 border-black bg-[var(--giallo-club)] px-3 py-2">
      <p class="text-xs uppercase font-bold text-black opacity-60">
        Vincitore
      </p>

      <p class="font-black text-xl">
        {match.tennisData.winner.name}
      </p>
    </div>

  </div>

  {#if match.note || match.tennisData.best_player}
    <div class="mt-5 grid gap-3 md:grid-cols-2">
      {#if match.tennisData.best_player}
        <div class="border-2 border-black bg-[var(--giallo-club)] px-3 py-2">
          <p class="text-xs uppercase font-bold text-black opacity-60">
            Best player
          </p>
          <p class="font-black text-xl">
            {match.tennisData.best_player.name}
          </p>
        </div>
      {/if}

      {#if match.note}
        <blockquote class="border-2 border-black bg-white px-3 py-2 font-black">
          "{match.note}"
        </blockquote>
      {/if}
    </div>
  {/if}

  <div class="mt-5 flex justify-end">
    <a href={getMatchUrl()} class="club-btn px-4 py-2">
      Apri match
    </a>
  </div>

</article>

{/if}
