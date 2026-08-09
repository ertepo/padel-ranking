// Rileva ed elimina le partite del Serronchioland Garros duplicate nel
// campionato padel: lo script `import-tournament-matches.mjs` (commit
// 16f3d53, 08/08) non controllava se le partite fossero già state inserite
// manualmente all'epoca del torneo (via /admin/padel), quindi ha reinserito
// le stesse partite una seconda volta.
//
// Una "duplicata" viene identificata come: un match con
// note LIKE 'Importato da Serronchioland%' (inserito dallo script di ieri)
// per cui esiste un altro match, con gli STESSI 4 giocatori e la STESSA
// coppia vincente, che NON ha quella nota (quindi inserito manualmente
// prima). In quel caso il match "Importato da..." viene considerato il
// duplicato da rimuovere; quello originale resta.
//
// Dopo la rimozione, l'intera classifica padel_rankings viene ricostruita
// da zero rigiocando in ordine cronologico tutte le partite rimaste, con
// la stessa identica logica di /admin/padel.astro (ELO dinamico, regola
// dei primi 3 match a delta fisso +-15). Questo e' necessario perche' gli
// ELO salvati sui match successivi dipendono da quelli precedenti: non si
// possono semplicemente "annullare" i delta della partita duplicata.
// Per coerenza, durante il replay vengono riscritti anche i campi storici
// di ogni match rimasto (team_a_avg_elo, team_b_avg_elo, elo_delta_winner/
// loser, match_type) e di ogni riga match_players (elo_before, elo_after,
// delta), cosi' le pagine di dettaglio match/giocatore restano coerenti.
//
// USO:
//   set -a && source .env && set +a && node scripts/fix-duplicate-serronchioland-matches.mjs
//     -> solo report (default, nessuna scrittura sul DB)
//
//   set -a && source .env && set +a && node scripts/fix-duplicate-serronchioland-matches.mjs --commit
//     -> elimina i match duplicati e ricostruisce la classifica

import { createClient } from '@supabase/supabase-js';
import { calculateEloChange } from '../src/lib/elo.ts';

const COMMIT = process.argv.includes('--commit');

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Mancano PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nell\'ambiente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function pairKey(ids) {
  return [...ids].sort().join('|');
}

