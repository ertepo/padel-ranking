<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
  import type { GameState } from '../../lib/supertris/engine';
  import SuperTrisBoard from './SuperTrisBoard.svelte';

  type PublicGame = {
    id: string;
    pin: string;
    state: GameState;
    status: 'waiting' | 'active' | 'finished';
    player_x_name: string;
    player_o_name: string | null;
    created_at: string;
    updated_at: string;
  };

  export let id: string;
  export let initialGame: PublicGame | null;

  let game: PublicGame | null = initialGame;
  let mySymbol: 'X' | 'O' | null = null;
  let myToken: string | null = null;

  let joinName = '';
  let joining = false;
  let joinError = '';

  let moving = false;
  let moveError = '';
  let rematching = false;
  let copied = false;

  const TURN_BACKGROUND: Record<'X' | 'O', string> = { X: '#bfdbfe', O: '#fecaca' };

  let sb: ReturnType<typeof createClient> | null = null;
  let channel: RealtimeChannel | null = null;
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let rtTimeout: ReturnType<typeof setTimeout> | null = null;

  function loadSession() {
    try {
      const raw = window.localStorage.getItem(`supertris:${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.token && (parsed.symbol === 'X' || parsed.symbol === 'O')) {
        myToken = parsed.token;
        mySymbol = parsed.symbol;
      }
    } catch {
      // localStorage non disponibile o dato corrotto: si comporta da spettatore
    }
  }

  function storeSession(token: string, symbol: 'X' | 'O') {
    myToken = token;
    mySymbol = symbol;
    window.localStorage.setItem(`supertris:${id}`, JSON.stringify({ token, symbol }));
  }

  async function refreshGame() {
    if (!sb) return;
    const { data } = await sb
      .from('supertris_games')
      .select('id, pin, state, status, player_x_name, player_o_name, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (data) game = data as unknown as PublicGame;
  }

  function subscribeRealtime() {
    if (!sb) return;
    channel = sb
      .channel(`supertris_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'supertris_games', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.new) game = payload.new as unknown as PublicGame;
        },
      )
      .subscribe();
  }

  onMount(() => {
    loadSession();
    document.body.style.transition = 'background 200ms ease';
    const footer = document.querySelector('footer');
    if (footer) footer.style.display = 'none';

    const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON) return;

    sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    subscribeRealtime();

    rtTimeout = setTimeout(() => {
      if (channel?.state !== 'joined') {
        pollingInterval = setInterval(refreshGame, 3000);
      }
    }, 3000);
  });

  onDestroy(() => {
    if (sb && channel) sb.removeChannel(channel);
    if (pollingInterval) clearInterval(pollingInterval);
    if (rtTimeout) clearTimeout(rtTimeout);
    if (typeof document === 'undefined') return;
    document.body.style.background = '';
    const footer = document.querySelector('footer');
    if (footer) footer.style.display = '';
  });

  $: if (typeof document !== 'undefined') {
    document.body.style.background =
      game && game.status === 'active' ? TURN_BACKGROUND[game.state.currentPlayer] : '';
  }

  async function joinGame() {
    joining = true;
    joinError = '';
    try {
      const res = await fetch('/api/supertris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', id, playerName: joinName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore durante l’accesso alla partita.');
      storeSession(data.token, 'O');
      game = data.game as PublicGame;
    } catch (err) {
      joinError = err instanceof Error ? err.message : 'Errore imprevisto.';
    } finally {
      joining = false;
    }
  }

  async function handleMove(boardIndex: number, cellIndex: number) {
    if (!mySymbol || !myToken || moving || !game) return;
    moving = true;
    moveError = '';
    try {
      const res = await fetch('/api/supertris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', id, token: myToken, boardIndex, cellIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Mossa non valida.');
      game = { ...game, state: data.state, status: data.status };
    } catch (err) {
      moveError = err instanceof Error ? err.message : 'Errore imprevisto.';
    } finally {
      moving = false;
    }
  }

  async function rematch() {
    if (!myToken) return;
    rematching = true;
    try {
      const res = await fetch('/api/supertris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rematch', id, token: myToken }),
      });
      const data = await res.json();
      if (res.ok) game = data.game as PublicGame;
    } finally {
      rematching = false;
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }

  $: isMyTurn = !!game && !!mySymbol && game.status === 'active' && game.state.currentPlayer === mySymbol;
  $: leftSymbol = mySymbol === 'O' ? 'O' : 'X';
  $: rightSymbol = leftSymbol === 'X' ? 'O' : 'X';

  $: leftActive = !!game && game.status === 'active' && game.state.currentPlayer === leftSymbol;
  $: rightActive = !!game && game.status === 'active' && game.state.currentPlayer === rightSymbol;
  $: leftName = !game ? '' : leftSymbol === 'X' ? game.player_x_name : (game.player_o_name ?? 'In attesa…');
  $: rightName = !game ? '' : rightSymbol === 'X' ? game.player_x_name : (game.player_o_name ?? 'In attesa…');

  $: winnerLabel = (() => {
    if (!game?.state.winner) return '';
    if (game.state.winner === 'draw') return 'Pareggio!';
    const name = game.state.winner === 'X' ? game.player_x_name : game.player_o_name;
    return `Ha vinto ${name ?? game.state.winner}!`;
  })();
