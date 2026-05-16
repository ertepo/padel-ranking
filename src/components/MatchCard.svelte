<script>
  export let match;

  // Separiamo i giocatori nei due team mantenendo l'intero oggetto (con il delta dentro)
  const teamA = match.match_players.filter((p) => p.team === 'A');
  const teamB = match.match_players.filter((p) => p.team === 'B');

  // Calcoliamo la differenza assoluta tra le medie ELO dei due team
  const eloDiff = Math.abs(Math.round(match.team_a_avg_elo) - Math.round(match.team_b_avg_elo));

  // Formattiamo la data
  const date = new Date(match.created_at).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Funzione helper per formattare il delta con il segno "+" se positivo
  function formatDelta(delta) {
    return delta > 0 ? `+${delta}` : delta;
  }
</script>

<article class="club-card p-5 md:p-6 relative">
  <!-- INTESTAZIONE CARD -->
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

  <!-- BLOCCO SQUADRE E GIOCATORI -->
  <div class="grid gap-3">
    <!-- TEAM A -->
    <div
      class={match.winner_team === 'A'
        ? 'border-2 border-black bg-[var(--giallo-club)] p-4 font-black text-xl md:text-2xl flex flex-wrap gap-x-2'
        : 'border-2 border-black bg-white p-4 font-bold text-xl md:text-2xl flex flex-wrap gap-x-2'}
    >
      {#each teamA as p, i}
        <span>{p.players.name} ({formatDelta(p.delta)})</span>
        {#if i < teamA.length - 1}<span class="text-slate-400">/</span>{/if}
      {/each}
    </div>

    <!-- DIVISORE VS -->
    <div class="flex items-center gap-3">
      <div class="h-1 bg-black flex-1"></div>
      <span class="bg-black text-white px-3 py-1 font-black text-xs uppercase">
        vs
      </span>
      <div class="h-1 bg-black flex-1"></div>
    </div>

    <!-- TEAM B -->
    <div
      class={match.winner_team === 'B'
        ? 'border-2 border-black bg-[var(--giallo-club)] p-4 font-black text-xl md:text-2xl flex flex-wrap gap-x-2'
        : 'border-2 border-black bg-white p-4 font-bold text-xl md:text-2xl flex flex-wrap gap-x-2'}
    >
      {#each teamB as p, i}
        <span>{p.players.name} ({formatDelta(p.delta)})</span>
        {#if i < teamB.length - 1}<span class="text-slate-400">/</span>{/if}
      {/each}
    </div>
  </div>

  <!-- I TRE BLOCCHI IN BASSO -->
  <div class="mt-5 grid gap-3 md:grid-cols-3">
    
    <!-- 1. RISULTATO (Sostituisce "Vincitori" con sfondo nero) -->
    <div class="bg-black text-white p-3 flex flex-col justify-center">
      <p class="text-xs uppercase font-bold text-slate-400">
        Punteggio
      </p>
      <p class="font-black text-xl mt-0.5">
        {match.score || 'N/D'}
      </p>
    </div>

    <!-- 2. MEDIA ELO (Spostato al centro) -->
    <div class="border-2 border-black bg-white p-3">
      <p class="text-xs uppercase font-bold text-slate-500">
        Media ELO
      </p>
      <p class="font-black text-lg mt-0.5">
        A {Math.round(match.team_a_avg_elo)} · B {Math.round(match.team_b_avg_elo)}
      </p>
    </div>

    <!-- 3. DIFFERENZA ELO (Nuovo blocco a destra) -->
    <div class="border-2 border-black bg-white p-3">
      <p class="text-xs uppercase font-bold text-slate-500">
        Diff. Equilibrio
      </p>
      <p class="font-black text-lg mt-0.5">
        {eloDiff} punti
      </p>
    </div>

  </div>
</article>