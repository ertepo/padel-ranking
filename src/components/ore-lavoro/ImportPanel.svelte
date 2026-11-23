<script lang="ts">
  // Import di un periodo da CSV (fasce in cui si è stati in campo): il file si
  // controlla subito nel browser, poi il server prepara un'anteprima del piano
  // e solo con "Importa" lo applica, tutto insieme.
  import { addGiorni, fmtData, fmtFascia, primoDelMese, timeToMinuti, ultimoDelMese, GIORNI_BREVI, isoDow } from '../../lib/time-grid';
  import { leggiCsvOre, type PianoImport } from '../../lib/ore-lavoro/csv';
  import type { Staff } from '../../lib/ore-lavoro/types';

  interface Props {
    staff: Staff[];
    persona: Staff;
    onImported: () => void;
    onErrore: (msg: string) => void;
  }

  let { staff, persona, onImported, onErrore }: Props = $props();

  let testo = $state('');
  let nomeFile = $state('');
  let erroriFile: string[] = $state([]);
  let righeLette = $state(0);
  let dal = $state('');
  let al = $state('');
  let conOrario = $state(false);
  let orarioFino = $state('');
  let sostitutoId: string | null = $state(null);
  let collegaId: string | null = $state(null);
  let sostituisci = $state(true);
  let anteprima: { righe: number; piano: PianoImport; eccezioni_da_togliere: number } | null = $state(null);
  let esito: Record<string, number> | null = $state(null);
  let inCorso = $state(false);

  const altri = $derived(staff.filter((s) => s.id !== persona.id));
  const nomeDi = (id: string | null) => (id ? (staff.find((s) => s.id === id)?.nome ?? '?') : '');

  async function scegliFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    anteprima = null;
    esito = null;
    if (!file) return;
    nomeFile = file.name;
    testo = await file.text();
    const { righe, errori } = leggiCsvOre(testo);
    erroriFile = errori;
    righeLette = righe.length;
    if (righe.length) {
      dal = primoDelMese(righe[0].data);
      al = ultimoDelMese(righe[righe.length - 1].data);
    }
  }

  async function invia(conferma: boolean) {
    inCorso = true;
    try {
      const res = await fetch('/api/ore-lavoro/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: persona.id,
          csv: testo,
          dal,
          al,
          orario_fino: conOrario && orarioFino ? orarioFino : null,
          sostituto_id: sostitutoId,
          collega_id: collegaId,
          sostituisci,
          conferma,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (result.errori) erroriFile = result.errori;
        throw new Error(result.error || "Errore nell'import.");
      }
      if (conferma) {
        esito = result.risultato;
        anteprima = null;
        onImported();
      } else {
        anteprima = result;
      }
    } catch (err) {
      onErrore(err instanceof Error ? err.message : "Errore nell'import.");
    } finally {
      inCorso = false;
    }
  }

  function importa() {
    if (!anteprima) return;
    const n = anteprima.eccezioni_da_togliere;
    const togli = sostituisci && n ? ` e togliere ${n} ${n === 1 ? 'eccezione esistente' : 'eccezioni esistenti'}` : '';
    if (confirm(`Importare il CSV per ${persona.nome} dal ${fmtData(dal)} al ${fmtData(al)}${togli}?`)) invia(true);
  }

  const durata = (e: { ora_inizio: string; ora_fine: string }) => timeToMinuti(e.ora_fine) - timeToMinuti(e.ora_inizio);
  const giorno = (data: string) => `${GIORNI_BREVI[isoDow(data) - 1]} ${fmtData(data).slice(0, 5)}`;

  const gruppi = $derived.by(() => {
    if (!anteprima) return null;
    const e = anteprima.piano.eccezioni;
    return {
      assenze: e.filter((x) => x.assente_id === persona.id),
      sostituzioni: e.filter((x) => x.sostituto_id === persona.id && x.assente_id),
      extra: e.filter((x) => x.sostituto_id === persona.id && !x.assente_id),
    };
  });
  const ore = (lista: { ora_inizio: string; ora_fine: string }[]) => {
    const m = lista.reduce((t, x) => t + durata(x), 0);
    return `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;
  };
</script>

<details class="club-card bg-white p-5">
  <summary class="cursor-pointer text-2xl font-black">Importa CSV</summary>

  <div class="mt-4 space-y-3">
    <p class="text-sm font-medium text-slate-600">
      Una riga per fascia in cui {persona.sono_io ? 'eri' : `${persona.nome} era`} in campo:
      <code>data,inizio,fine,ore,tipo,note</code>, tipo <code>lavorato</code>, <code>da_verificare</code>,
      <code>sostituzione</code> o <code>extra</code>. Le assenze si deducono dall'orario.
    </p>

    <input type="file" accept=".csv,text/csv" class="block w-full text-sm font-bold" onchange={scegliFile} />

    {#if nomeFile}
      <p class="text-sm font-bold">{nomeFile}: {righeLette} righe valide</p>
    {/if}
    {#if erroriFile.length}
      <ul class="border-2 border-red-700 p-2 text-sm font-bold text-red-700">
        {#each erroriFile.slice(0, 10) as e (e)}<li>{e}</li>{/each}
        {#if erroriFile.length > 10}<li>… e altri {erroriFile.length - 10}</li>{/if}
      </ul>
    {/if}

    {#if righeLette && !erroriFile.length}
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="imp-dal" class="mb-1 block text-xs font-black uppercase text-slate-600">Dal</label>
          <input id="imp-dal" type="date" class="w-full border-2 border-black p-2 font-bold" bind:value={dal} onchange={() => (anteprima = null)} />
        </div>
        <div>
          <label for="imp-al" class="mb-1 block text-xs font-black uppercase text-slate-600">Al</label>
          <input id="imp-al" type="date" class="w-full border-2 border-black p-2 font-bold" bind:value={al} onchange={() => (anteprima = null)} />
        </div>
      </div>

      <label class="flex items-start gap-2 text-sm font-bold">
        <input type="checkbox" class="mt-1" bind:checked={conOrario} onchange={() => { anteprima = null; if (conOrario && !orarioFino) orarioFino = addGiorni(dal, 30); }} />
        <span>Fino a una data, i turni previsti sono le fasce del CSV (per un periodo senza orario regolare)</span>
      </label>
      {#if conOrario}
        <div>
          <label for="imp-fino" class="mb-1 block text-xs font-black uppercase text-slate-600">Fino al (compreso)</label>
          <input id="imp-fino" type="date" class="w-full border-2 border-black p-2 font-bold" bind:value={orarioFino} onchange={() => (anteprima = null)} />
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="imp-sost" class="mb-1 block text-xs font-black uppercase text-slate-600">Sostituto nelle assenze</label>
          <select id="imp-sost" class="w-full border-2 border-black p-2 font-bold" bind:value={sostitutoId} onchange={() => (anteprima = null)}>
            <option value={null}>— nessuno —</option>
            {#each altri as s (s.id)}<option value={s.id}>{s.nome}</option>{/each}
          </select>
        </div>
        <div>
          <label for="imp-coll" class="mb-1 block text-xs font-black uppercase text-slate-600">Collega nelle sostituzioni</label>
          <select id="imp-coll" class="w-full border-2 border-black p-2 font-bold" bind:value={collegaId} onchange={() => (anteprima = null)}>
            <option value={null}>chi aveva il turno</option>
            {#each altri as s (s.id)}<option value={s.id}>{s.nome}</option>{/each}
          </select>
        </div>
      </div>

      <label class="flex items-start gap-2 text-sm font-bold">
        <input type="checkbox" class="mt-1" bind:checked={sostituisci} onchange={() => (anteprima = null)} />
        <span>Togli prima le eccezioni e i giorni segnati di {persona.nome} nel periodo</span>
      </label>

      <button type="button" class="club-btn w-full py-2" disabled={inCorso || !dal || !al} onclick={() => invia(false)}>
        {inCorso && !anteprima ? 'Preparo…' : 'Anteprima'}
      </button>
    {/if}

    {#if anteprima && gruppi}
      {@const piano = anteprima.piano}
      <div class="space-y-3 border-2 border-black p-3 text-sm">
        <p class="font-black">
          {anteprima.righe} righe · dal {fmtData(piano.dal)} al {fmtData(piano.al)}
          {#if piano.ignorate} · {piano.ignorate} fuori periodo, ignorate{/if}
        </p>
        {#if sostituisci}
          <p class="font-bold">Eccezioni esistenti da togliere: {anteprima.eccezioni_da_togliere}</p>
        {/if}

        {#if piano.orario}
          <div>
            <p class="font-black">Orario dal CSV, {fmtData(piano.orario.dal)}–{fmtData(piano.orario.al)} ({piano.periodi.length} periodi)</p>
            <ul class="mt-1 space-y-0.5 font-medium">
              {#each piano.periodi as p (p.valido_dal)}
                <li>
                  {fmtData(p.valido_dal).slice(0, 5)}–{fmtData(p.valido_al).slice(0, 5)}:
                  {p.turni.map((t) => `${GIORNI_BREVI[t.giorno_settimana - 1]} ${fmtFascia(timeToMinuti(t.ora_inizio), timeToMinuti(t.ora_fine))}`).join(', ')}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#each [
          ['Assenze', gruppi.assenze, '#fde047'],
          ['Sostituzioni fatte', gruppi.sostituzioni, '#f0abfc'],
          ['Ore extra', gruppi.extra, '#f0abfc'],
        ] as [titolo, lista, colore] (titolo)}
          {@const l = lista as PianoImport['eccezioni']}
          <div>
            <p class="font-black">
              <span class="mr-1 inline-block h-3 w-3 border border-black align-middle" style={`background:${colore}`}></span>
              {titolo}: {l.length} ({ore(l)})
            </p>
            <ul class="mt-1 max-h-40 space-y-0.5 overflow-y-auto font-medium">
              {#each l as e, i (i)}
                <li>
                  {giorno(e.data)} {fmtFascia(timeToMinuti(e.ora_inizio), timeToMinuti(e.ora_fine))}
                  {#if e.assente_id === persona.id}· {e.sostituto_id ? `sostituito da ${nomeDi(e.sostituto_id)}` : 'senza sostituto'}{/if}
                  {#if e.assente_id && e.assente_id !== persona.id}· al posto di {nomeDi(e.assente_id)}{/if}
                </li>
              {:else}
                <li class="text-slate-500">nessuna</li>
              {/each}
            </ul>
          </div>
        {/each}

        <div>
          <p class="font-black">
            <span class="mr-1 inline-block h-3 w-3 border border-black align-middle" style="background:#7dd3fc"></span>
            Giorni da verificare: {piano.giorni.length}
          </p>
          <ul class="mt-1 font-medium">
            {#each piano.giorni as g (g.data)}<li>{giorno(g.data)}{g.note ? ` · ${g.note}` : ''}</li>{/each}
          </ul>
        </div>

        <button type="button" class="club-btn-yellow w-full py-3" disabled={inCorso} onclick={importa}>
          {inCorso ? 'Importo…' : 'Importa'}
        </button>
      </div>
    {/if}

    {#if esito}
      <p class="border-2 border-black bg-[var(--giallo-club)] p-2 text-sm font-black">
        Import fatto: {esito.periodi} periodi d'orario, {esito.eccezioni} eccezioni, {esito.giorni} giorni da verificare
        {#if esito.eccezioni_rimosse}· {esito.eccezioni_rimosse} eccezioni precedenti tolte{/if}.
      </p>
    {/if}
  </div>
</details>
