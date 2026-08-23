<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
  import {
    MOVE_LENGTHS,
    getReachableDestinations,
    type GameState,
    type MoveLength,
    type Position,
  } from '../../lib/thebattle/engine';
  import TheBattleBoard from './TheBattleBoard.svelte';
  import TheBattleLengthTile from './TheBattleLengthTile.svelte';

  type PublicGame = {
    id: string;
    pin: string;
    state: GameState;
    status: 'waiting' | 'active' | 'finished';
    player_a_name: string;
    player_b_name: string | null;
    created_at: string;
    updated_at: string;
  };

  export let id: string;
  export let initialGame: PublicGame | null;

  let game: PublicGame | null = initialGame;
  let mySymbol: 'A' | 'B' | null = null;
  let myToken: string | null = null;

  let joinName = '';
  let joining = false;
  let joinError = '';

  let selectedLength: MoveLength | null = null;
  let moving = false;
  let moveError = '';
  let rematching = false;
  let copied = false;

  const TURN_BACKGROUND: Record<'A' | 'B', string> = { A: '#bfdbfe', B: '#fecaca' };

  let sb: ReturnType<typeof createClient> | null = null;
  let channel: RealtimeChannel | null = null;
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let rtTimeout: ReturnType<typeof setTimeout> | null = null;

  function loadSession() {
    try {
      const raw = window.localStorage.getItem(`thebattle:${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.token && (parsed.symbol === 'A' || parsed.symbol === 'B')) {
        myToken = parsed.token;
        mySymbol = parsed.symbol;
      }
    } catch {
      // localStorage non disponibile o dato corrotto: si comporta da spettatore
    }
  }

  function storeSession(token: string, symbol: 'A' | 'B') {
    myToken = token;
    mySymbol = symbol;
    window.localStorage.setItem(`thebattle:${id}`, JSON.stringify({ token, symbol }));
  }

  async function refreshGame() {
    if (!sb) return;
    const { data } = await sb
      .from('the_battle_games')
      .select('id, pin, state, status, player_a_name, player_b_name, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (data) game = data as unknown as PublicGame;
  }

  function subscribeRealtime() {
    if (!sb) return;
    channel = sb
      .channel(`the_battle_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'the_battle_games', filter: `id=eq.${id}` },
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
      const res = await fetch('/api/thebattle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', id, playerName: joinName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore durante l’accesso alla partita.');
      storeSession(data.token, 'B');
      game = data.game as PublicGame;
    } catch (err) {
      joinError = err instanceof Error ? err.message : 'Errore imprevisto.';
    } finally {
      joining = false;
    }
  }

  function ownHalfCells(): Position[] {
    const cells: Position[] = [];
    for (let row = 0; row <= 4; row++) {
      for (let col = 0; col < 4; col++) cells.push({ row, col });
    }
    return cells;
  }

  $: reachable =
    !game || !isMyTurn
      ? []
      : game.state.status === 'placement'
        ? ownHalfCells()
        : game.state.status === 'active' && selectedLength
          ? getReachableDestinations(game.state, selectedLength)
          : [];

  function lengthPlayable(length: MoveLength): boolean {
    if (!game) return false;
    return (
      game.state.moveCounts[game.state.currentPlayer][length] > 0 &&
      getReachableDestinations(game.state, length).length > 0
    );
  }

  function selectLength(length: MoveLength) {
    if (!isMyTurn || !lengthPlayable(length)) return;
    selectedLength = selectedLength === length ? null : length;
  }

  async function handleCellClick(row: number, col: number) {
    if (!mySymbol || !myToken || moving || !game || !isMyTurn) return;
    moving = true;
    moveError = '';
    try {
      const body =
        game.state.status === 'placement'
          ? { action: 'place', id, token: myToken, row, col }
          : { action: 'move', id, token: myToken, length: selectedLength, row, col };
      const res = await fetch('/api/thebattle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Mossa non valida.');
      game = { ...game, state: data.state, status: data.status };
      selectedLength = null;
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
      const res = await fetch('/api/thebattle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rematch', id, token: myToken }),
      });
      const data = await res.json();
      if (res.ok) {
        game = data.game as PublicGame;
        selectedLength = null;
      }
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

  $: isMyTurn =
    !!game && !!mySymbol && game.status === 'active' && game.state.status !== 'finished' && game.state.currentPlayer === mySymbol;
  $: leftSymbol = mySymbol === 'B' ? 'B' : 'A';
  $: rightSymbol = leftSymbol === 'A' ? 'B' : 'A';

  $: leftActive = !!game && isMyTurnFor(leftSymbol);
  $: rightActive = !!game && isMyTurnFor(rightSymbol);
  function isMyTurnFor(symbol: 'A' | 'B'): boolean {
    return !!game && game.status === 'active' && game.state.status !== 'finished' && game.state.currentPlayer === symbol;
  }
  $: leftName = !game ? '' : leftSymbol === 'A' ? game.player_a_name : (game.player_b_name ?? 'In attesa…');
  $: rightName = !game ? '' : rightSymbol === 'A' ? game.player_a_name : (game.player_b_name ?? 'In attesa…');

  $: winnerLabel = (() => {
    if (!game || game.state.status !== 'finished' || !game.state.winner) return '';
    const name = game.state.winner === 'A' ? game.player_a_name : game.player_b_name;
    return `Ha vinto ${name ?? `Giocatore ${game.state.winner}`}!`;
  })();
