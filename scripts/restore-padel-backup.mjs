// Ripristina matches / match_players / padel_rankings dai 3 CSV esportati da
// Supabase (Table Editor -> Export CSV), presi subito dopo la creazione dei
// 5 nuovi giocatori Cordivinbledon ma PRIMA del bulk import che ha duplicato
// le 15 partite Serronchioland gia' presenti.
//
// Non tocca la tabella `players` (i 5 nuovi giocatori restano).
//
// USO:
//   set -a && source .env && set +a && node scripts/restore-padel-backup.mjs
//     -> solo report: legge i 3 CSV e mostra cosa farebbe, nessuna scrittura
//   ... node scripts/restore-padel-backup.mjs --commit
//     -> esegue davvero il restore

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

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

const PADEL_RANKINGS_CSV = 'C:\\Users\\Opetre\\Downloads\\padel_rankings_rows.csv';
const MATCH_PLAYERS_CSV = 'C:\\Users\\Opetre\\Downloads\\match_players_rows.csv';
const MATCHES_CSV = 'C:\\Users\\Opetre\\Downloads\\matches_rows (1).csv';

// Parser CSV minimale ma corretto per campi quotati (RFC4180-ish): gestisce
// virgole e virgolette dentro i campi, campi vuoti -> null.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => {
      const v = r[idx];
      obj[h] = v === undefined || v === '' ? null : v;
    });
    return obj;
  });
}

function loadCsv(path) {
  return parseCsv(readFileSync(path, 'utf8'));
}

async function main() {
  const rankingsBackup = loadCsv(PADEL_RANKINGS_CSV);
  const matchesBackup = loadCsv(MATCHES_CSV);
  const matchPlayersBackup = loadCsv(MATCH_PLAYERS_CSV);

  console.log(`Backup letto: ${matchesBackup.length} matches, ${matchPlayersBackup.length} match_players, ${rankingsBackup.length} padel_rankings.`);

  const { count: currentMatches } = await supabase.from('matches').select('*', { count: 'exact', head: true });
  const { count: currentMp } = await supabase.from('match_players').select('*', { count: 'exact', head: true });
  console.log(`Stato attuale DB: ${currentMatches} matches, ${currentMp} match_players.`);

  if (!COMMIT) {
    console.log('\nModalita report: nessuna scrittura. Rilancia con --commit per eseguire il restore.');
    return;
  }

  console.log('\n1) Cancello match_players...');
  const { error: delMpErr } = await supabase.from('match_players').delete().not('id', 'is', null);
  if (delMpErr) throw delMpErr;

  console.log('2) Cancello matches...');
  const { error: delMatchErr } = await supabase.from('matches').delete().not('id', 'is', null);
  if (delMatchErr) throw delMatchErr;

  console.log('3) Reinserisco matches dal backup...');
  const matchesPayload = matchesBackup.map((m) => ({
    id: m.id,
    played_at: m.played_at,
    team_a_score: m.team_a_score,
    team_b_score: m.team_b_score,
    winner_team: m.winner_team,
    team_a_avg_elo: m.team_a_avg_elo,
    team_b_avg_elo: m.team_b_avg_elo,
    match_type: m.match_type,
    elo_delta_winner: m.elo_delta_winner,
    elo_delta_loser: m.elo_delta_loser,
    created_at: m.created_at,
    score: m.score,
    note: m.note,
    best_player_id: m.best_player_id,
  }));
  const { error: insMatchErr } = await supabase.from('matches').insert(matchesPayload);
  if (insMatchErr) throw insMatchErr;

  console.log('4) Reinserisco match_players dal backup...');
  const mpPayload = matchPlayersBackup.map((r) => ({
    id: r.id,
    match_id: r.match_id,
    player_id: r.player_id,
    team: r.team,
    elo_before: r.elo_before,
    elo_after: r.elo_after,
    delta: r.delta,
    result: r.result,
  }));
  const { error: insMpErr } = await supabase.from('match_players').insert(mpPayload);
  if (insMpErr) throw insMpErr;

  console.log('5) Ripristino padel_rankings (current_elo, matches_played, wins, losses)...');
  for (const r of rankingsBackup) {
    const { error } = await supabase
      .from('padel_rankings')
      .update({
        current_elo: Number(r.current_elo),
        matches_played: Number(r.matches_played),
        wins: Number(r.wins),
        losses: Number(r.losses),
      })
      .eq('player_id', r.player_id);
    if (error) console.error('  ERRORE update ranking', r.player_id, error);
  }

  const { count: finalMatches } = await supabase.from('matches').select('*', { count: 'exact', head: true });
  const { count: finalMp } = await supabase.from('match_players').select('*', { count: 'exact', head: true });
  console.log(`\nRestore completato. Stato finale: ${finalMatches} matches, ${finalMp} match_players.`);
  console.log(`Atteso: ${matchesBackup.length} matches, ${matchPlayersBackup.length} match_players.`);
}

main().catch((err) => {
  console.error('ERRORE FATALE', err);
  process.exit(1);
});
