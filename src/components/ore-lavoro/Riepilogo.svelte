<script lang="ts">
  // Totali di un periodo (settimana o mese), così come escono da
  // work_hours_summary: previste, lavorate, sostituzioni fatte, sostituito
  // (per sostituto), assente senza sostituto, differenza.
  import { fmtDurata } from '../../lib/time-grid';
  import type { RiepilogoOre } from '../../lib/ore-lavoro/types';

  interface Props {
    totale: RiepilogoOre;
  }

  let { totale }: Props = $props();
</script>

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
    <p class="pt-2 text-sm font-black" style="color:#0369a1">
      {totale.giorni_da_verificare} {totale.giorni_da_verificare === 1 ? 'giorno' : 'giorni'} da verificare
    </p>
  {/if}
</dl>

<style>
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
