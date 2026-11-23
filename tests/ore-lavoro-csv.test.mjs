import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvRiepilogo, leggiCsvOre, pianificaImport } from '../src/lib/ore-lavoro/csv.ts';

test('lettura del CSV: formati, tipi ed errori', () => {
  const { righe, errori } = leggiCsvOre(
    '﻿data,inizio,fine,ore,tipo,note\n' +
      '2026-09-04,18:00,19:30,1.5,lavorato,\n' +
      '10/09/2026,20.00,21.00,1,da verificare,"Nessun dato, GPS"\n' +
      '2026-10-06,15:30,16:30,1,sostituzione,Sostituzione altro maestro\n' +
      '2026-10-07,16:00,17:30,2,lavorato,\n' +
      '2026-10-08,21:00,20:00,,lavorato,\n' +
      '2026-10-09,15:30,19:30,4,ferie,\n' +
      '\n',
  );
  assert.deepEqual(
    righe.map((r) => [r.data, r.inizio, r.fine, r.tipo, r.note]),
    [
      ['2026-09-04', 1080, 1170, 'lavorato', ''],
      ['2026-09-10', 1200, 1260, 'da_verificare', 'Nessun dato, GPS'],
      ['2026-10-06', 930, 990, 'sostituzione', 'Sostituzione altro maestro'],
    ],
  );
  assert.equal(errori.length, 3);
  assert.match(errori[0], /Riga 5: le ore \(2\)/);
  assert.match(errori[1], /Riga 6: la fine/);
  assert.match(errori[2], /Riga 7: tipo sconosciuto \(ferie\)/);

  const pv = leggiCsvOre('data;inizio;fine\n2026-11-02;16:00;18:00\n2026-11-02;17:00;19:00\n');
  assert.equal(pv.righe.length, 2);
  assert.match(pv.errori[0], /sovrapposte il 2026-11-02/);
  assert.match(leggiCsvOre('giorno,dalle,alle\n').errori[0], /Intestazione non valida/);
});

const IO = 'io', ALDO = 'aldo', BRUNO = 'bruno', CARLO = 'carlo';
const t = (data, i, f, staff_id, attivita = 'tennis') => ({ data, ora_inizio: i, ora_fine: f, staff_id, club: 'cingoli', attivita, slot_id: 'x' });
// Orario dal 5/10 (settimana 5-11 ottobre): io lun 16-21:30, mar 16:30-18:30 atletica, gio 20-21; Aldo mar 15:30-19:30.
const previsti = [
  t('2026-10-05', '16:00:00', '21:30:00', IO),
  t('2026-10-06', '16:30:00', '18:30:00', IO, 'atletica'),
  t('2026-10-06', '15:30:00', '19:30:00', ALDO),
  t('2026-10-08', '20:00:00', '21:00:00', IO),
];
const csv =
  'data,inizio,fine,ore,tipo,note\n' +
  '2026-09-04,18:00,19:30,1.5,lavorato,\n' +
  '2026-09-07,16:00,18:30,2.5,lavorato,\n' +
  '2026-09-10,20:00,21:00,1,da_verificare,Nessun dato GPS\n' +
  '2026-09-14,16:00,18:30,2.5,lavorato,\n' +
  '2026-09-17,20:00,21:00,1,lavorato,\n' +
  '2026-10-05,16:00,20:30,4.5,lavorato,\n' +
  '2026-10-06,15:30,16:30,1,sostituzione,Sostituzione altro maestro\n' +
  '2026-10-06,16:30,18:30,2,lavorato,\n' +
  '2026-10-06,18:30,19:30,1,sostituzione,Sostituzione altro maestro\n' +
  '2026-10-10,10:00,12:00,2,extra,torneo\n' +
  '2026-12-01,16:30,18:30,2,lavorato,\n';
const { righe } = leggiCsvOre(csv);
const opzioni = { staffId: IO, dal: '2026-09-01', al: '2026-10-11', orarioFino: '2026-10-04', sostitutoAssenze: CARLO, collegaSostituzioni: BRUNO };

