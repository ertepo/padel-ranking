<script lang="ts">
  import { slide } from 'svelte/transition';
  import TheBattleLocal from './TheBattleLocal.svelte';

  let mode: 'menu' | 'local' = 'menu';
  let rulesOpen = false;

  let createName = '';
  let creating = false;
  let createError = '';

  let joinName = '';
  let joinPin = '';
  let joining = false;
  let joinError = '';

  function storeSession(id: string, token: string, symbol: 'A' | 'B') {
    window.localStorage.setItem(`thebattle:${id}`, JSON.stringify({ token, symbol }));
  }

  async function createGame() {
    creating = true;
    createError = '';
    try {
      const res = await fetch('/api/thebattle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', playerName: createName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore nella creazione della partita.');
      storeSession(data.id, data.token, 'A');
      window.location.href = `/arcade/thebattle/${data.id}`;
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Errore imprevisto.';
      creating = false;
    }
  }

  async function joinGame() {
    const pin = joinPin.trim();
    if (!/^\d{4}$/.test(pin)) {
      joinError = 'Inserisci un PIN di 4 cifre.';
      return;
    }
    joining = true;
    joinError = '';
    try {
      const res = await fetch('/api/thebattle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', pin, playerName: joinName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore durante l’accesso alla partita.');
      storeSession(data.id, data.token, 'B');
      window.location.href = `/arcade/thebattle/${data.id}`;
    } catch (err) {
      joinError = err instanceof Error ? err.message : 'Errore imprevisto.';
      joining = false;
    }
  }
</script>

{#if mode === 'local'}
  <TheBattleLocal onExit={() => (mode = 'menu')} />
{:else}
  <section class="mb-8">
    <p class="text-sm uppercase tracking-widest font-black text-slate-600">Arcade</p>
    <h1 class="text-5xl md:text-7xl font-black leading-none text-black">The Battle</h1>
    <p class="mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-slate-700">
      Un gettone, una scacchiera 4×10 divisa in due metà, 20 mosse a testa: manda il gettone
      nella metà avversaria finché l'altro non resta senza mosse valide.
    </p>

    <button
      type="button"
      class="club-btn-yellow mt-4 inline-flex items-center justify-center gap-2 px-5 py-3"
      aria-expanded={rulesOpen}
      aria-controls="thebattle-rules"
      on:click={() => (rulesOpen = !rulesOpen)}
    >
      {rulesOpen ? 'Nascondi regole' : 'Regole'}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class={`shrink-0 transition-transform ${rulesOpen ? 'rotate-180' : ''}`}
        aria-hidden="true"
      >
        <path d="M6 9L18 9L12 18L6 9Z" fill="currentColor" />
      </svg>
    </button>

    {#if rulesOpen}
      <div id="thebattle-rules" transition:slide={{ duration: 220 }}>
        <div class="mt-3 max-w-3xl border-2 border-black bg-black p-5 md:p-6 text-white flex flex-col gap-4">
          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
              La scacchiera
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              4 colonne × 10 righe, divise in due metà da 4×5: quella bassa è il territorio del
              Giocatore A, quella alta del Giocatore B. Un solo gettone condiviso si muove tra le
              due metà.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--verde-tennis)">
              Le mosse
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Ogni giocatore ha 20 mosse: 5 da 10 caselle, 5 da 8, 5 da 5 e 5 da 3. Una mossa usata
              non è più disponibile. Il percorso può avere al massimo un cambio di direzione a
              90°: tutto dritto, oppure dritto e poi una svolta.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--rosso-padel)">
              Dove puoi atterrare
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              La casella di arrivo deve restare dentro la scacchiera, cadere nella metà
              <b>avversaria</b> rispetto a chi muove (mai nella propria) ed essere libera. Le
              caselle solo attraversate durante il percorso restano libere: si occupano soltanto
              la casella di partenza iniziale e ogni casella di arrivo.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--blu-padel)">
              Come si vince
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Il Giocatore A sceglie la casella di partenza nella propria metà e muove per primo.
              Poi si alterna. Perde chi, al proprio turno, non ha più nessuna mossa valida
              disponibile.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <div class="flex flex-col gap-8 max-w-xl mx-auto">
    <button
      type="button"
      class="club-btn-yellow px-6 py-5 font-black uppercase tracking-widest text-xl"
      on:click={() => (mode = 'local')}
    >
      🎮 Gioca sullo stesso device
    </button>

    <div class="club-card p-4">
      <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-3">
        Sfida un amico online
      </p>

      <div class="flex flex-col gap-2 mb-6">
        <label for="tb-create-name" class="text-xs font-bold text-slate-600">
          Il tuo nome (opzionale)
        </label>
        <input
          id="tb-create-name"
          type="text"
          maxlength="20"
          placeholder="Es. Marco"
          class="w-full border border-dashed border-black bg-white px-3 py-2 font-black focus:outline-none"
          bind:value={createName}
        />
        <button
          type="button"
          class="club-btn-blue px-4 py-2 font-black uppercase tracking-widest self-start disabled:opacity-50"
          disabled={creating}
          on:click={createGame}
        >
          {creating ? 'Creo la partita…' : 'Crea nuova partita'}
        </button>
        {#if createError}
          <p class="text-xs font-bold text-[var(--rosso-padel)]">{createError}</p>
        {/if}
      </div>

      <hr class="border-dashed border-black/30 mb-6" />

      <div class="flex flex-col gap-2">
        <label for="tb-join-pin" class="text-xs font-bold text-slate-600">
          Hai un PIN? Inseriscilo qui
        </label>
        <input
          id="tb-join-pin"
          type="text"
          inputmode="numeric"
          maxlength="4"
          placeholder="0000"
          class="w-full border border-dashed border-black bg-white px-3 py-2 font-black text-2xl tracking-[0.3em] text-center focus:outline-none"
          bind:value={joinPin}
        />
        <input
          type="text"
          maxlength="20"
          placeholder="Il tuo nome (opzionale)"
          class="w-full border border-dashed border-black bg-white px-3 py-2 font-black focus:outline-none"
          bind:value={joinName}
        />
        <button
          type="button"
          class="club-btn-pastelgreen px-4 py-2 font-black uppercase tracking-widest self-start disabled:opacity-50"
          disabled={joining}
          on:click={joinGame}
        >
          {joining ? 'Entro…' : 'Entra nella partita'}
        </button>
        {#if joinError}
          <p class="text-xs font-bold text-[var(--rosso-padel)]">{joinError}</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
