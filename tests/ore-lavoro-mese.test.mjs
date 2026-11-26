import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentiPeriodo } from '../src/lib/ore-lavoro/segmenti.ts';
import { riassuntoGiorno } from '../src/lib/ore-lavoro/mese.ts';

const IO = 'io', LUDO = 'ludo', MAURO = 'mauro';
const nomi = { ludo: 'Ludo', mauro: 'Mauro' };
const nomeDi = (id) => nomi[id] ?? '?';
const t = (data, i, f, staff_id, attivita = 'tennis') => ({ data, ora_inizio: i, ora_fine: f, staff_id, club: 'cingoli', attivita });
const e = (id, data, i, f, assente_id, sostituto_id, extra = {}) => ({
  id, data, ora_inizio: i, ora_fine: f, assente_id, sostituto_id, club: 'cingoli', attivita: 'tennis', note: null, ...extra,
});
const riassunto = (data, previsti, eccezioni) =>
  riassuntoGiorno(IO, segmentiPeriodo(IO, previsti, eccezioni, false).filter((s) => s.data === data), previsti.filter((p) => p.data === data), nomeDi);

test('sostituisco Ludo e salto atletica', () => {
  const previsti = [t('2026-11-03', '15:30:00', '19:30:00', LUDO), t('2026-11-03', '16:30:00', '18:30:00', IO, 'atletica')];
  const r = riassunto('2026-11-03', previsti, [
    e('a', '2026-11-03', '15:30:00', '19:30:00', LUDO, IO),
    e('b', '2026-11-03', '16:30:00', '18:30:00', IO, null),
  ]);
  assert.deepEqual(r.bollini.map((b) => b.mezzi), [8]);
  assert.deepEqual(r.note.map((n) => n.testo), ['sostituzione Ludo 4h', 'no atletica']);
});

test('assente un paio d\'ore, mezz\'ora di extra, sostituito', () => {
  const previsti = [t('2026-11-02', '16:00:00', '21:30:00', IO)];
  const r = riassunto('2026-11-02', previsti, [
    e('a', '2026-11-02', '19:30:00', '21:30:00', IO, null),
    e('b', '2026-11-02', '16:00:00', '17:00:00', IO, MAURO),
    e('c', '2026-11-02', '12:00:00', '12:30:00', null, IO),
    e('d', '2026-11-02', '10:00:00', '11:00:00', null, IO, { privata: true }),
  ]);
  // 17:00-19:30 lavorato = 5 mezz'ore; extra 1; privata 2
  assert.deepEqual(r.bollini.map((b) => b.mezzi), [5, 1, 2]);
  assert.deepEqual(r.note.map((n) => n.testo).sort(), ['assente 2h', 'extra 0h30', 'privata 1h', 'sostituito da Mauro 1h']);
});
