<script lang="ts">
  // Elenco di maestri e collaboratori: rinomina, ruolo, attivo/inattivo e
  // aggiunta. Non si eliminano (le eccezioni passate li citano): si disattivano.
  import { COLORI_IMPEGNO, type Ruolo, type Staff } from '../../lib/ore-lavoro/types';

  interface Props {
    staff: Staff[];
    onChange: (staff: Staff[]) => void;
    onErrore: (msg: string) => void;
  }

  let { staff, onChange, onErrore }: Props = $props();

  let nuovoNome = $state('');
  let nuovoRuolo: Ruolo = $state('collaboratore');
  let salvando = $state(false);

  async function chiama(method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<Staff | null> {
    try {
      const res = await fetch('/api/ore-lavoro/staff', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Errore nel salvataggio.');
      return result.staff as Staff;
    } catch (err) {
      onErrore(err instanceof Error ? err.message : 'Errore nel salvataggio.');
      return null;
    }
  }

  async function aggiorna(s: Staff, campi: Partial<Staff>) {
    const aggiornato = await chiama('PATCH', { id: s.id, ...campi });
    // In caso di errore si ridisegna con i valori precedenti.
    onChange(staff.map((x) => (x.id === s.id ? (aggiornato ?? { ...x }) : x)));
  }

  async function aggiungi() {
    if (!nuovoNome.trim()) return;
    salvando = true;
    const creato = await chiama('POST', { nome: nuovoNome, ruolo: nuovoRuolo });
    salvando = false;
    if (creato) {
      onChange([...staff, creato]);
      nuovoNome = '';
    }
  }
</script>

<section class="club-card bg-white p-5">
  <h2 class="mb-1 text-2xl font-black">Maestri e collaboratori</h2>
  <p class="mb-4 text-sm font-medium text-slate-600">
    Sono le persone tra cui scegliere il sostituto. Chi non lavora più si disattiva, così resta nello storico.
  </p>

  <div class="space-y-2">
    {#each staff as s (s.id)}
      <div class="flex flex-wrap items-center gap-2" class:opacity-50={!s.attivo}>
        <input
          class="min-w-0 flex-1 border-2 border-black px-2 py-1 font-bold"
          value={s.nome}
          aria-label="Nome"
          onchange={(e) => {
            const nome = (e.currentTarget as HTMLInputElement).value.trim();
            if (nome && nome !== s.nome) aggiorna(s, { nome });
            else (e.currentTarget as HTMLInputElement).value = s.nome;
          }}
        />
        {#if s.sono_io}
          <span class="border-2 border-black bg-[var(--giallo-club)] px-2 py-1 text-xs font-black uppercase">Io</span>
        {/if}
        <select
          class="border-2 border-black px-2 py-1 text-sm font-bold"
          value={s.ruolo}
          aria-label="Ruolo"
          onchange={(e) => aggiorna(s, { ruolo: (e.currentTarget as HTMLSelectElement).value as Ruolo })}
        >
          <option value="maestro">Maestro</option>
          <option value="collaboratore">Collaboratore</option>
        </select>
        {#if s.tennis !== undefined}
          <select
            class="border-2 border-black px-2 py-1 text-sm font-bold"
            style={`background:${Object.values(COLORI_IMPEGNO).includes(s.colore as never) ? s.colore : 'white'}`}
            value={s.colore}
            aria-label={`Colore fisso di ${s.nome}`}
            title="Colore con cui si vedono i suoi blocchi nella vista della persona affiancata"
            onchange={(e) => aggiorna(s, { colore: (e.currentTarget as HTMLSelectElement).value })}
          >
            {#if !Object.values(COLORI_IMPEGNO).includes(s.colore as never)}<option value={s.colore}>colore: —</option>{/if}
            {#each Object.entries(COLORI_IMPEGNO) as [nome, hex] (nome)}<option value={hex}>colore: {nome}</option>{/each}
          </select>
          <label class="flex items-center gap-1 text-sm font-bold" title="Lavora al tennis (se no ha solo impegni personali)">
            <input type="checkbox" checked={s.tennis} onchange={(e) => aggiorna(s, { tennis: (e.currentTarget as HTMLInputElement).checked })} />
            tennis
          </label>
        {/if}
        {#if s.affiancato_id !== undefined}
          <select
            class="border-2 border-black px-2 py-1 text-sm font-bold"
            value={s.affiancato_id ?? ''}
            aria-label={`Persona affiancata a ${s.nome}`}
            title="I turni della persona affiancata si possono vedere sempre nel calendario, senza tutti i colleghi"
            onchange={(e) => aggiorna(s, { affiancato_id: (e.currentTarget as HTMLSelectElement).value || null })}
          >
            <option value="">insieme a: —</option>
            {#each staff.filter((x) => x.id !== s.id) as x (x.id)}<option value={x.id}>insieme a: {x.nome}</option>{/each}
          </select>
        {/if}
        {#if !s.sono_io}
          <label class="flex items-center gap-1 text-sm font-bold">
            <input type="checkbox" checked={s.attivo} onchange={(e) => aggiorna(s, { attivo: (e.currentTarget as HTMLInputElement).checked })} />
            attivo
          </label>
        {/if}
      </div>
    {/each}
  </div>

  <form
    class="mt-5 flex flex-wrap items-end gap-2 border-t-2 border-black pt-4"
    onsubmit={(e) => {
      e.preventDefault();
      aggiungi();
    }}
  >
    <div class="min-w-0 flex-1">
      <label for="staff-nuovo-nome" class="mb-1 block text-xs font-black uppercase text-slate-600">Aggiungi</label>
      <input id="staff-nuovo-nome" class="w-full border-2 border-black px-2 py-1 font-bold" placeholder="Nome" bind:value={nuovoNome} />
    </div>
    <select class="border-2 border-black px-2 py-1 text-sm font-bold" bind:value={nuovoRuolo} aria-label="Ruolo del nuovo">
      <option value="maestro">Maestro</option>
      <option value="collaboratore">Collaboratore</option>
    </select>
    <button type="submit" class="club-btn-yellow px-4 py-2" disabled={salvando || !nuovoNome.trim()}>
      {salvando ? 'Salvo…' : 'Aggiungi'}
    </button>
  </form>
</section>
