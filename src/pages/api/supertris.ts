import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { createInitialState, tryMove, type Player } from '../../lib/supertris/engine';

export const prerender = false;

const NAME_MAX_LENGTH = 20;
const PIN_RETRY_LIMIT = 10;

function sanitizeName(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim().slice(0, NAME_MAX_LENGTH) : '';
  return trimmed || 'Giocatore';
}

function randomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function publicRow(row: Record<string, unknown>) {
  const { player_x_token: _x, player_o_token: _o, ...rest } = row;
  return rest;
}

export const POST: APIRoute = async ({ request }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let body: {
    action?: string;
    id?: unknown;
    pin?: unknown;
    token?: unknown;
    playerName?: unknown;
    boardIndex?: unknown;
    cellIndex?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (body.action === 'create') {
    const playerName = sanitizeName(body.playerName);

    let lastError: string | null = null;
    for (let attempt = 0; attempt < PIN_RETRY_LIMIT; attempt += 1) {
      const pin = randomPin();
      const { data, error } = await supabase
        .from('supertris_games')
        .insert({
          pin,
          state: createInitialState(),
          status: 'waiting',
          player_x_name: playerName,
        })
        .select('id, pin, player_x_token')
        .single();

      if (!error) {
        return Response.json({
          id: data.id,
          token: data.player_x_token,
          symbol: 'X',
          pin: data.pin,
        });
      }

      if (error.code === '23505') {
        lastError = error.message;
        continue;
      }

      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(
      { error: lastError ?? 'Impossibile creare la partita, riprova.' },
      { status: 500 },
    );
  }

  if (body.action === 'join') {
    const playerName = sanitizeName(body.playerName);
    const id = typeof body.id === 'string' ? body.id : null;
    const pin = typeof body.pin === 'string' ? body.pin.trim() : null;

    if (!id && !pin) {
      return Response.json({ error: 'Partita non specificata.' }, { status: 400 });
    }

    let query = supabase
      .from('supertris_games')
      .update({
        player_o_name: playerName,
        player_o_token: crypto.randomUUID(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'waiting')
      .is('player_o_token', null);

    query = id ? query.eq('id', id) : query.eq('pin', pin as string);

    const { data, error } = await query
      .select('id, pin, state, status, player_x_name, player_o_name, player_o_token, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return Response.json(
        { error: 'PIN non valido o partita già al completo.' },
        { status: 409 },
      );
    }

    return Response.json({
      id: data.id,
      token: data.player_o_token,
      symbol: 'O',
      game: publicRow(data),
    });
  }

  if (body.action === 'move') {
    const id = typeof body.id === 'string' ? body.id : null;
    const token = typeof body.token === 'string' ? body.token : null;
    const boardIndex = Number(body.boardIndex);
    const cellIndex = Number(body.cellIndex);

    if (!id || !token) {
      return Response.json({ error: 'Partita o token mancante.' }, { status: 400 });
    }

    const { data: game, error: fetchError } = await supabase
      .from('supertris_games')
      .select('id, state, status, player_x_token, player_o_token')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 400 });
    }
    if (!game) {
      return Response.json({ error: 'Partita non trovata.' }, { status: 404 });
    }

    let player: Player | null = null;
    if (token === game.player_x_token) player = 'X';
    else if (token === game.player_o_token) player = 'O';

    if (!player) {
      return Response.json({ error: 'Token non valido.' }, { status: 401 });
    }
    if (game.status !== 'active') {
      return Response.json({ error: 'La partita non è attiva.' }, { status: 400 });
    }

    const result = tryMove(game.state, boardIndex, cellIndex, player);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    const newStatus = result.state.winner ? 'finished' : 'active';

    const { data: updated, error: updateError } = await supabase
      .from('supertris_games')
      .update({ state: result.state, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('state, status')
      .single();

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 400 });
    }

    return Response.json({ state: updated.state, status: updated.status });
  }

  if (body.action === 'rematch') {
    const id = typeof body.id === 'string' ? body.id : null;
    const token = typeof body.token === 'string' ? body.token : null;

    if (!id || !token) {
      return Response.json({ error: 'Partita o token mancante.' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('supertris_games')
      .update({
        state: createInitialState(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('player_x_token', token)
      .select('id, pin, state, status, player_x_name, player_o_name, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (!updated) {
      return Response.json(
        { error: 'Solo chi ha creato la partita può avviare una rivincita.' },
        { status: 403 },
      );
    }

    return Response.json({ game: updated });
  }

  return Response.json({ error: 'Azione non supportata.' }, { status: 400 });
};