test('piano: orario dal CSV fino al 4/10, settimane identiche unite', () => {
  const p = pianificaImport(righe, previsti, opzioni);
  assert.deepEqual(p.orario, { dal: '2026-09-01', al: '2026-10-04' });
  assert.deepEqual(
    p.periodi.map((x) => [x.valido_dal, x.valido_al, x.turni.map((t) => `${t.giorno_settimana} ${t.ora_inizio}-${t.ora_fine}`)]),
    [
      ['2026-09-01', '2026-09-06', ['5 18:00-19:30']],
      ['2026-09-07', '2026-09-20', ['1 16:00-18:30', '4 20:00-21:00']],
    ],
  );
  assert.deepEqual(p.giorni, [{ data: '2026-09-10', da_verificare: true, note: 'Nessun dato GPS' }]);
  assert.equal(p.ignorate, 1, 'la riga di dicembre è fuori periodo');
});

test('piano: assenze dedotte con il sostituto, sostituzioni al collega indicato, extra', () => {
  const p = pianificaImport(righe, previsti, opzioni);
  assert.deepEqual(
    p.eccezioni.map((e) => [e.data, `${e.ora_inizio}-${e.ora_fine}`, e.assente_id, e.sostituto_id, e.attivita, e.note]),
    [
      ['2026-10-05', '20:30-21:30', IO, CARLO, 'tennis', 'Assenza dedotta dal CSV'],
      ['2026-10-06', '15:30-16:30', BRUNO, IO, 'tennis', 'Sostituzione altro maestro'],
      ['2026-10-06', '18:30-19:30', BRUNO, IO, 'tennis', 'Sostituzione altro maestro'],
      ['2026-10-08', '20:00-21:00', IO, CARLO, 'tennis', 'Assenza dedotta dal CSV'],
      ['2026-10-10', '10:00-12:00', null, IO, 'tennis', 'torneo'],
    ],
  );
});

test('piano: senza collega indicato si sceglie chi aveva il turno; senza orarioFino si usa l\'orario', () => {
  const p = pianificaImport(righe, previsti, { ...opzioni, collegaSostituzioni: null, orarioFino: null, sostitutoAssenze: null });
  assert.equal(p.periodi.length, 0);
  assert.equal(p.orario, null);
  const sost = p.eccezioni.filter((e) => e.sostituto_id === IO && e.assente_id);
  assert.deepEqual(sost.map((e) => e.assente_id), [ALDO, ALDO]);
  const assenze = p.eccezioni.filter((e) => e.assente_id === IO);
  assert.ok(assenze.every((e) => e.sostituto_id === null));
  // Settembre senza orario previsto nei dati di prova: le fasce diventano ore extra.
  assert.ok(p.eccezioni.some((e) => e.data === '2026-09-04' && e.assente_id === null && e.sostituto_id === IO));
});

test('export: separatore ";", ore con la virgola e totale', () => {
  const giorno = {
    data: '2026-10-06', minuti_previsti: 120, minuti_lavorati: 240, minuti_assenza: 0, minuti_sostituito: 0,
    minuti_assente_senza_sostituto: 0, minuti_sostituzioni: 120, minuti_differenza: 120, da_verificare: false,
    nota_giorno: 'nota; con punto e virgola', sostituito_da: [], sostituzioni: [{ assente_id: BRUNO, assente: 'Bruno', minuti: 60 }],
  };
  const vuoto = { ...giorno, data: '2026-10-07', minuti_previsti: 0, minuti_lavorati: 0, minuti_sostituzioni: 0, minuti_differenza: 0, nota_giorno: null, sostituzioni: [] };
  const totale = {
    periodo_inizio: '2026-10-05', minuti_previsti: 120, minuti_lavorati: 240, minuti_assenza: 0, minuti_sostituito: 90,
    minuti_assente_senza_sostituto: 0, minuti_sostituzioni: 120, minuti_differenza: 120, giorni_da_verificare: 0,
    sostituito_da: [{ sostituto_id: CARLO, sostituto: 'Carlo', minuti: 90 }],
  };
  const out = csvRiepilogo([giorno, vuoto], totale).replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(out.length, 3, 'intestazione, un giorno (quello vuoto è saltato), totale');
  assert.equal(out[1], '2026-10-06;Martedì;2;4;2;0;;0;2;Bruno;;"nota; con punto e virgola"');
  assert.equal(out[2], 'TOTALE;;2;4;2;1,5;Carlo 1,5;0;2;;;');
});
