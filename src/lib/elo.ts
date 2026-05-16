export function calculateEloChange(
  avgA: number,
  avgB: number,
  winner: 'A' | 'B'
) {
  const diff = Math.abs(avgA - avgB);

  const balanced = diff <= 50;

  if (balanced) {
    return {
      winnerDelta: 12,
      loserDelta: -12,
      matchType: 'balanced',
    };
  }

  const strongerTeam =
    avgA > avgB ? 'A' : 'B';

  const upset = winner !== strongerTeam;

  if (upset) {
    return {
      winnerDelta: 25,
      loserDelta: -25,
      matchType: 'upset',
    };
  }

  return {
    winnerDelta: 8,
    loserDelta: -8,
    matchType: 'expected',
  };
}