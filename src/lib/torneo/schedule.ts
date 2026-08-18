// Genera il calendario di un mini torneo di padel a coppie variabili: con un
// solo campo, ad ogni partita scendono 4 giocatori (2 coppie) e gli altri
// riposano. L'algoritmo copre tutte le possibili coppie di compagni nel
// minor numero di partite possibile, bilanciando i riposi tra i giocatori.

export interface ScheduleMatch {
  teamA: [number, number];
  teamB: [number, number];
  sitOut: number[];
}

function combinations2(items: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      out.push([items[i], items[j]]);
    }
  }
  return out;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * playerCount deve essere >= 4 (servono 4 giocatori in campo per partita).
 */
export function generateSchedule(playerCount: number): ScheduleMatch[] {
  if (playerCount < 4) return [];

  const players = Array.from({ length: playerCount }, (_, i) => i);
  const allPairs = combinations2(players);
  const remaining = new Set(allPairs.map(([a, b]) => pairKey(a, b)));
  const sitCount = new Map(players.map((p) => [p, 0]));

  // ogni possibile partita: 2 coppie disgiunte tra i playerCount giocatori
  const allMatches: { teamA: [number, number]; teamB: [number, number] }[] = [];
  for (const teamA of allPairs) {
    const rest = players.filter((p) => !teamA.includes(p));
    for (const teamB of combinations2(rest)) {
      if (pairKey(...teamA) < pairKey(...teamB)) {
        allMatches.push({ teamA, teamB });
      }
    }
  }

  const schedule: ScheduleMatch[] = [];

  while (remaining.size > 0) {
    let best: { teamA: [number, number]; teamB: [number, number]; sitOut: number[] } | null = null;
    let bestCoverage = -1;
    let bestSitScore = Infinity;

    for (const { teamA, teamB } of allMatches) {
      const kA = pairKey(...teamA);
      const kB = pairKey(...teamB);
      const coverage = (remaining.has(kA) ? 1 : 0) + (remaining.has(kB) ? 1 : 0);
      if (coverage === 0) continue;

      const onCourt = new Set([...teamA, ...teamB]);
      const sitOut = players.filter((p) => !onCourt.has(p));
      const sitScore = sitOut.reduce((s, p) => s + (sitCount.get(p) ?? 0), 0);

      if (coverage > bestCoverage || (coverage === bestCoverage && sitScore < bestSitScore)) {
        best = { teamA, teamB, sitOut };
        bestCoverage = coverage;
        bestSitScore = sitScore;
      }
    }

    if (!best) break;

    remaining.delete(pairKey(...best.teamA));
    remaining.delete(pairKey(...best.teamB));
    for (const p of best.sitOut) sitCount.set(p, (sitCount.get(p) ?? 0) + 1);
    schedule.push(best);
  }

  return schedule;
}
