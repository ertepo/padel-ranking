import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export const prerender = false;

const CREATE_FIELDS = new Set([
  'sport',
  'match_type',
  'team_a_name',
  'team_b_name',
  'max_sets',
  'match_label',
  'golden_point',
  'scoring_mode',
  'serving',
  'status',
]);

const UPDATE_FIELDS = new Set([
  'points_a',
  'points_b',
  'games_a',
  'games_b',
  'sets',
  'current_set',
  'serving',
  'status',
  'winner',
]);

function pickAllowedValues(values: unknown, allowedFields: Set<string>) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values).filter(([key]) => allowedFields.has(key)),
  );
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  const adminAuthorized =
    Boolean(import.meta.env.ADMIN_PASSWORD) &&
    cookies.get('admin_password')?.value === import.meta.env.ADMIN_PASSWORD;
  const watchAuthorized =
    Boolean(import.meta.env.LIVESCORE_CONTROL_TOKEN) &&
    cookies.get('livescore_control')?.value === import.meta.env.LIVESCORE_CONTROL_TOKEN;

  if (!adminAuthorized && !watchAuthorized) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: {
    action?: string;
    id?: string;
    values?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (body.action === 'create') {
    if (!adminAuthorized) {
      return Response.json(
        { error: 'Solo l’amministratore può creare una partita.' },
        { status: 403 },
      );
    }

    const values = pickAllowedValues(body.values, CREATE_FIELDS);

    if (!values['team_a_name'] || !values['team_b_name']) {
      return Response.json(
        { error: 'I nomi delle due squadre sono obbligatori.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('live_score')
      .insert(values)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data });
  }

  if (body.action === 'update') {
    if (!body.id) {
      return Response.json({ error: 'ID partita mancante.' }, { status: 400 });
    }

    const values = pickAllowedValues(body.values, UPDATE_FIELDS);

    if (Object.keys(values).length === 0) {
      return Response.json({ error: 'Nessun campo valido da aggiornare.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('live_score')
      .update(values)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data });
  }

  if (body.action === 'delete') {
    if (!adminAuthorized) {
      return Response.json(
        { error: 'Solo l’amministratore può eliminare una partita.' },
        { status: 403 },
      );
    }

    if (!body.id) {
      return Response.json({ error: 'ID partita mancante.' }, { status: 400 });
    }

    const { error } = await supabase.from('live_score').delete().eq('id', body.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data: null });
  }

  return Response.json({ error: 'Azione non supportata.' }, { status: 400 });
};
