// Importa in blocco le partite di Cordivinbledon e Serronchioland Garros
// nel campionato padel (tabelle matches / match_players / padel_rankings),
// replicando esattamente la logica di src/pages/admin/padel.astro (stesso
// calcolo ELO, stessa regola dei primi 3 match a delta fisso ±15).
//
// USO:
//   set -a && source .env && set +a && node scripts/import-tournament-matches.mjs
//     -> solo report (default, nessuna scrittura sul DB)
//
//   set -a && source .env && set +a && node scripts/import-tournament-matches.mjs --commit
//     -> inserisce davvero i match risolti (salta quelli bloccati/senza vincitore)
//
// Il mapping "alias torneo -> giocatore DB" va confermato/completato in
// PLAYER_ALIASES prima di lanciare con --commit: se un alias è a `null`, lo
// script cerca automaticamente candidati per cognome nella tabella players
// e segnala MISSING (0 candidati) o AMBIGUOUS (2+ candidati).

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

// -----------------------------------------------------------------------
// Alias torneo -> nome esatto in players.name. `null` = da risolvere: lo
// script cerca automaticamente per cognome e riporta i candidati trovati.
// -----------------------------------------------------------------------
const PLAYER_ALIASES = {
  Oncini: 'Alessandro Oncini',
  Giovagnoni: 'Mauro Giovagnoni',
  Ciucci: 'Yuri Ciucci',
  Virgili: 'Mirko Virgili',
  'Nocelli D.': 'Daniele Nocelli',
  'Nocelli E.': 'Edoardo Nocelli',
  David: 'Filippo David',
  Scaloni: 'Giorgio Scaloni',
  Gagliardini: 'Gianluca Gagliardini',
  Romaldi: 'Riccardo Romaldi',
  Moreschini: 'Manolo Moreschini',
  Cirillo: 'Domenico Cirillo',
  Brega: 'Mauro Brega',
  Tassi: 'Andrea Tassi',
  Nitrati: 'Nitrati',
  Frontalini: 'Frontalini',
  Antonelli: 'Davide Antonelli',

  // Non ancora nel DB (0 giocatori con questo cognome) - solo in Cordivinbledon.
  // L'utente li sta creando manualmente: restano `null` (auto-risolti per
  // cognome, con match esatto sulla singola parola - vedi resolveAliases).
  Perini: null,
  Gigli: null,
  Corallini: null,
  Giorgi: null,
  Carotti: null,

  // Confermato dall'utente: è Fabrizio Piersigilli (non Paolo).
  Piersigilli: 'Fabrizio Piersigilli',
};

