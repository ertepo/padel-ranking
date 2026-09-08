<script lang="ts">
  import { tick } from 'svelte';

  export let prossimoNumero: number;

  type Ricevuta = {
    id: string;
    numero: number;
    data: string;
    nominativo: string;
    importo_lettere: string;
    causale: string;
    importo_cifre: number;
  };

  const oggi = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in ora locale

  const eur = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });

  // "1.234,56" o "1234.56" o "50" -> 1234.56 / 50 (NaN se non parsabile)
  function parseImporto(raw: string): number {
    const cleaned = raw
      .replace(/[€\s]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return NaN;
    return Number(cleaned);
  }

  let numeroMostrato = prossimoNumero;
  let data = oggi();
  let nominativo = '';
  let importoLettere = '';
  let causale = '';
  let importoCifreRaw = '';

  let saving = false;
  let errore = '';
  let conferma = '';
  let stampata: Ricevuta | null = null;

  $: importoCifre = parseImporto(importoCifreRaw);
  $: importoValido = Number.isFinite(importoCifre) && importoCifre > 0;
  $: importoAnteprima = importoValido ? eur.format(importoCifre) : '';

  function formattaImporto() {
    if (importoValido) importoCifreRaw = eur.format(importoCifre);
  }

  function resetForm() {
    data = oggi();
    nominativo = '';
    importoLettere = '';
    causale = '';
    importoCifreRaw = '';
    stampata = null;
    errore = '';
  }

  function formatData(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  async function salvaEStampa() {
    errore = '';
    conferma = '';

    if (!data || !nominativo.trim() || !importoLettere.trim() || !causale.trim()) {
      errore = 'Compila tutti i campi.';
      return;
    }
    if (!importoValido) {
      errore = 'Il totale deve essere un numero positivo.';
      return;
    }

    saving = true;

    try {
      const response = await fetch('/api/ricevute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          nominativo: nominativo.trim(),
          importo_lettere: importoLettere.trim(),
          causale: causale.trim(),
          importo_cifre: importoCifre,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ricevuta) {
        throw new Error(result.error || 'Errore nel salvataggio.');
      }

      stampata = result.ricevuta as Ricevuta;
      numeroMostrato = stampata.numero + 1;

      // il blocco #receipt deve essere nel DOM prima di lanciare la stampa
      await tick();
      window.print();

      conferma = `Ricevuta n° ${stampata.numero} salvata e inviata in stampa.`;
      resetForm();
    } catch (err) {
      errore = err instanceof Error ? err.message : 'Errore sconosciuto.';
    } finally {
      saving = false;
    }
  }
</script>

{#if conferma}
  <div
    class="fixed top-6 right-6 z-[9999] border-2 border-black bg-emerald-400 px-6 py-4 font-black text-lg"
    style="box-shadow: 6px 6px 0 black"
  >
    {conferma}
  </div>
{/if}

<form class="club-card max-w-xl space-y-5 bg-white p-5 md:p-6" on:submit|preventDefault={salvaEStampa}>
  <div>
    <span class="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
      Ricevuta n°
    </span>
    <p class="border-2 border-black bg-[var(--giallo-club)] p-3 text-2xl font-black">
      {numeroMostrato}
    </p>
    <p class="mt-1 text-xs font-medium text-slate-500">
      Numero provvisorio: quello definitivo viene assegnato al salvataggio.
    </p>
  </div>

  <div>
    <label for="data" class="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
      Data
    </label>
    <input
      id="data"
      type="date"
      bind:value={data}
      required
      class="w-full border-2 border-black bg-white p-3 font-bold"
    />
  </div>

  <div>
    <label for="nominativo" class="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
      Nominativo
    </label>
    <input
      id="nominativo"
      type="text"
      bind:value={nominativo}
      required
      placeholder="Chi riceve la ricevuta"
      class="w-full border-2 border-black bg-white p-3 font-bold"
    />
  </div>

  <div>
    <label for="importo-lettere" class="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
      Importo in lettere
    </label>
    <input
      id="importo-lettere"
      type="text"
      bind:value={importoLettere}
      required
      placeholder="Es. cinquanta/00"
      class="w-full border-2 border-black bg-white p-3 font-bold"
    />
  </div>

  <div>
    <label for="causale" class="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
      Causale
    </label>
    <input
      id="causale"
      type="text"
      bind:value={causale}
      required
      placeholder="Motivo del versamento"
      class="w-full border-2 border-black bg-white p-3 font-bold"
    />
  </div>

  <div>
    <label for="importo-cifre" class="mb-2 block text-xs font-black uppercase tracking-widest text-slate-600">
      Totale in cifre
    </label>
    <input
      id="importo-cifre"
      type="text"
      inputmode="decimal"
      bind:value={importoCifreRaw}
      on:blur={formattaImporto}
      required
      placeholder="€ 50,00"
      class="w-full border-2 border-black bg-white p-3 font-bold"
    />
    {#if importoAnteprima}
      <p class="mt-1 text-xs font-black text-slate-600">{importoAnteprima}</p>
    {/if}
  </div>

  {#if errore}
    <p class="border-2 border-black bg-rose-500 p-3 font-black text-white">{errore}</p>
  {/if}

  <button type="submit" class="club-btn w-full p-4 text-xl" disabled={saving}>
    {saving ? 'Salvataggio…' : 'Stampa'}
  </button>
</form>

{#if stampata}
  <div id="receipt" aria-hidden="true">
    <div class="r-head">ASD TIE-BREAK</div>
    <div class="r-sub">Poggio San Vicino</div>
    <div class="r-rule"></div>
    <div class="r-row"><span>Ricevuta n.</span><span>{stampata.numero}</span></div>
    <div class="r-row"><span>Data</span><span>{formatData(stampata.data)}</span></div>
    <div class="r-rule"></div>
    <div class="r-field"><span class="r-label">Ricevuto da</span>{stampata.nominativo}</div>
    <div class="r-field"><span class="r-label">Causale</span>{stampata.causale}</div>
    <div class="r-field"><span class="r-label">Importo in lettere</span>{stampata.importo_lettere}</div>
    <div class="r-rule"></div>
    <div class="r-total"><span>TOTALE</span><span>{eur.format(stampata.importo_cifre)}</span></div>
    <div class="r-rule"></div>
    <div class="r-foot">Firma _______________________</div>
  </div>
{/if}
