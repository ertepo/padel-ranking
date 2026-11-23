<script lang="ts">
  // Ore di lavoro: settimana di un maestro (turni previsti, assenze,
  // sostituzioni) e totali della settimana. I minuti vengono dalle funzioni
  // SQL; qui si disegna soltanto.
  import WeekGrid, { type BloccoGriglia } from '../shared/WeekGrid.svelte';
  import StaffPanel from './StaffPanel.svelte';
  import {
    GIORNI_BREVI, addGiorni, fmtDurata, fmtFascia, fmtGiornoMese, fmtSettimana, giorniSettimana, lunediDi, oggiRoma,
  } from '../../lib/time-grid';
  import { segmentiPeriodo, type Segmento } from '../../lib/ore-lavoro/segmenti';
  import { COLORI, type DatiPeriodo, type Staff } from '../../lib/ore-lavoro/types';

  interface Props {
    staffIniziale: Staff[];
    staffSelezionatoIniziale: string | null;
    settimanaIniziale: string;
    datiIniziali: DatiPeriodo | null;
    erroreIniziale?: string;
  }

  let { staffIniziale, staffSelezionatoIniziale, settimanaIniziale, datiIniziali, erroreIniziale = '' }: Props = $props();

  let staff = $state(staffIniziale);
  let staffId = $state(staffSelezionatoIniziale);
  let lunedi = $state(lunediDi(settimanaIniziale));
  let dati: DatiPeriodo | null = $state(datiIniziali);
  let caricamento = $state(false);
  let errore = $state(erroreIniziale);
  let erroreTimer: ReturnType<typeof setTimeout> | undefined;

  const oggi = oggiRoma();
  const giorni = $derived(giorniSettimana(lunedi));
  const nomeDi = $derived(new Map(staff.map((s) => [s.id, s.nome])));
  const selezionato = $derived(staff.find((s) => s.id === staffId) ?? null);
  // Dati validi solo se sono proprio della settimana e del maestro mostrati
  // (durante un caricamento o dopo un errore non si mostrano quelli vecchi).
  const correnti = $derived(dati && dati.staff_id === staffId && dati.dal === lunedi ? dati : null);
  const giornoOre = $derived(new Map((correnti?.giorni ?? []).map((g) => [g.data, g])));
  const totale = $derived(correnti?.riepiloghi[0] ?? null);

  function flashErrore(msg: string) {
    errore = msg;
    clearTimeout(erroreTimer);
    erroreTimer = setTimeout(() => (errore = ''), 6000);
  }

  // --- Caricamento -----------------------------------------------------------

  let richiesta = 0;

  async function carica() {
    if (!staffId) return;
    const id = ++richiesta;
    const dal = lunedi;
    const al = addGiorni(lunedi, 6);
    caricamento = true;
    try {
      const res = await fetch(`/api/ore-lavoro/periodo?staff=${staffId}&dal=${dal}&al=${al}`);
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore nel caricamento.');
      if (id === richiesta) dati = result as DatiPeriodo;
    } catch (err) {
      if (id === richiesta) flashErrore(err instanceof Error ? err.message : 'Errore nel caricamento.');
    } finally {
      if (id === richiesta) caricamento = false;
    }
  }

  $effect(() => {
    // Ricarica quando cambiano maestro o settimana (non al primo giro, se il
    // server ha già fornito i dati di quella settimana) e aggiorna l'URL.
    const chiave = `${staffId}|${lunedi}`;
    if (!(dati && `${dati.staff_id}|${dati.dal}` === chiave)) carica();
    const url = new URL(window.location.href);
    url.searchParams.set('settimana', lunedi);
    if (staffId) url.searchParams.set('staff', staffId);
    history.replaceState(null, '', url);
  });

  // --- Blocchi ----------------------------------------------------------------

  type Blocco = BloccoGriglia & { segmento: Segmento; sottotitolo?: string };

  const blocchi: Blocco[] = $derived.by(() => {
    if (!correnti || !staffId) return [];
    return segmentiPeriodo(staffId, correnti.previsti, correnti.eccezioni).map((s) => {
      const e = s.eccezione;
      const daVerificare = giornoOre.get(s.data)?.da_verificare ?? false;
      let titolo = 'Turno';
      let colore: string = COLORI.lavorato;
      if (s.tipo === 'lavorato' && daVerificare) {
        titolo = 'Da verificare';
        colore = COLORI.verifica;
      } else if (s.tipo === 'assente') {
        titolo = e?.sostituto_id ? `Sostituito da ${nomeDi.get(e.sostituto_id) ?? '?'}` : 'Assente';
        colore = COLORI.assente;
      } else if (s.tipo === 'extra') {
        titolo = e?.assente_id ? `Sostituisco ${nomeDi.get(e.assente_id) ?? '?'}` : 'Ore extra';
        colore = COLORI.extra;
      }
      return {
        id: s.id,
        colonna: giorni.indexOf(s.data),
        inizio: s.inizio,
        fine: s.fine,
        colore,
        titolo,
        sottotitolo: e?.note ?? undefined,
        segmento: s,
      };
    });
  });

  const colonne = $derived(
    giorni.map((g, i) => {
      const ore = giornoOre.get(g);
      const lavorate = ore && (ore.minuti_previsti || ore.minuti_lavorati) ? ` · ${fmtDurata(ore.minuti_lavorati)}` : '';
      return { key: g, label: GIORNI_BREVI[i], sublabel: `${fmtGiornoMese(g)}${lavorate}`, evidenziata: g === oggi };
    }),
  );

  const attivi = $derived(staff.filter((s) => s.attivo || s.id === staffId));