// -----------------------------------------------------------------------
// Tutte le partite dei due tornei, in ordine cronologico presunto
// (Serronchioland 01-05 luglio, poi Cordivinbledon 27-31 luglio; dentro
// ogni torneo: gironi nell'ordine della pagina, poi semifinali, poi finale).
// winner: 'A' | 'B' | null (null = non giocata / vincitore ignoto -> esclusa)
// flag: motivo per cui il match va confermato prima di essere importato.
// -----------------------------------------------------------------------
const MATCHES = [
  // ===== SERRONCHIOLAND GARROS =====
  { t: 'Serronchioland', phase: 'Girone A', teamA: ['Brega', 'Tassi'], teamB: ['Virgili', 'Nocelli D.'], score: '1-4 2-4', winner: 'B' },
  { t: 'Serronchioland', phase: 'Girone A', teamA: ['Scaloni', 'David'], teamB: ['Brega', 'Tassi'], score: '2-4 1-4', winner: 'B' },
  { t: 'Serronchioland', phase: 'Girone A', teamA: ['Virgili', 'Nocelli D.'], teamB: ['Scaloni', 'David'], score: '4-1 2-4 10-12', winner: 'B' },
  { t: 'Serronchioland', phase: 'Girone A', teamA: ['Oncini', 'Nocelli E.'], teamB: ['Scaloni', 'David'], score: '0-4 4-5(10)', winner: 'B' },
  { t: 'Serronchioland', phase: 'Girone A', teamA: ['Virgili', 'Nocelli D.'], teamB: ['Oncini', 'Nocelli E.'], score: '4-0 4-2', winner: 'A' },
  { t: 'Serronchioland', phase: 'Girone A', teamA: ['Oncini', 'Nocelli E.'], teamB: ['Brega', 'Tassi'], score: '0-4 1-4', winner: 'B' },

  { t: 'Serronchioland', phase: 'Girone B', teamA: ['Antonelli', 'Piersigilli'], teamB: ['Nitrati', 'Frontalini'], score: '4-1 4-0', winner: 'A' },
  { t: 'Serronchioland', phase: 'Girone B', teamA: ['Moreschini', 'Cirillo'], teamB: ['Antonelli', 'Piersigilli'], score: '4-2 5-3', winner: 'A' },
  { t: 'Serronchioland', phase: 'Girone B', teamA: ['Nitrati', 'Frontalini'], teamB: ['Moreschini', 'Cirillo'], score: '0-4 2-4', winner: 'B' },
  { t: 'Serronchioland', phase: 'Girone B', teamA: ['Gagliardini', 'Romaldi'], teamB: ['Moreschini', 'Cirillo'], score: '2-4 1-4', winner: 'B' },
  {
    // Confermato dall'utente: vince Gagliardini/Romaldi (nel sorgente il
    // vincitore registrato era incoerente, indicava Moreschini/Cirillo che
    // non gioca questo match).
    t: 'Serronchioland', phase: 'Girone B', teamA: ['Nitrati', 'Frontalini'], teamB: ['Gagliardini', 'Romaldi'], score: '2-4 1-4', winner: 'B',
  },
  { t: 'Serronchioland', phase: 'Girone B', teamA: ['Gagliardini', 'Romaldi'], teamB: ['Antonelli', 'Piersigilli'], score: '2-4 4-5(7-10)', winner: 'B' },

  { t: 'Serronchioland', phase: 'Semifinale GOLD', teamA: ['Moreschini', 'Cirillo'], teamB: ['Brega', 'Tassi'], score: '6-4 2-6 10-7', winner: 'A' },
  { t: 'Serronchioland', phase: 'Semifinale GOLD', teamA: ['Virgili', 'Nocelli D.'], teamB: ['Antonelli', 'Piersigilli'], score: '7-6 6-4', winner: 'A' },
  { t: 'Serronchioland', phase: 'Finale GOLD', teamA: ['Moreschini', 'Cirillo'], teamB: ['Virgili', 'Nocelli D.'], score: '6-1 6-0', winner: 'B' },
  // Semifinali SILVER (Nitrati/Frontalini vs Oncini/Nocelli E.; Scaloni/David
  // vs Gagliardini/Romaldi) e finale SILVER: nessun vincitore/punteggio in
  // pagina -> non ancora giocate, escluse automaticamente (winner: null).

  // ===== CORDIVINBLEDON =====
  // Girone A/B e le 2 semifinali GOLD non hanno un punteggio in pagina
  // (solo "vs" o "nd"): confermato dall'utente di importarle comunque come
  // match ranked, con score vuoto.
  { t: 'Cordivinbledon', phase: 'Girone A', teamA: ['Oncini', 'Giovagnoni'], teamB: ['Perini', 'Gigli'], score: null, winner: 'A' },
  { t: 'Cordivinbledon', phase: 'Girone A', teamA: ['Ciucci', 'Corallini'], teamB: ['Oncini', 'Giovagnoni'], score: null, winner: 'B' },
  { t: 'Cordivinbledon', phase: 'Girone A', teamA: ['Perini', 'Gigli'], teamB: ['Ciucci', 'Corallini'], score: null, winner: 'B' },
  { t: 'Cordivinbledon', phase: 'Girone A', teamA: ['Virgili', 'Nocelli D.'], teamB: ['Ciucci', 'Corallini'], score: null, winner: 'A' },
  { t: 'Cordivinbledon', phase: 'Girone A', teamA: ['Perini', 'Gigli'], teamB: ['Virgili', 'Nocelli D.'], score: null, winner: 'B' },
  { t: 'Cordivinbledon', phase: 'Girone A', teamA: ['Virgili', 'Nocelli D.'], teamB: ['Oncini', 'Giovagnoni'], score: null, winner: 'A' },

  { t: 'Cordivinbledon', phase: 'Girone B', teamA: ['David', 'Scaloni'], teamB: ['Gagliardini', 'Romaldi'], score: null, winner: 'B' },
  { t: 'Cordivinbledon', phase: 'Girone B', teamA: ['Moreschini', 'Cirillo'], teamB: ['David', 'Scaloni'], score: null, winner: 'A' },
  { t: 'Cordivinbledon', phase: 'Girone B', teamA: ['Gagliardini', 'Romaldi'], teamB: ['Moreschini', 'Cirillo'], score: null, winner: 'B' },
  { t: 'Cordivinbledon', phase: 'Girone B', teamA: ['Giorgi', 'Carotti'], teamB: ['Moreschini', 'Cirillo'], score: null, winner: 'B' },
  { t: 'Cordivinbledon', phase: 'Girone B', teamA: ['Gagliardini', 'Romaldi'], teamB: ['Giorgi', 'Carotti'], score: null, winner: 'B' },
  { t: 'Cordivinbledon', phase: 'Girone B', teamA: ['Giorgi', 'Carotti'], teamB: ['David', 'Scaloni'], score: null, winner: 'A' },

  { t: 'Cordivinbledon', phase: 'Semifinale GOLD', teamA: ['Moreschini', 'Cirillo'], teamB: ['Giovagnoni', 'Oncini'], score: null, winner: 'A' },
  { t: 'Cordivinbledon', phase: 'Semifinale GOLD', teamA: ['Virgili', 'Nocelli D.'], teamB: ['Giorgi', 'Carotti'], score: null, winner: 'A' },
  { t: 'Cordivinbledon', phase: 'Finale GOLD', teamA: ['Moreschini', 'Cirillo'], teamB: ['Virgili', 'Nocelli D.'], score: '6-7 6-4 10-6', winner: 'A' },
  // Tabellone SILVER Cordivinbledon: vuoto in pagina, nessun match.
];

