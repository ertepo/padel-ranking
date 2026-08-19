// Trasforma il nome di un torneo in uno slug leggibile per l'URL di
// condivisione (es. "Torneo del venerdi" -> "torneo-del-venerdi"). Non viene
// salvato da nessuna parte: si ricalcola sia quando si genera il link sia
// quando si risolve la pagina, confrontandolo con lo slug di ogni nome noto.
const COMBINING_DIACRITIC_MIN = 0x0300;
const COMBINING_DIACRITIC_MAX = 0x036f;

export function slugify(input: string): string {
  let withoutDiacritics = '';
  for (const ch of input.normalize('NFD')) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= COMBINING_DIACRITIC_MIN && code <= COMBINING_DIACRITIC_MAX) continue;
    withoutDiacritics += ch;
  }

  return withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
