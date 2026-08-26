<script lang="ts">
  import { slide } from 'svelte/transition';
  import TheBattleLocal from './TheBattleLocal.svelte';
  import TheBattleBot from './TheBattleBot.svelte';
  import type { Variant } from '../../lib/thebattle/variant';
  import { DIFFICULTY_LABEL, type BotDifficulty } from '../../lib/thebattle/bot';

  let mode: 'menu' | 'local' | 'bot' = 'menu';
  let localVariant: Variant = 'classic';
  let botDifficulty: BotDifficulty = 'medium';
  let rulesOpen = false;

  function startLocal(variant: Variant) {
    localVariant = variant;
    mode = 'local';
  }

  function startBot(difficulty: BotDifficulty) {
    botDifficulty = difficulty;
    mode = 'bot';
  }

  const BOT_DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];

  let createName = '';
  let createVariant: Variant = 'compact';
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
        body: JSON.stringify({ action: 'create', playerName: createName, variant: createVariant }),
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
  <TheBattleLocal variant={localVariant} onExit={() => (mode = 'menu')} />
{:else if mode === 'bot'}
  <TheBattleBot difficulty={botDifficulty} onExit={() => (mode = 'menu')} />
{:else}
  <section class="mb-8">
    <div class="flex items-center justify-between gap-3">
      <a href="/arcade" class="shrink-0 text-xs font-black uppercase tracking-widest text-black/60 hover:text-black">
        ← Arcade
      </a>
      <a href="/arcade/classifica" class="shrink-0 text-xs font-black uppercase tracking-widest text-black/60 hover:text-black">
        Classifica →
      </a>
    </div>
    <h1 class="text-5xl md:text-7xl font-black leading-none text-black">The Battle</h1>
    <p class="mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-slate-700">
      Scegli la casella da cui partire e la profondità del colpo. La palla schizza tra un campo e l'altro
      finché uno dei due non resta senza mosse valide.
    <button
      type="button"
      class="self-start shrink-0 text-xs font-black uppercase tracking-widest text-black/60 hover:text-black"
      aria-expanded={rulesOpen}
      aria-controls="thebattle-rules"
      on:click={() => (rulesOpen = !rulesOpen)}
      >
     {rulesOpen ? 'Nascondi regole' : 'QUI REGOLAMENTO COMPLETO'}
    </button></p>

    {#if rulesOpen}
      <div id="thebattle-rules" transition:slide={{ duration: 220 }}>
        <div class="mt-3 max-w-3xl border-2 border-black bg-black p-5 md:p-6 text-white flex flex-col gap-4">
          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--giallo-club)">
              La scacchiera
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              il campo è diviso in una scacchiera, divisa in due metà da 3x4 o 4×5 delimitate dalla rete al centro.
              La palla schizza tra le due metà.
            </p>
          </div>

          <div>
            <h3 class="font-black text-lg uppercase tracking-widest" style="color: var(--verde-tennis)">
              Le mosse
            </h3>
            <p class="mt-1 text-sm font-semibold leading-relaxed">
              Ogni giocatore ha un tot di mosse in base alla dimensione del campo. Un colpo usato
              non è più disponibile. La profondità del colpo indica il numero di caselle che la palla attraversa.
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
              Chi serve sceglie la casella di partenza nella propria metà e muove per primo.
              Poi ci si alterna. Perde chi, al proprio turno, non ha più nessuna mossa valida
              disponibile.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <div class="flex flex-col gap-8 max-w-xl mx-auto">
    <div class="club-card p-4">
      <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
        🎮 Giocate insieme qui
      </p>
      <p class="text-sm font-semibold text-slate-700 mb-4">
        Gioca con un tuo amico su questo dispositivo, uno di fronte all'altro.
      </p>

      <div class="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          class="club-btn flex-1 px-4 py-3 font-black uppercase tracking-widest"
          on:click={() => startLocal('compact')}
        >
          Compatta
          <span class="block text-xs font-bold normal-case tracking-normal mt-0.5">Campo 3×8</span>
        </button>
        <button
          type="button"
          class="club-btn flex-1 px-4 py-3 font-black uppercase tracking-widest"
          on:click={() => startLocal('classic')}
        >
          Estesa
          <span class="block text-xs font-bold normal-case tracking-normal mt-0.5">Campo 4×10</span>
        </button>
      </div>
    </div>

    <div class="club-card p-4">
      <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
        🤖 Gioca contro il bot
      </p>
      <p class="text-sm font-semibold text-slate-700 mb-4">
        Sfida il computer da solo. Per ora solo in modalità compatta (3×8).
      </p>

      <div class="flex flex-col gap-2 sm:flex-row">
        {#each BOT_DIFFICULTIES as difficulty (difficulty)}
          <button
            type="button"
            class="club-btn-pastelyellow flex-1 px-4 py-3 font-black uppercase tracking-widest"
            on:click={() => startBot(difficulty)}
          >
            {DIFFICULTY_LABEL[difficulty]}
          </button>
        {/each}
      </div>
    </div>

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
        <label for="tb-create-name" class="text-xs font-bold text-slate-600">
          Scegli la dimensione del campo: compatta 3x8, estesa 4x10
        </label>
        <div class="flex gap-2" role="radiogroup" aria-label="Modalità di gioco">
        
          <button
            type="button"
            role="radio"
            aria-checked={createVariant === 'compact'}
            class={`flex-1 px-3 py-2 font-black uppercase tracking-widest text-xs border-2 border-black ${createVariant === 'compact' ? 'bg-[var(--giallo-club)]' : 'bg-white'}`}
            on:click={() => (createVariant = 'compact')}
          >
            Compatta
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={createVariant === 'classic'}
            class={`flex-1 px-3 py-2 font-black uppercase tracking-widest text-xs border-2 border-black ${createVariant === 'classic' ? 'bg-[var(--giallo-club)]' : 'bg-white'}`}
            on:click={() => (createVariant = 'classic')}
          >
            Estesa
          </button>
        </div>
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
