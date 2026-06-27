<script>
  export let match;

  const isPadel = Array.isArray(match.match_players);
  const isTennis = Boolean(match.tennisData);
  const siteUrl = 'https://tie-break.it';

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

  function getSurname(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? parts.at(-1) : parts[0] || '';
  }

  function getShareTitle() {
    if (isPadel) {
      const teamAName = teamA.map((p) => getSurname(p.players.name)).join(' / ');
      const teamBName = teamB.map((p) => getSurname(p.players.name)).join(' / ');
      return `Match padel: ${teamAName} vs ${teamBName} - ${match.score || 'N/D'}`;
    }

    if (isTennis) {
      return `Match tennis: ${getSurname(match.tennisData.challenger.name)} vs ${getSurname(match.tennisData.defender.name)} - ${match.score || 'N/D'}`;
    }

    return 'Match Tie-Break';
  }

  function getWhatsappUrl() {
    const shareUrl = `${siteUrl}${getMatchUrl()}`;
    return `https://wa.me/?text=${encodeURIComponent(`${getShareTitle()} ${shareUrl}`)}`;
  }

  function isPadelBestPlayer(playerId) {
    return Boolean(match.best_player_id && playerId === match.best_player_id);
  }

  function isTennisBestPlayer(playerId) {
    return Boolean(match.tennisData?.best_player?.id && playerId === match.tennisData.best_player.id);
  }
</script>

<!-- ========================= -->
<!-- PADEL -->
<!-- ========================= -->

{#if isPadel}

<article class="blue-club-card relative flex h-full flex-col p-5 md:p-6">

  <div class="flex items-start justify-between gap-4 mb-5">
    <div>
      <p class="text-xs uppercase tracking-widest font-bold text-slate-600">
        Match Padel
      </p>

      <p class="text-sm text-slate-600 mt-1">
        {date}
      </p>
    </div>

    <div class={`origin-center rotate-[5deg] px-3 py-1 font-black uppercase text-xs border-2 ${
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
              {#if isPadelBestPlayer(p.player_id)}
                <span class="text-black" title="Best player" aria-label="Best player">★</span>
              {/if}
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
              {#if isPadelBestPlayer(p.player_id)}
                <span class="text-black" title="Best player" aria-label="Best player">★</span>
              {/if}
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
        Differenza ELO
      </p>

      <p class="font-black text-lg">
        {eloDiff} punti
      </p>
    </div>

  </div>

  {#if match.note}
    <div class="mt-5">
      <blockquote class="border-2 border-black bg-white px-3 py-2 font-black">
        "{match.note}"
      </blockquote>
    </div>
  {/if}

  <div class="mt-auto grid grid-cols-2 gap-3 pt-5">
    <a href={getWhatsappUrl()} target="_blank" rel="noreferrer" class="club-btn-blue inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-black">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5"/>
      </svg>
      Condividi match
    </a>

    <a href={getMatchUrl()} class="club-btn inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z"/>
      </svg>
      Apri match
    </a>
  </div>

</article>

{/if}

<!-- ========================= -->
<!-- TENNIS -->
<!-- ========================= -->

{#if isTennis}

<article class="violet-club-card relative flex h-full flex-col p-5 md:p-6">

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

  <div class="grid gap-3">

    <div
      class={match.tennisData.winner.id === match.tennisData.challenger.id
        ? 'border-2 border-black bg-[var(--giallo-club)] px-4 py-3'
        : 'border-2 border-black bg-white px-4 py-3'}
    >
      <div class="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-slate-500">
        <span>Sfidante</span>
        <span class="tracking-normal text-slate-700">
          #{match.tennisData.challenger_old_position}
          →
          #{match.tennisData.challenger_new_position}
        </span>
      </div>

      <a
        href={`/player/${match.tennisData.challenger.id}`}
        class="font-black text-2xl break-words hover:underline"
      >
        {match.tennisData.challenger.name}
        {#if isTennisBestPlayer(match.tennisData.challenger.id)}
          <span class="text-black" title="Best player" aria-label="Best player">★</span>
        {/if}
      </a>
    </div>

    <div class="flex items-center gap-3">
      <div class="h-1 bg-black flex-1"></div>

      <span class="bg-black text-white px-3 py-1 font-black text-xs uppercase">
        vs
      </span>

      <div class="h-1 bg-black flex-1"></div>
    </div>

    <div
      class={match.tennisData.winner.id === match.tennisData.defender.id
        ? 'border-2 border-black bg-[var(--giallo-club)] px-4 py-3'
        : 'border-2 border-black bg-white px-4 py-3'}
    >
      <div class="mb-2 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-slate-500">
        <span>Sfidato</span>
        <span class="tracking-normal text-slate-700">
          #{match.tennisData.defender_old_position}
          →
          #{match.tennisData.defender_new_position}
        </span>
      </div>

      <a
        href={`/player/${match.tennisData.defender.id}`}
        class="font-black text-2xl break-words hover:underline"
      >
        {match.tennisData.defender.name}
        {#if isTennisBestPlayer(match.tennisData.defender.id)}
          <span class="text-black" title="Best player" aria-label="Best player">★</span>
        {/if}
      </a>
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

  {#if match.note}
    <div class="mt-5">
      <blockquote class="border-2 border-black bg-white px-3 py-2 font-black">
        "{match.note}"
      </blockquote>
    </div>
  {/if}

  <div class="mt-auto grid grid-cols-2 gap-3 pt-5">
    <a href={getWhatsappUrl()} target="_blank" rel="noreferrer" class="club-btn-blue inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-black">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.5 2.5 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5"/>
      </svg>
      Condividi match
    </a>

    <a href={getMatchUrl()} class="club-btn inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z"/>
      </svg>
      Apri match
    </a>
  </div>

</article>

{/if}
