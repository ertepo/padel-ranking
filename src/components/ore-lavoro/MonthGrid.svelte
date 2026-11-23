<script lang="ts">
  // Vista mensile compatta: un riquadro per giorno con le ore lavorate e i
  // colori dello stato (dai minuti calcolati in SQL):
  //   azzurro  da verificare
  //   giallo   assente (sostituito o no), con il nome del sostituto
  //   fucsia   ore extra / sostituzioni fatte
  //   verde    lavorato da calendario
  // Lo sfondo prende il colore più importante del giorno; sotto, una riga per
  // ogni stato presente. Clic su un giorno: si apre la sua settimana.
  import { GIORNI_BREVI, addGiorni, fmtDurata, giorniSettimana, isoDow, lunediDi, oggiRoma, ultimoDelMese } from '../../lib/time-grid';
  import { COLORI, type GiornoOre } from '../../lib/ore-lavoro/types';

  interface Props {
    /** Primo giorno del mese mostrato (AAAA-MM-01). */
    mese: string;
    giorni: GiornoOre[];
    onGiorno: (data: string) => void;
  }

  let { mese, giorni, onGiorno }: Props = $props();

  const oggi = oggiRoma();
  const perData = $derived(new Map(giorni.map((g) => [g.data, g])));

  // Settimane intere (lun-dom) che coprono il mese.
  const settimane = $derived.by(() => {
    const out: string[][] = [];
    const fine = ultimoDelMese(mese);
    for (let lun = lunediDi(mese); lun <= fine; lun = addGiorni(lun, 7)) out.push(giorniSettimana(lun));
    return out;
  });

  function coloreDi(g: GiornoOre | undefined): string | null {
    if (!g) return null;
    if (g.da_verificare) return COLORI.verifica;
    if (g.minuti_assenza > 0) return COLORI.assente;
    if (g.minuti_sostituzioni > 0) return COLORI.extra;
    if (g.minuti_previsti > 0) return COLORI.lavorato;
    return null;
  }

  const particolari = $derived(
    giorni.filter((g) => g.data.slice(0, 7) === mese.slice(0, 7) && (g.da_verificare || g.minuti_assenza > 0 || g.minuti_sostituzioni > 0)),
  );

  function sostituti(g: GiornoOre): string {
    const nomi = [...new Set(g.sostituito_da.filter((s) => s.sostituto).map((s) => s.sostituto))];
    return nomi.join(', ');
  }

  function sostituiti(g: GiornoOre): string {
    const nomi = [...new Set(g.sostituzioni.map((s) => s.assente ?? 'extra'))];
    return nomi.join(', ');
  }
</script>