</script>

<div class="flex flex-col items-center gap-4">
  {#if !game}
    <div class="club-card p-6 text-center">
      <p class="font-black text-lg">Partita non trovata.</p>
      <a
        href="/arcade/thebattle"
        class="club-btn-yellow inline-block mt-4 px-4 py-2 font-black uppercase tracking-widest"
      >
        Torna all’arcade
      </a>
    </div>
  {:else}
    <a
      href="/arcade/thebattle"
      class="self-start text-xs font-black uppercase tracking-widest text-slate-600 hover:text-black"
    >
      ← Esci e torna al menu
    </a>

    <div class="flex gap-4 w-full max-w-xl mt-2 mb-4">
      <div
        class="flex-1 border-2 border-black px-3 py-3 text-center transition-shadow duration-150"
        class:ombra={leftActive}
        class:text-white={leftActive}
        style={leftActive ? `background:${leftSymbol === 'A' ? 'var(--blu-padel)' : 'var(--rosso-padel)'};` : 'background:white;'}
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
        style={rightActive ? `background:${rightSymbol === 'A' ? 'var(--blu-padel)' : 'var(--rosso-padel)'};` : 'background:white;'}
      >
        <p class="text-[10px] uppercase tracking-widest font-black opacity-70">
          {#if rightSymbol === mySymbol}Tu{:else if mySymbol}Avversario{:else}Giocatore{/if} · {rightSymbol}
        </p>
        <p class="font-black text-lg truncate">{rightName}</p>
      </div>
    </div>

    {#if game.state.status === 'finished'}
      <p class="text-2xl font-black text-center -mt-2 mb-2">{winnerLabel}</p>
    {/if}

    {#if game.status === 'waiting' && mySymbol === 'A'}
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
      {#if isMyTurn && game.state.status === 'active'}
        <div class="flex gap-3 flex-wrap justify-center">
          {#each MOVE_LENGTHS as length (length)}
            {#if game.state.moveCounts[game.state.currentPlayer][length] > 0}
              <TheBattleLengthTile
                {length}
                count={game.state.moveCounts[game.state.currentPlayer][length]}
                disabled={!lengthPlayable(length)}
                selected={selectedLength === length}
                onClick={() => selectLength(length)}
              />
            {/if}
          {/each}
        </div>
      {/if}

      {#if isMyTurn && game.state.status === 'placement'}
        <p class="text-xs font-black uppercase tracking-widest text-center text-slate-700">
          Tocca una casella nella tua metà per iniziare.
        </p>
      {/if}

      <TheBattleBoard state={game.state} interactive={isMyTurn} {reachable} onCellClick={handleCellClick} />

      {#if moveError}<p class="text-xs font-bold text-[var(--rosso-padel)]">{moveError}</p>{/if}
      {#if !mySymbol}
        <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">Modalità spettatore</p>
      {/if}

      {#if game.state.status === 'finished' && mySymbol === 'A'}
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