// -----------------------------------------------------------------------

function surnameToken(alias) {
  return alias.replace(/\s+[A-Z]\.$/, '').trim();
}

async function resolveAliases(allPlayers) {
  const usedAliases = new Set();
  for (const m of MATCHES) {
    for (const alias of [...m.teamA, ...m.teamB]) usedAliases.add(alias);
  }

  const resolved = new Map(); // alias -> { id, name } | { candidates: [...] } | { missing: true }

  for (const alias of usedAliases) {
    const mapped = PLAYER_ALIASES[alias];
    if (mapped) {
      const hit = allPlayers.find((p) => p.name === mapped);
      resolved.set(alias, hit ? { id: hit.id, name: hit.name } : { missing: true, note: `alias mappato a "${mapped}" ma non trovato in players` });
      continue;
    }

    // Match esatto su una delle "parole" del nome (non substring: "Giorgi"
    // non deve intercettare "Giorgio").
    const token = surnameToken(alias).toLowerCase();
    const candidates = allPlayers.filter((p) =>
      p.name.toLowerCase().split(/\s+/).includes(token),
    );
    if (candidates.length === 1) {
      resolved.set(alias, { id: candidates[0].id, name: candidates[0].name, autoResolved: true });
    } else if (candidates.length === 0) {
      resolved.set(alias, { missing: true, candidates: [] });
    } else {
      resolved.set(alias, { ambiguous: true, candidates: candidates.map((c) => c.name) });
    }
  }

  return resolved;
}

function printReport(resolved) {
  console.log('\n=== MAPPING GIOCATORI (alias torneo -> players.name) ===\n');
  const rows = [...resolved.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [alias, info] of rows) {
    if (info.id) {
      console.log(`  OK         ${alias.padEnd(16)} -> ${info.name}${info.autoResolved ? '  (auto per cognome)' : ''}`);
    } else if (info.ambiguous) {
      console.log(`  AMBIGUOUS  ${alias.padEnd(16)} -> candidati: ${info.candidates.join(' | ')}`);
    } else {
      console.log(`  MISSING    ${alias.padEnd(16)} -> nessun giocatore trovato nel DB`);
    }
  }

  console.log('\n=== PARTITE ===\n');
  let ready = 0;
  let blocked = 0;
  let noWinner = 0;

  for (const m of MATCHES) {
    const label = `[${m.t} / ${m.phase}] ${m.teamA.join('-')} vs ${m.teamB.join('-')}`;
    if (!m.winner) {
      console.log(`  SKIP (senza vincitore)  ${label}`);
      noWinner++;
      continue;
    }
    const names = [...m.teamA, ...m.teamB].map((a) => resolved.get(a));
    const unresolved = names.some((n) => !n.id);
    const status = m.flag ? 'DA CONFERMARE' : unresolved ? 'BLOCCATO (giocatore non risolto)' : 'PRONTO';
    console.log(`  ${status.padEnd(24)} ${label}  [${m.score ?? 'n.d.'}]  vince ${m.winner}`);
    if (m.flag) console.log(`      -> ${m.flag}`);
    if (unresolved) blocked++;
    else if (!m.flag) ready++;
  }

  console.log(`\nTotale: ${MATCHES.length} match | pronti: ${ready} | da confermare/bloccati: ${MATCHES.length - ready - noWinner} | esclusi senza vincitore: ${noWinner}\n`);
}

