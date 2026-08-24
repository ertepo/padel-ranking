<script lang="ts">
  import SuperTrisLocal from './SuperTrisLocal.svelte';
  import SuperTrisBot from './SuperTrisBot.svelte';
  import { DIFFICULTY_LABEL, type BotDifficulty } from '../../lib/supertris/bot';

  let mode: 'menu' | 'local' | 'bot' = 'menu';
  let botDifficulty: BotDifficulty = 'medium';

  function startBot(difficulty: BotDifficulty) {
    botDifficulty = difficulty;
    mode = 'bot';
  }

  const BOT_DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard'];

  let createName = '';
  let creating = false;
  let createError = '';

  let joinName = '';
  let joinPin = '';
  let joining = false;
  let joinError = '';

  function storeSession(id: string, token: string, symbol: 'X' | 'O') {
    window.localStorage.setItem(`supertris:${id}`, JSON.stringify({ token, symbol }));
  }

  async function createGame() {
    creating = true;
    createError = '';
    try {
      const res = await fetch('/api/supertris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', playerName: createName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore nella creazione della partita.');
      storeSession(data.id, data.token, 'X');
      window.location.href = `/arcade/supertris/${data.id}`;
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
      const res = await fetch('/api/supertris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', pin, playerName: joinName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore durante l’accesso alla partita.');
      storeSession(data.id, data.token, 'O');
      window.location.href = `/arcade/supertris/${data.id}`;
    } catch (err) {
      joinError = err instanceof Error ? err.message : 'Errore imprevisto.';
      joining = false;
    }
  }
</script>

{#if mode === 'local'}
  <SuperTrisLocal onExit={() => (mode = 'menu')} />
{:else if mode === 'bot'}
  <SuperTrisBot difficulty={botDifficulty} onExit={() => (mode = 'menu')} />
{:else}
  <section class="mb-8">
    <p class="text-sm uppercase tracking-widest font-black text-slate-600">Arcade</p>
    <h1 class="text-5xl md:text-7xl font-black leading-none text-black">Super Tris</h1>
    <p class="mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-slate-700">
      Il tris definitivo: 9 riquadri, una regola in più. La cella che scegli decide dove dovrà
      giocare l'avversario. Gioca sullo stesso telefono oppure sfida un amico online.
    </p>
  </section>

  <div class="flex flex-col gap-8 max-w-xl mx-auto">
    <button
      type="button"
      class="club-btn-yellow px-6 py-5 font-black uppercase tracking-widest text-xl"
      on:click={() => (mode = 'local')}
    >
      🎮 Sfida in locale
    </button>

    <div class="club-card p-4">
      <p class="text-xs uppercase tracking-widest font-black text-slate-600 mb-1">
        🤖 Gioca contro il bot
      </p>
      <p class="text-sm font-semibold text-slate-700 mb-4">
        Sfida il computer da solo
      </p>

      <div class="flex flex-col gap-2 sm:flex-row">
        {#each BOT_DIFFICULTIES as difficulty (difficulty)}
          <button
            type="button"
            class="club-btn-pastelblue flex-1 px-4 py-3 font-black uppercase tracking-widest"
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
        <label for="st-create-name" class="text-xs font-bold text-slate-600">
          Il tuo nome (opzionale)
        </label>
        <input
          id="st-create-name"
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
        <label for="st-join-pin" class="text-xs font-bold text-slate-600">
          Hai un PIN? Inseriscilo qui
        </label>
        <input
          id="st-join-pin"
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
