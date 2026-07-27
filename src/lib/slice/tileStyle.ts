// Colore e testo per livello, condivisi tra la board di gioco (SliceBoard.svelte)
// e qualunque altra vista che debba ridisegnare una tessera Slice (es. il
// "replay" statico della board a fine partita in classifica). PUNTO e 15 sono
// entrambi gialli: è un indizio visivo che si fondono solo fra loro.

export function tileBackground(level: number): string {
  if (level === 0 || level === 1) return 'var(--giallo-paglierino)';
  if (level === 2) return 'var(--verde-tennis)';
  if (level === 3) return 'var(--viola-tennis)';
  if (level >= 4 && level <= 9) return 'white';
  if (level >= 10 && level <= 12) return 'var(--rosa-salmone)';
  return 'var(--giallo-club)'; // MATCH
}

export function tileTextColor(level: number): string {
  return level === 2 || level === 3 ? 'white' : 'black';
}