async function main() {
  const { data: matches, error: matchesErr } = await supabase
    .from('matches')
    .select('id, created_at, note, winner_team, score')
    .order('created_at', { ascending: true });

  if (matchesErr || !matches) {
    console.error('Errore nel recupero matches', matchesErr);
    process.exit(1);
  }

  const { data: mp, error: mpErr } = await supabase
    .from('match_players')
    .select('id, match_id, player_id, team, result');

  if (mpErr || !mp) {
    console.error('Errore nel recupero match_players', mpErr);
    process.exit(1);
  }

  const { data: players, error: playersErr } = await supabase.from('players').select('id, name');
  if (playersErr || !players) {
    console.error('Errore nel recupero players', playersErr);
    process.exit(1);
  }
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const teamsByMatch = new Map(); // match_id -> { A: [ids], B: [ids] }
  const mpRowsByMatch = new Map(); // match_id -> { A: [row, row], B: [row, row] }
  for (const row of mp) {
    if (!teamsByMatch.has(row.match_id)) teamsByMatch.set(row.match_id, { A: [], B: [] });
    if (!mpRowsByMatch.has(row.match_id)) mpRowsByMatch.set(row.match_id, { A: [], B: [] });
    teamsByMatch.get(row.match_id)[row.team]?.push(row.player_id);
    mpRowsByMatch.get(row.match_id)[row.team]?.push(row);
  }

  // Indicizza tutte le partite NON marcate come import Serronchioland,
  // per firma "4 giocatori + coppia vincente".
  const originalsBySignature = new Map(); // signature -> [match_id, ...]
  for (const m of matches) {
    if (m.note && m.note.startsWith('Importato da Serronchioland')) continue;
    const teams = teamsByMatch.get(m.id);
    if (!teams || teams.A.length !== 2 || teams.B.length !== 2) continue;
    const allFour = pairKey([...teams.A, ...teams.B]);
    const winnerPair = pairKey(m.winner_team === 'A' ? teams.A : teams.B);
    const sig = `${allFour}::${winnerPair}`;
    if (!originalsBySignature.has(sig)) originalsBySignature.set(sig, []);
    originalsBySignature.get(sig).push(m.id);
  }

  const imported = matches.filter((m) => m.note && m.note.startsWith('Importato da Serronchioland'));

  const duplicates = [];
  const noMatchFound = [];
  const ambiguous = [];

  for (const m of imported) {
    const teams = teamsByMatch.get(m.id);
    if (!teams || teams.A.length !== 2 || teams.B.length !== 2) continue;
    const allFour = pairKey([...teams.A, ...teams.B]);
    const winnerPair = pairKey(m.winner_team === 'A' ? teams.A : teams.B);
    const sig = `${allFour}::${winnerPair}`;
    const candidates = originalsBySignature.get(sig) ?? [];

    if (candidates.length === 1) {
      duplicates.push({ importedId: m.id, originalId: candidates[0], sigTeams: teams, note: m.note });
    } else if (candidates.length === 0) {
      noMatchFound.push(m);
    } else {
      ambiguous.push({ m, candidates });
    }
  }

  console.log('\n=== REPORT DUPLICATI SERRONCHIOLAND ===\n');
  console.log(`Match importati (note "Importato da Serronchioland*"): ${imported.length}`);
  console.log(`  - con un originale corrispondente (duplicati certi): ${duplicates.length}`);
  console.log(`  - senza corrispondenza (probabilmente NON duplicati, prima immissione): ${noMatchFound.length}`);
  console.log(`  - ambigui (piu' di un possibile originale, richiede verifica manuale): ${ambiguous.length}\n`);

  for (const d of duplicates) {
    const teamNames = (ids) => ids.map((id) => nameById.get(id) ?? id).join('/');
    console.log(
      `  DUPLICATO  import=${d.importedId}  originale=${d.originalId}  [${teamNames(d.sigTeams.A)} vs ${teamNames(d.sigTeams.B)}]`,
    );
  }

  if (noMatchFound.length) {
    console.log('\n--- Importati SENZA un originale trovato (verranno mantenuti) ---');
    for (const m of noMatchFound) {
      const teams = teamsByMatch.get(m.id);
      const teamNames = (ids) => (ids ?? []).map((id) => nameById.get(id) ?? id).join('/');
      console.log(`  ${m.id}  [${teamNames(teams?.A)} vs ${teamNames(teams?.B)}]  nota="${m.note}"`);
    }
  }

  if (ambiguous.length) {
    console.log('\n--- AMBIGUI: richiedono verifica manuale, nessuna azione automatica ---');
    for (const a of ambiguous) {
      console.log(`  import=${a.m.id}  candidati originali=${a.candidates.join(', ')}`);
    }
  }

  if (!COMMIT) {
    console.log('\nModalità report (default): nessuna scrittura sul DB. Rilancia con --commit per eliminare i duplicati e ricostruire la classifica.\n');
    return;
  }

  if (duplicates.length === 0) {
    console.log('\nNessun duplicato certo da rimuovere. Uscita senza modifiche.\n');
    return;
  }

  const idsToDelete = new Set(duplicates.map((d) => d.importedId));

  console.log(`\nElimino ${idsToDelete.size} match duplicati e i relativi match_players...`);
  for (const id of idsToDelete) {
    await supabase.from('match_players').delete().eq('match_id', id);
    await supabase.from('matches').delete().eq('id', id);
  }

  console.log('Ricostruisco padel_rankings rigiocando la cronologia rimasta...\n');

  const remaining = matches.filter((m) => !idsToDelete.has(m.id)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const state = new Map(players.map((p) => [p.id, { current_elo: 1000, matches_played: 0, wins: 0, losses: 0 }]));

  let matchUpdates = 0;
  let mpUpdates = 0;

  for (const m of remaining) {
    const teams = teamsByMatch.get(m.id);
    const rows = mpRowsByMatch.get(m.id);
    if (!teams || teams.A.length !== 2 || teams.B.length !== 2) continue;

    const [a1, a2] = teams.A;
    const [b1, b2] = teams.B;
    const sA1 = state.get(a1);
    const sA2 = state.get(a2);
    const sB1 = state.get(b1);
    const sB2 = state.get(b2);
    if (!sA1 || !sA2 || !sB1 || !sB2) continue;

    const avgA = (sA1.current_elo + sA2.current_elo) / 2;
    const avgB = (sB1.current_elo + sB2.current_elo) / 2;
    const elo = calculateEloChange(avgA, avgB, m.winner_team);

    const winners = m.winner_team === 'A' ? [sA1, sA2] : [sB1, sB2];
    const losers = m.winner_team === 'A' ? [sB1, sB2] : [sA1, sA2];
    const winnerRows = m.winner_team === 'A' ? rows.A : rows.B;
    const loserRows = m.winner_team === 'A' ? rows.B : rows.A;

    for (let i = 0; i < 2; i++) {
      const p = winners[i];
      const delta = p.matches_played < 3 ? 15 : elo.winnerDelta;
      const eloBefore = p.current_elo;
      p.current_elo += delta;
      p.matches_played += 1;
      p.wins += 1;
      const row = winnerRows[i];
      if (row) {
        await supabase.from('match_players').update({ elo_before: eloBefore, elo_after: p.current_elo, delta }).eq('id', row.id);
        mpUpdates++;
      }
    }
    for (let i = 0; i < 2; i++) {
      const p = losers[i];
      const delta = p.matches_played < 3 ? -15 : elo.loserDelta;
      const eloBefore = p.current_elo;
      p.current_elo += delta;
      p.matches_played += 1;
      p.losses += 1;
      const row = loserRows[i];
      if (row) {
        await supabase.from('match_players').update({ elo_before: eloBefore, elo_after: p.current_elo, delta }).eq('id', row.id);
        mpUpdates++;
      }
    }

    await supabase
      .from('matches')
      .update({
        team_a_avg_elo: avgA,
        team_b_avg_elo: avgB,
        match_type: elo.matchType,
        elo_delta_winner: elo.winnerDelta,
        elo_delta_loser: elo.loserDelta,
      })
      .eq('id', m.id);
    matchUpdates++;
  }

  for (const [playerId, s] of state) {
    await supabase
      .from('padel_rankings')
      .update({
        current_elo: s.current_elo,
        matches_played: s.matches_played,
        wins: s.wins,
        losses: s.losses,
      })
      .eq('player_id', playerId);
  }

  console.log(`Fatto. ${remaining.length} match rigiocati (${matchUpdates} match e ${mpUpdates} righe match_players aggiornate), classifica ricostruita per ${state.size} giocatori.\n`);
}

main();
