import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sottraiFasce, segmentiPeriodo } from '../src/lib/ore-lavoro/segmenti.ts';

test('sottrazione di fasce', () => {
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1290 }], [{ inizio: 960, fine: 1080 }]), [{ inizio: 1080, fine: 1290 }]);
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1290 }], [{ inizio: 1020, fine: 1080 }]), [
    { inizio: 960, fine: 1020 },
    { inizio: 1080, fine: 1290 },
  ]);
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1050 }], [{ inizio: 900, fine: 1100 }]), []);
  assert.deepEqual(sottraiFasce([{ inizio: 960, fine: 1050 }], [{ inizio: 1100, fine: 1200 }]), [{ inizio: 960, fine: 1050 }]);
  // assenze sovrapposte
  assert.deepEqual(sottraiFasce([{ inizio: 930, fine: 1170 }], [{ inizio: 930, fine: 1050 }, { inizio: 990, fine: 1080 }]), [
    { inizio: 1080, fine: 1170 },
  ]);
});

test('segmenti di un periodo', () => {
  const IO = 'io', ALTRO = 'altro';
  const previsti = [
    { data: '2026-11-02', ora_inizio: '16:00:00', ora_fine: '21:30:00' },
    { data: '2026-11-03', ora_inizio: '16:30:00', ora_fine: '18:30:00' },
  ];
  const eccezioni = [
    { id: 'a', data: '2026-11-02', ora_inizio: '16:00:00', ora_fine: '18:00:00', assente_id: IO, sostituto_id: ALTRO, note: null },
    { id: 'b', data: '2026-11-03', ora_inizio: '15:30:00', ora_fine: '19:30:00', assente_id: ALTRO, sostituto_id: IO, note: null },
    { id: 'c', data: '2026-11-05', ora_inizio: '21:00:00', ora_fine: '22:00:00', assente_id: null, sostituto_id: IO, note: 'torneo' },
  ];
  const s = segmentiPeriodo(IO, previsti, eccezioni).map(({ data, tipo, inizio, fine }) => [data, tipo, inizio, fine]);
  assert.deepEqual(s, [
    ['2026-11-02', 'lavorato', 1080, 1290],
    ['2026-11-02', 'assente', 960, 1080],
    ['2026-11-03', 'lavorato', 990, 1110],
    ['2026-11-03', 'extra', 930, 1170],
    ['2026-11-05', 'extra', 1260, 1320],
  ]);
});