</script>

{#if errore}
  <div class="fixed right-4 top-24 z-[9999] max-w-sm border-2 border-black bg-white p-3 font-black text-red-700 shadow-[-4px_4px_0_black]" role="alert">
    {errore}
  </div>
{/if}

{#if staff.length === 0}
  <section class="club-card bg-white p-5">
    <h2 class="text-2xl font-black">Nessun maestro</h2>
    <p class="mt-2 font-medium text-slate-700">
      Applica le migrazioni <code>20261123_ore_lavoro.sql</code> e <code>20261123_ore_lavoro_seed.sql</code> su Supabase.
    </p>
  </section>
{:else}
  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <section class="club-card bg-white p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="flex gap-2">
          <button type="button" class="club-btn px-3 py-2" aria-label="Settimana precedente" onclick={() => (lunedi = addGiorni(lunedi, -7))}>‹</button>
          <button type="button" class="club-btn px-3 py-2" onclick={() => (lunedi = lunediDi(oggiRoma()))}>Oggi</button>
          <button type="button" class="club-btn px-3 py-2" aria-label="Settimana successiva" onclick={() => (lunedi = addGiorni(lunedi, 7))}>›</button>
        </div>
        <h2 class="text-2xl font-black">{fmtSettimana(lunedi)}</h2>
        {#if caricamento}<span class="text-sm font-bold text-slate-500">caricamento…</span>{/if}

        <label class="ml-auto flex items-center gap-2 text-sm font-black uppercase">
          Maestro
          <select class="border-2 border-black px-2 py-1 text-base font-bold normal-case" bind:value={staffId}>
            {#each attivi as s (s.id)}
              <option value={s.id}>{s.nome}{s.sono_io ? ' (io)' : ''}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="mb-4 flex flex-wrap gap-2 text-xs font-black">
        {#each [['lavorato', 'Lavorato da calendario'], ['extra', 'Ore extra / sostituzioni fatte'], ['assente', 'Assente'], ['verifica', 'Da verificare']] as [chiave, etichetta] (chiave)}
          <span class="inline-flex items-center gap-1 border-2 border-black bg-white px-2 py-1">
            <span class="h-3 w-3 border border-black" style={`background:${COLORI[chiave as keyof typeof COLORI]}`}></span>
            {etichetta}
          </span>
        {/each}
      </div>

      <WeekGrid {colonne} {blocchi} slotPx={32} limiteInizio={8 * 60} minimoVisibile={{ inizio: 15 * 60, fine: 22 * 60 }}>
        {#snippet blocco(b)}
          <p class="wg-block-title">{b.titolo}</p>
          <p class="wg-block-time">{fmtFascia(b.inizio, b.fine)}</p>
          {#if b.sottotitolo}<p class="ol-nota">{b.sottotitolo}</p>{/if}
        {/snippet}
      </WeekGrid>
    </section>

    <div class="space-y-5">
      <section class="club-card bg-white p-5">
        <h2 class="mb-1 text-2xl font-black">Settimana</h2>
        <p class="mb-4 text-sm font-bold text-slate-600">{selezionato?.nome ?? ''}</p>

        {#if totale}
          <dl class="space-y-1 font-bold">
            <div class="ol-riga"><dt>Previste</dt><span class="ol-dots"></span><dd>{fmtDurata(totale.minuti_previsti)}</dd></div>
            <div class="ol-riga text-lg font-black"><dt>Lavorate</dt><span class="ol-dots"></span><dd>{fmtDurata(totale.minuti_lavorati)}</dd></div>
            <div class="ol-riga"><dt>Sostituzioni ed extra fatte</dt><span class="ol-dots"></span><dd>{fmtDurata(totale.minuti_sostituzioni)}</dd></div>
            <div class="ol-riga"><dt>Sostituito</dt><span class="ol-dots"></span><dd>{fmtDurata(totale.minuti_sostituito)}</dd></div>
            {#each totale.sostituito_da as s (s.sostituto_id)}
              <div class="ol-riga pl-4 text-sm text-slate-600"><dt>da {s.sostituto}</dt><span class="ol-dots"></span><dd>{fmtDurata(s.minuti)}</dd></div>
            {/each}
            <div class="ol-riga"><dt>Assente senza sostituto</dt><span class="ol-dots"></span><dd>{fmtDurata(totale.minuti_assente_senza_sostituto)}</dd></div>
            <div class="ol-riga border-t-2 border-black pt-1 font-black">
              <dt>Differenza</dt><span class="ol-dots"></span><dd>{fmtDurata(totale.minuti_differenza, true)}</dd>
            </div>
            {#if totale.giorni_da_verificare}
              <p class="pt-2 text-sm font-black" style={`color:#0369a1`}>
                {totale.giorni_da_verificare} {totale.giorni_da_verificare === 1 ? 'giorno' : 'giorni'} da verificare
              </p>
            {/if}
          </dl>
        {:else}
          <p class="font-bold text-slate-500">{caricamento ? 'Caricamento…' : 'Dati non disponibili.'}</p>
        {/if}
      </section>

      <StaffPanel {staff} onChange={(s) => (staff = s)} onErrore={flashErrore} />
    </div>
  </div>
{/if}

<style>
  .ol-nota {
    margin-top: 0.1rem;
    font-size: 0.6rem;
    font-weight: 600;
    line-height: 1.2;
    opacity: 0.85;
  }

  .ol-riga {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .ol-dots {
    flex: 1;
    min-width: 0.5rem;
    border-bottom: 2px dotted rgba(0, 0, 0, 0.35);
  }

  dd {
    white-space: nowrap;
  }
</style>