<div class="mg border-2 border-black">
  {#each GIORNI_BREVI as g (g)}
    <div class="mg-head">{g}</div>
  {/each}

  {#each settimane as settimana (settimana[0])}
    {#each settimana as data (data)}
      {@const g = perData.get(data)}
      {@const fuori = data.slice(0, 7) !== mese.slice(0, 7)}
      {@const colore = fuori ? null : coloreDi(g)}
      <button
        type="button"
        class="mg-day"
        class:mg-fuori={fuori}
        class:mg-oggi={data === oggi}
        style={colore ? `background: color-mix(in oklab, ${colore} 55%, white)` : ''}
        onclick={() => onGiorno(data)}
        title="Apri la settimana"
      >
        <span class="mg-num">{Number(data.slice(8, 10))}</span>
        {#if g && !fuori && (g.minuti_previsti || g.minuti_lavorati)}
          <span class="mg-ore">{fmtDurata(g.minuti_lavorati)}</span>
          <span class="mg-pallini" aria-hidden="true">
            {#if g.da_verificare}<span style={`background:${COLORI.verifica}`}></span>{/if}
            {#if g.minuti_assenza > 0}<span style={`background:${COLORI.assente}`}></span>{/if}
            {#if g.minuti_sostituzioni > 0}<span style={`background:${COLORI.extra}`}></span>{/if}
          </span>
          <span class="mg-righe">
            {#if g.da_verificare}
              <span class="mg-chip" style={`background:${COLORI.verifica}`}>da verificare</span>
            {/if}
            {#if g.minuti_sostituito > 0}
              <span class="mg-chip" style={`background:${COLORI.assente}`}>→ {sostituti(g)} {fmtDurata(g.minuti_sostituito)}</span>
            {/if}
            {#if g.minuti_assente_senza_sostituto > 0}
              <span class="mg-chip" style={`background:${COLORI.assente}`}>assente {fmtDurata(g.minuti_assente_senza_sostituto)}</span>
            {/if}
            {#if g.minuti_sostituzioni > 0}
              <span class="mg-chip" style={`background:${COLORI.extra}`}>+{fmtDurata(g.minuti_sostituzioni)} {sostituiti(g)}</span>
            {/if}
          </span>
        {/if}
      </button>
    {/each}
  {/each}
</div>

<!-- Su telefono le etichette non entrano nei riquadri: i giorni particolari sono elencati qui. -->
{#if particolari.length}
  <ul class="mt-3 space-y-1 md:hidden">
    {#each particolari as g (g.data)}
      <li>
        <button type="button" class="flex w-full flex-wrap items-center gap-1 border-2 border-black bg-white px-2 py-1.5 text-left text-sm font-bold" onclick={() => onGiorno(g.data)}>
          <span class="mr-1 font-black">{GIORNI_BREVI[isoDow(g.data) - 1]} {Number(g.data.slice(8, 10))}</span>
          {#if g.da_verificare}<span class="mg-chip" style={`background:${COLORI.verifica}`}>da verificare</span>{/if}
          {#if g.minuti_sostituito > 0}<span class="mg-chip" style={`background:${COLORI.assente}`}>→ {sostituti(g)} {fmtDurata(g.minuti_sostituito)}</span>{/if}
          {#if g.minuti_assente_senza_sostituto > 0}<span class="mg-chip" style={`background:${COLORI.assente}`}>assente {fmtDurata(g.minuti_assente_senza_sostituto)}</span>{/if}
          {#if g.minuti_sostituzioni > 0}<span class="mg-chip" style={`background:${COLORI.extra}`}>+{fmtDurata(g.minuti_sostituzioni)} {sostituiti(g)}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .mg {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    background: white;
  }

  .mg-head {
    padding: 0.4rem 0.25rem;
    background: var(--giallo-club);
    border-bottom: 2px solid black;
    border-right: 1px solid rgba(0, 0, 0, 0.25);
    text-align: center;
    font-size: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  .mg-day {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    min-height: 5.5rem;
    padding: 0.3rem 0.35rem;
    border-right: 1px solid rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(0, 0, 0, 0.25);
    text-align: left;
    cursor: pointer;
  }

  .mg-day:hover {
    outline: 2px solid black;
    outline-offset: -2px;
  }

  .mg-fuori {
    background: #f1f5f9;
    color: #94a3b8;
  }

  .mg-oggi .mg-num {
    background: black;
    color: var(--giallo-club);
    padding: 0 0.3rem;
  }

  .mg-num {
    align-self: flex-start;
    font-size: 0.75rem;
    font-weight: 900;
  }

  .mg-ore {
    font-size: 1.05rem;
    font-weight: 900;
    line-height: 1;
  }

  .mg-righe {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .mg-pallini {
    display: none;
    gap: 2px;
  }

  .mg-pallini span {
    width: 0.5rem;
    height: 0.5rem;
    border: 1px solid black;
    border-radius: 999px;
  }

  @media (max-width: 767px) {
    .mg-day {
      min-height: 3.6rem;
      padding: 0.2rem;
    }

    .mg-ore {
      font-size: 0.72rem;
    }

    .mg-righe {
      display: none;
    }

    .mg-pallini {
      display: flex;
    }

    .mg-head {
      font-size: 0.65rem;
      padding: 0.3rem 0;
    }
  }

  .mg-chip {
    border: 1px solid black;
    padding: 0 0.25rem;
    font-size: 0.6rem;
    font-weight: 800;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
