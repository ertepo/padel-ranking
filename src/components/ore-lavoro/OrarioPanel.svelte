<script lang="ts">
  // I periodi dell'orario ricorrente di un maestro: turni, date di validità,
  // chiusura ed eliminazione di un periodo. I turni si cambiano dalla griglia
  // (scheda "da qui in poi" del modale).
  import { GIORNI_BREVI, fmtData, fmtFascia, timeToMinuti } from '../../lib/time-grid';
  import { ATTIVITA, CLUB, type PeriodoOrario } from '../../lib/ore-lavoro/types';

  interface Props {
    staffId: string;
    nome: string;
    /** Cambia a ogni salvataggio fatto altrove, per ricaricare. */
    versione: number;
    onChanged: () => void;
    onErrore: (msg: string) => void;
  }

  let { staffId, nome, versione, onChanged, onErrore }: Props = $props();

  let periodi: PeriodoOrario[] = $state([]);
  let caricamento = $state(false);
  let fineInModifica: string | null = $state(null);
  let nuovaFine = $state('');
  let richiesta = 0;

  async function carica(id: string) {
    const n = ++richiesta;
    caricamento = true;
    try {
      const res = await fetch(`/api/ore-lavoro/orario?staff=${id}`);
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore nel caricamento.');
      if (n === richiesta) periodi = result.periodi;
    } catch (err) {
      if (n === richiesta) onErrore(err instanceof Error ? err.message : 'Errore nel caricamento.');
    } finally {
      if (n === richiesta) caricamento = false;
    }
  }

  $effect(() => {
    versione;
    carica(staffId);
  });

  async function chiama(method: 'PATCH' | 'DELETE', body: unknown) {
    try {
      const res = await fetch('/api/ore-lavoro/orario', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio.');
      onChanged();
      return true;
    } catch (err) {
      onErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
      return false;
    }
  }

  async function salvaFine(p: PeriodoOrario) {
    if (await chiama('PATCH', { schedule_id: p.id, valido_al: nuovaFine || null })) fineInModifica = null;
  }

  async function elimina(p: PeriodoOrario) {
    const quando = `dal ${fmtData(p.valido_dal)}${p.valido_al ? ` al ${fmtData(p.valido_al)}` : ''}`;
    if (!confirm(`Eliminare l'orario di ${nome} ${quando}? In quei giorni non risulterà nessun turno previsto.`)) return;
    await chiama('DELETE', { schedule_id: p.id });
  }

  const durata = (p: PeriodoOrario) =>
    p.turni.reduce((tot, t) => tot + timeToMinuti(t.ora_fine) - timeToMinuti(t.ora_inizio), 0);
</script>

<section class="club-card bg-white p-5">
  <h2 class="mb-1 text-2xl font-black">Orario di {nome}</h2>
  <p class="mb-4 text-sm font-medium text-slate-600">
    Per cambiare un turno da una certa data in poi, cliccalo nel calendario e scegli "da qui in poi".
  </p>

  {#if caricamento && periodi.length === 0}
    <p class="font-bold text-slate-500">Caricamento…</p>
  {:else if periodi.length === 0}
    <p class="font-bold text-slate-500">Nessun orario. Clicca una cella vuota del calendario e scegli "da qui in poi".</p>
  {/if}

  <div class="space-y-4">
    {#each periodi as p (p.id)}
      <div class="border-2 border-black p-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-black">
            dal {fmtData(p.valido_dal)} {p.valido_al ? `al ${fmtData(p.valido_al)}` : '· in corso'}
          </p>
          <p class="text-xs font-black text-slate-600">{Math.floor(durata(p) / 60)}h{durata(p) % 60 ? String(durata(p) % 60).padStart(2, '0') : ''} a settimana</p>
        </div>

        <ul class="mt-2 space-y-0.5 text-sm font-bold">
          {#each p.turni as t (t.id)}
            <li>
              {GIORNI_BREVI[t.giorno_settimana - 1]}
              {fmtFascia(timeToMinuti(t.ora_inizio), timeToMinuti(t.ora_fine))}
              <span class="text-slate-600">· {ATTIVITA[t.attivita]}{t.club !== 'cingoli' ? ` · ${CLUB[t.club]}` : ''}</span>
            </li>
          {:else}
            <li class="text-slate-500">Nessun turno.</li>
          {/each}
        </ul>

        {#if fineInModifica === p.id}
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <label for={`fine-${p.id}`} class="text-xs font-black uppercase text-slate-600">Fine</label>
            <input id={`fine-${p.id}`} type="date" class="border-2 border-black px-2 py-1 font-bold" bind:value={nuovaFine} />
            <button type="button" class="club-btn-yellow px-3 py-1 text-sm" onclick={() => salvaFine(p)}>Salva</button>
            <button type="button" class="club-btn px-3 py-1 text-sm" onclick={() => (fineInModifica = null)}>Annulla</button>
          </div>
          <p class="mt-1 text-xs font-medium text-slate-600">Lascia vuoto per un orario senza fine.</p>
        {:else}
          <div class="mt-3 flex gap-3 text-xs font-black uppercase">
            <button
              type="button"
              class="underline"
              onclick={() => {
                fineInModifica = p.id;
                nuovaFine = p.valido_al ?? '';
              }}
            >
              {p.valido_al ? 'Cambia la fine' : 'Termina'}
            </button>
            <button type="button" class="text-red-700 underline" onclick={() => elimina(p)}>Elimina</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>
