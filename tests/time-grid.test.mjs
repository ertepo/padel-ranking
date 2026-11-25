import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  minutiToTime, timeToMinuti, snapToSlot, fmtFascia, fmtDurata, fmtOreDecimali,
  isIsoDate, oggiRoma, addGiorni, isoDow, lunediDi, giorniSettimana,
  primoDelMese, ultimoDelMese, addMesi, fmtSettimana, fmtSettimanaBreve, fmtMese, fasciaVisibile, assegnaCorsie,
} from '../src/lib/time-grid.ts';

test('orari', () => {
  assert.equal(minutiToTime(990), '16:30');
  assert.equal(minutiToTime(1440), '24:00');
  assert.equal(timeToMinuti('16:30'), 990);
  assert.equal(timeToMinuti('9:05:00'), 545);
  assert.ok(Number.isNaN(timeToMinuti('25:00')));
  assert.ok(Number.isNaN(timeToMinuti('16.30')));
  assert.equal(snapToSlot(1000), 990);
  assert.equal(fmtFascia(960, 1290), '16:00–21:30');
});

test('durate', () => {
  assert.equal(fmtDurata(330), '5h30');
  assert.equal(fmtDurata(120), '2h');
  assert.equal(fmtDurata(45), '0h45');
  assert.equal(fmtDurata(-90), '−1h30');
  assert.equal(fmtDurata(60, true), '+1h');
  assert.equal(fmtDurata(0, true), '0h');
  assert.equal(fmtOreDecimali(330), '5,5');
  assert.equal(fmtOreDecimali(20), '0,33');
});

test('date', () => {
  assert.ok(isIsoDate('2026-02-28'));
  assert.ok(!isIsoDate('2026-02-30'));
  assert.equal(addGiorni('2026-10-24', 2), '2026-10-26'); // attraverso il cambio dell'ora legale
  assert.equal(addGiorni('2026-12-31', 1), '2027-01-01');
  assert.equal(isoDow('2026-11-23'), 1);
  assert.equal(isoDow('2026-11-29'), 7);
  assert.equal(lunediDi('2026-11-29'), '2026-11-23');
  assert.deepEqual(giorniSettimana('2026-11-25'), [
    '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
  ]);
  assert.equal(primoDelMese('2026-11-23'), '2026-11-01');
  assert.equal(ultimoDelMese('2026-02-10'), '2026-02-28');
  assert.equal(ultimoDelMese('2028-02-10'), '2028-02-29');
  assert.equal(addMesi('2026-12-15', 1), '2027-01-01');
  assert.equal(addMesi('2026-01-31', -1), '2025-12-01');
  assert.equal(fmtMese('2026-11-23'), 'novembre 2026');
  assert.equal(fmtSettimana('2026-11-25'), '23–29 novembre 2026');
  assert.equal(fmtSettimana('2026-12-02'), '30 novembre – 6 dicembre 2026');
  assert.equal(fmtSettimanaBreve('2026-11-25'), '23–29 novembre');
  assert.equal(fmtSettimanaBreve('2026-09-30'), '28 set – 4 ott');
  assert.equal(fmtSettimanaBreve('2026-12-30'), '28 dic – 3 gen');
  assert.equal(fmtSettimana('2026-12-30'), '28 dicembre 2026 – 3 gennaio 2027');
});

test('oggi a Roma', () => {
  // 23:30 UTC del 23 novembre = 00:30 del 24 a Roma (ora solare)
  assert.equal(oggiRoma(new Date('2026-11-23T23:30:00Z')), '2026-11-24');
  // 22:30 UTC del 30 giugno = 00:30 del 1° luglio a Roma (ora legale)
  assert.equal(oggiRoma(new Date('2026-06-30T22:30:00Z')), '2026-07-01');
});

test('fascia visibile', () => {
  assert.deepEqual(fasciaVisibile([], 720, 1440), { inizio: 720, fine: 1440 });
  assert.deepEqual(fasciaVisibile([{ inizio: 990, fine: 1290 }], 720, 1440), { inizio: 960, fine: 1320 });
  assert.deepEqual(fasciaVisibile([{ inizio: 990, fine: 1110 }], 720, 1440, { inizio: 900 }), { inizio: 900, fine: 1140 });
  assert.deepEqual(fasciaVisibile([{ inizio: 600, fine: 1500 }], 720, 1440), { inizio: 720, fine: 1440 });
});

test('corsie dei blocchi sovrapposti', () => {
  const a = { colonna: 1, inizio: 960, fine: 1110 };
  const b = { colonna: 1, inizio: 930, fine: 1170 };
  const c = { colonna: 1, inizio: 1170, fine: 1230 };
  const d = { colonna: 2, inizio: 960, fine: 1110 };
  const corsie = assegnaCorsie([a, b, c, d]);
  assert.deepEqual(corsie.get(b), { corsia: 0, corsie: 2 });
  assert.deepEqual(corsie.get(a), { corsia: 1, corsie: 2 });
  assert.deepEqual(corsie.get(c), { corsia: 0, corsie: 1 });
  assert.deepEqual(corsie.get(d), { corsia: 0, corsie: 1 });
});

test('dateRipetute', async () => {
  const { dateRipetute, MAX_RIPETIZIONI } = await import('../src/lib/time-grid.ts');
  // martedì 1 dicembre 2026 → martedì e giovedì fino al 10
  assert.deepEqual(dateRipetute('2026-12-01', [2, 4], '2026-12-10'), ['2026-12-01', '2026-12-03', '2026-12-08', '2026-12-10']);
  assert.deepEqual(dateRipetute('2026-12-01', [4], '2026-12-08'), ['2026-12-03']);
  assert.deepEqual(dateRipetute('2026-12-01', [2], '2026-11-30'), []);
  assert.deepEqual(dateRipetute('2026-12-01', [], '2026-12-30'), []);
  assert.equal(dateRipetute('2026-01-01', [1, 2, 3, 4, 5, 6, 7], '2027-12-31').length, MAX_RIPETIZIONI + 1);
});