</script>

<div class="flex flex-col items-center gap-4">
  {#if !game}
    <div class="club-card p-6 text-center">
      <p class="font-black text-lg">Partita non trovata.</p>
      <a
        href="/arcade/supertris"
        class="club-btn-yellow inline-block mt-4 px-4 py-2 font-black uppercase tracking-widest"
      >
        Torna all’arcade
      </a>
    </div>
  {:else}
    <a
      href="/arcade/supertris"
      class="self-start text-xs font-black uppercase tracking-widest text-slate-600 hover:text-black"
    >
      ← Esci e torna al menu
    </a>

    <div class="flex gap-4 w-full max-w-xl mt-2 mb-4">
      <div
        class="flex-1 border-2 border-black px-3 py-3 text-center transition-shadow duration-150"
        class:ombra={leftActive}
        class:text-white={leftActive}
        style={leftActive ? `background:${leftSymbol === 'X' ? 'var(--blu-padel)' : 'var(--rosso-padel)'};` : 'background:white;'}
      >
        <p class="text-[10px] uppercase tracking-widest font-black opacity-70">
          {#if leftSymbol === mySymbol}Tu{:else if mySymbol}Avversario{:else}Giocatore{/if} · {leftSymbol}
        </p>
        <p class="font-black text-lg truncate">{leftName}</p>
      </div>

      <div
        class="flex-1 border-2 border-black px-3 py-3 text-center transition-shadow duration-150"
        class:ombra={rightActive}
        class:text-white={rightActive}
        style={rightActive ? `background:${rightSymbol === 'X' ? 'var(--blu-padel)' : 'var(--rosso-padel)'};` : 'background:white;'}
      >
        <p class="text-[10px] uppercase tracking-widest font-black opacity-70">
          {#if rightSymbol === mySymbol}Tu{:else if mySymbol}Avversario{:else}Giocatore{/if} · {rightSymbol}
        </p>
        <p class="font-black text-lg truncate">{rightName}</p>
      </div>
    </div>

    {#if game.status === 'finished'}
      <p class="text-2xl font-black text-center -mt-2 mb-2">{winnerLabel}</p>
    {/if}

    {#if game.status === 'waiting' && mySymbol === 'X'}
      <div class="club-card p-4 w-full max-w-xl text-center">
        <p class="font-black mb-2">In attesa di un avversario…</p>
        <p class="text-sm font-bold text-slate-600 mb-3">Condividi il link oppure comunica il PIN</p>
        <p class="text-4xl font-black tracking-[0.3em] mb-3">{game.pin}</p>
        <button
          type="button"
          class="club-btn-yellow px-4 py-2 font-black uppercase tracking-widest"
          on:click={copyLink}
        >
          {copied ? 'Link copiato!' : 'Copia link'}
        </button>
      </div>
    {:else if game.status === 'waiting' && !mySymbol}
      <div class="club-card p-4 w-full max-w-sm">
        <p class="font-black mb-3 text-center">Unisciti alla partita</p>
        <input
          type="text"
          maxlength="20"
          placeholder="Il tuo nome (opzionale)"
          class="w-full border border-dashed border-black bg-white px-3 py-2 font-black focus:outline-none mb-3"
          bind:value={joinName}
        />
        <button
          type="button"
          class="club-btn-blue w-full px-4 py-2 font-black uppercase tracking-widest disabled:opacity-50"
          disabled={joining}
          on:click={joinGame}
        >
          {joining ? 'Entro…' : 'Unisciti'}
        </button>
        {#if joinError}
          <p class="text-xs font-bold text-[var(--rosso-padel)] mt-2 text-center">{joinError}</p>
        {/if}
      </div>
    {:else}
      <SuperTrisBoard state={game.state} interactive={isMyTurn} onMove={handleMove} />
      {#if moveError}<p class="text-xs font-bold text-[var(--rosso-padel)]">{moveError}</p>{/if}
      {#if !mySymbol}
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">Modalità spettatore</p>
      {/if}

      {#if game.status === 'finished' && mySymbol === 'X'}
        <button
          type="button"
          class="club-btn-yellow px-4 py-2 font-black uppercase tracking-widest disabled:opacity-50"
          disabled={rematching}
          on:click={rematch}
        >
          {rematching ? 'Preparo la rivincita…' : 'Rivincita'}
        </button>
      {/if}
    {/if}
  {/if}
</div>
