import { test } from 'node:test';
import assert from 'node:assert/strict';
import { affiancatoDi, sottraiFasce, segmentiPeriodo } from '../src/lib/ore-lavoro/segmenti.ts';

test('sottrazione di fasce', () => {
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1290 }], [{ inizio: 960, fine: 1080 }]), [{ inizio: 1080, fine: 1290 }]);
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1290 }], [{ inizio: 1020, fine: 1080 }]), [
    { inizio: 960, fine: 1020 },
    { inizio: 1080, fine: 1290 },
  ]);
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1050 }], [{ inizio: 900, fine: 1100 }]), []);
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1050 }], [{ inizio: 1100, fine: 1200 }]), [{ inizio: 960, fine: 1050 }]);
  assert.deepEqual(sottraiFasce([{ inizio: 930, fine: 1170 }], [{ inizio: 930, fine: 1050 }, { inizio: 990, fine: 1080 }]), [
    { inizio: 1080, fine: 1170 },
  ]);
});

const IO = 'io', ALDO = 'aldo', DARIO = 'dario', BRUNO = 'bruno';
const t = (data, i, f, staff_id, attivita = 'tennis') => ({ data, ora_inizio: i, ora_fine: f, staff_id, club: 'cingoli', attivita });
const e = (id, data, i, f, assente_id, sostituto_id, note = null) => ({
  id, data, ora_inizio: i, ora_fine: f, assente_id, sostituto_id, club: 'cingoli', attivita: 'tennis', note,
});

const previsti = [
  t('2026-11-02', '16:00:00', '21:30:00', IO),
  t('2026-11-02', '17:00:00', '18:00:00', BRUNO, 'atletica'),
  t('2026-11-03', '15:30:00', '19:30:00', ALDO),
  t('2026-11-03', '16:30:00', '18:30:00', IO, 'atletica'),
  t('2026-11-05', '15:00:00', '20:00:00', ALDO),
  t('2026-11-05', '20:00:00', '21:00:00', IO),
];
const eccezioni = [
  e('a', '2026-11-02', '16:00:00', '18:00:00', IO, DARIO, 'parte del turno'),
  e('b', '2026-11-03', '15:30:00', '19:30:00', ALDO, IO),
  e('c', '2026-11-05', '15:00:00', '17:00:00', ALDO, DARIO),
  e('d', '2026-11-06', '21:00:00', '22:00:00', null, IO, 'torneo'),
];
const riga = ({ data, tipo, staff_id, attivita, inizio, fine }) => [data, tipo, staff_id, attivita, inizio, fine];

test('segmenti del maestro, senza colleghi', () => {
  assert.deepEqual(segmentiPeriodo(IO, previsti, eccezioni, false).map(riga), [
    ['2026-11-02', 'lavorato', IO, 'tennis', 1080, 1290],
    ['2026-11-02', 'assente', IO, 'tennis', 960, 1080],
    ['2026-11-03', 'lavorato', IO, 'atletica', 990, 1110],
    ['2026-11-03', 'extra', IO, 'tennis', 930, 1170],
    ['2026-11-05', 'lavorato', IO, 'tennis', 1200, 1260],
    ['2026-11-06', 'extra', IO, 'tennis', 1260, 1320],
  ]);
});

test('segmenti con i colleghi', () => {
  const s = segmentiPeriodo(IO, previsti, eccezioni).filter((x) => x.tipo.startsWith('collega')).map(riga);
  assert.deepEqual(s, [
    ['2026-11-02', 'collega', BRUNO, 'atletica', 1020, 1080],
    // martedì Aldo è coperto da me: nessun blocco del collega (c'è il mio extra)
    ['2026-11-05', 'collega', ALDO, 'tennis', 1020, 1200],
    ['2026-11-05', 'collega-assente', ALDO, 'tennis', 900, 1020],
  ]);
});

test('solo la persona affiancata tra i colleghi', () => {
  const s = segmentiPeriodo(IO, previsti, eccezioni, (id) => id === BRUNO).filter((x) => x.tipo.startsWith('collega')).map(riga);
  assert.deepEqual(s, [['2026-11-02', 'collega', BRUNO, 'atletica', 1020, 1080]]);
});

test('persona affiancata nei due sensi', () => {
  const p = (id, affiancato_id = null) => ({ id, nome: id, ruolo: 'maestro', colore: '#000000', sono_io: false, attivo: true, note: null, affiancato_id });
  const staff = [p(IO, BRUNO), p(BRUNO), p(ALDO)];
  assert.equal(affiancatoDi(staff, IO)?.id, BRUNO);
  assert.equal(affiancatoDi(staff, BRUNO)?.id, IO);
  assert.equal(affiancatoDi(staff, ALDO), null);
  assert.equal(affiancatoDi(staff, null), null);
});

test('le ore extra di un collega compaiono tra i suoi turni', () => {
  const conExtra = [...eccezioni, e('x', '2026-11-04', '09:00:00', '11:00:00', null, BRUNO, 'impegno')];
  const s = segmentiPeriodo(IO, previsti, conExtra, (id) => id === BRUNO).filter((x) => x.tipo.startsWith('collega'));
  assert.deepEqual(s.map(riga), [
    ['2026-11-02', 'collega', BRUNO, 'atletica', 1020, 1080],
    ['2026-11-04', 'collega', BRUNO, 'tennis', 540, 660],
  ]);
  assert.equal(s[1].eccezione?.id, 'x');
  // Dalla parte di Bruno restano le sue ore extra.
  assert.deepEqual(segmentiPeriodo(BRUNO, previsti, conExtra, false).map(riga), [
    ['2026-11-02', 'lavorato', BRUNO, 'atletica', 1020, 1080],
    ['2026-11-04', 'extra', BRUNO, 'tennis', 540, 660],
  ]);
});