async function commitMatches(resolved, allPlayersById) {
  let inserted = 0;
  let skipped = 0;

  for (const m of MATCHES) {
    if (!m.winner || m.flag) {
      skipped++;
      continue;
    }
    const aliasIds = [...m.teamA, ...m.teamB].map((a) => resolved.get(a));
    if (aliasIds.some((n) => !n.id)) {
      skipped++;
      continue;
    }

    const [a1Id, a2Id, b1Id, b2Id] = aliasIds.map((n) => n.id);

    const { data: rankings, error: rankErr } = await supabase
      .from('padel_rankings')
      .select('player_id, current_elo, matches_played, wins, losses')
      .in('player_id', [a1Id, a2Id, b1Id, b2Id]);

    if (rankErr || !rankings || rankings.length !== 4) {
      console.error(`  ERRORE ranking mancante per match ${m.t}/${m.phase}`, rankErr);
      skipped++;
      continue;
    }

    const byId = Object.fromEntries(rankings.map((r) => [r.player_id, r]));
    const teamA = [byId[a1Id], byId[a2Id]];
    const teamB = [byId[b1Id], byId[b2Id]];

    const avgA = (teamA[0].current_elo + teamA[1].current_elo) / 2;
    const avgB = (teamB[0].current_elo + teamB[1].current_elo) / 2;
    const elo = calculateEloChange(avgA, avgB, m.winner);
    const winners = m.winner === 'A' ? teamA : teamB;
    const losers = m.winner === 'A' ? teamB : teamA;

    const { data: insertedMatch, error: matchError } = await supabase
      .from('matches')
      .insert({
        winner_team: m.winner,
        score: m.score ?? '',
        team_a_avg_elo: avgA,
        team_b_avg_elo: avgB,
        match_type: elo.matchType,
        elo_delta_winner: elo.winnerDelta,
        elo_delta_loser: elo.loserDelta,
        note: `Importato da ${m.t} - ${m.phase}`,
        best_player_id: null,
      })
      .select()
      .single();

    if (matchError || !insertedMatch) {
      console.error(`  ERRORE insert match ${m.t}/${m.phase}`, matchError);
      skipped++;
      continue;
    }

    for (const player of winners) {
      const delta = player.matches_played < 3 ? 15 : elo.winnerDelta;
      await supabase.from('padel_rankings').update({
        current_elo: player.current_elo + delta,
        matches_played: player.matches_played + 1,
        wins: player.wins + 1,
      }).eq('player_id', player.player_id);
      await supabase.from('match_players').insert({
        match_id: insertedMatch.id,
        player_id: player.player_id,
        team: m.winner,
        elo_before: player.current_elo,
        elo_after: player.current_elo + delta,
        delta,
        result: 'win',
      });
    }

    for (const player of losers) {
      const delta = player.matches_played < 3 ? -15 : elo.loserDelta;
      await supabase.from('padel_rankings').update({
        current_elo: player.current_elo + delta,
        matches_played: player.matches_played + 1,
        losses: player.losses + 1,
      }).eq('player_id', player.player_id);
      await supabase.from('match_players').insert({
        match_id: insertedMatch.id,
        player_id: player.player_id,
        team: m.winner === 'A' ? 'B' : 'A',
        elo_before: player.current_elo,
        elo_after: player.current_elo + delta,
        delta,
        result: 'loss',
      });
    }

    inserted++;
    console.log(`  INSERITO  [${m.t}/${m.phase}] ${m.teamA.join('-')} vs ${m.teamB.join('-')}`);
  }

  console.log(`\nCommit completato: ${inserted} inseriti, ${skipped} saltati.\n`);
}

async function main() {
  const { data: allPlayers, error } = await supabase.from('players').select('id, name');
  if (error || !allPlayers) {
    console.error('Errore nel recupero giocatori', error);
    process.exit(1);
  }

  const resolved = await resolveAliases(allPlayers);
  printReport(resolved);

  if (!COMMIT) {
    console.log('Modalità report (default): nessuna scrittura sul DB. Rilancia con --commit per inserire i match pronti.\n');
    return;
  }

  await commitMatches(resolved, allPlayers);
}

main();
