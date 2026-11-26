<script lang="ts">
  // Vista mensile compatta: un riquadro per giorno. In alto il numero del
  // giorno e (a destra) le ore lavorate; sotto, a sinistra, una colonna di
  // bollini per tipo, uno per ora fatta (mezzo per la mezz'ora):
  //   verde lavorato · azzurro da verificare · fucsia extra/sostituzioni · arancio private
  // e a destra le note del giorno ("sostituzione Ludo 4h", "no atletica",
  // "assente 2h"). Su telefono le note sono elencate sotto il calendario.
  // Clic su un giorno: si apre la sua settimana.
  import { GIORNI_BREVI, addGiorni, fmtDurata, giorniSettimana, isoDow, lunediDi, oggiRoma, ultimoDelMese } from '../../lib/time-grid';
  import type { GiornoOre } from '../../lib/ore-lavoro/types';
  import type { RiassuntoGiorno } from '../../lib/ore-lavoro/mese';

  interface Props {
    /** Primo giorno del mese mostrato (AAAA-MM-01). */
    mese: string;
    giorni: GiornoOre[];
    /** Bollini e note di ogni giorno. */
    riassunti: Map<string, RiassuntoGiorno>;
    onGiorno: (data: string) => void;
  }

  let { mese, giorni, riassunti, onGiorno }: Props = $props();

  const oggi = oggiRoma();
  const perData = $derived(new Map(giorni.map((g) => [g.data, g])));

  // Settimane intere (lun-dom) che coprono il mese.
  const settimane = $derived.by(() => {
    const out: string[][] = [];
    const fine = ultimoDelMese(mese);
    for (let lun = lunediDi(mese); lun <= fine; lun = addGiorni(lun, 7)) out.push(giorniSettimana(lun));
    return out;
  });

  const delMese = (data: string) => data.slice(0, 7) === mese.slice(0, 7);

  const conNote = $derived(
    [...riassunti.entries()].filter(([d, r]) => delMese(d) && r.note.length > 0).sort(([a], [b]) => a.localeCompare(b)),
  );

  /**
   * Le colonne di bollini di un tipo (true = mezzaluna): al massimo 5 bollini
   * interi per colonna, più l'eventuale mezzaluna finale (5,5); dal sesto si
   * va a capo in una nuova colonna.
   */
  function colonneDi(mezzi: number): boolean[][] {
    const interi = Math.floor(mezzi / 2);
    const colonne: boolean[][] = [];
    for (let i = 0; i < interi; i += 5) colonne.push(Array(Math.min(5, interi - i)).fill(false));
    if (mezzi % 2) {
      if (colonne.length) colonne[colonne.length - 1].push(true);
      else colonne.push([true]);
    }
    return colonne;
  }
</script>

<div class="mg border-2 border-black">
  {#each GIORNI_BREVI as g (g)}
    <div class="mg-head">{g}</div>
  {/each}

  {#each settimane as settimana (settimana[0])}
    {#each settimana as data (data)}
      {@const g = perData.get(data)}
      {@const fuori = !delMese(data)}
      {@const r = fuori ? undefined : riassunti.get(data)}
      <button
        type="button"
        class="mg-day"
        class:mg-fuori={fuori}
        class:mg-oggi={data === oggi}
        onclick={() => onGiorno(data)}
        title="Apri la settimana"
      >
        <span class="mg-testa">
          <span class="mg-num">{Number(data.slice(8, 10))}</span>
          {#if g && !fuori && (g.minuti_previsti || g.minuti_lavorati)}
            <span class="mg-ore">{fmtDurata(g.minuti_lavorati)}</span>
          {/if}
        </span>
        {#if r}
          <span class="mg-corpo">
            <span class="mg-bollini" aria-hidden="true">
              {#each r.bollini as b, i (i)}
                {#each colonneDi(b.mezzi) as colonna, k (k)}
                  <span class="mg-colonna">
                    {#each colonna as mezzo, j (j)}
                      <span class="mg-bollino" class:mg-mezzo={mezzo} style={`background:${b.colore}`}></span>
                    {/each}
                  </span>
                {/each}
              {/each}
            </span>
            <span class="mg-note">
              {#each r.note as n, i (i)}
                <span class="mg-nota" style={`border-left-color:${n.colore}`}>{n.testo}</span>
              {/each}
            </span>
          </span>
        {/if}
      </button>
    {/each}
  {/each}
</div>

<!-- Su telefono le note non entrano nei riquadri: i giorni con note sono elencati qui. -->
{#if conNote.length}
  <ul class="mt-3 flex flex-col gap-1 md:hidden">
    {#each conNote as [data, r] (data)}
      <li>
        <button type="button" class="flex w-full flex-wrap items-center gap-1 border-2 border-black bg-white px-2 py-1.5 text-left text-sm font-bold" onclick={() => onGiorno(data)}>
          <span class="mr-1 font-black">{GIORNI_BREVI[isoDow(data) - 1]} {Number(data.slice(8, 10))}</span>
          {#each r.note as n, i (i)}
            <span class="mg-chip" style={`background:${n.colore}`}>{n.testo}</span>
          {/each}
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
    gap: 0.3rem;
    min-width: 0;
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

  .mg-testa {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.2rem;
  }

  .mg-num {
    font-size: 0.75rem;
    font-weight: 900;
  }

  .mg-ore {
    font-size: 0.95rem;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
  }

  .mg-corpo {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    min-width: 0;
  }

  /* Bollini: una colonna per tipo, un bollino per ora dall'alto in basso;
     la mezz'ora è una mezzaluna in fondo alla colonna. */
  .mg-bollini {
    display: flex;
    align-items: flex-start;
    gap: 2px;
    flex-shrink: 0;
  }

  .mg-colonna {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mg-bollino {
    width: 0.5rem;
    height: 0.5rem;
    border: 1px solid black;
    border-radius: 999px;
    box-sizing: border-box;
  }

  .mg-bollino.mg-mezzo {
    height: 0.25rem;
    border-bottom: none;
    border-radius: 999px 999px 0 0;
  }

  .mg-note {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    flex: 1;
  }

  .mg-nota {
    border-left: 4px solid;
    padding-left: 0.25rem;
    font-size: 0.65rem;
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .mg-chip {
    border: 1px solid black;
    padding: 0 0.25rem;
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1.35;
  }

  @media (max-width: 767px) {
    .mg-day {
      min-height: 3.6rem;
      padding: 0.2rem;
      gap: 0.2rem;
    }

    .mg-ore,
    .mg-num {
      font-size: 0.62rem;
    }

    .mg-testa {
      flex-wrap: wrap;
    }

    .mg-note {
      display: none;
    }


    .mg-head {
      font-size: 0.65rem;
      padding: 0.3rem 0;
    }
  }
</style>
