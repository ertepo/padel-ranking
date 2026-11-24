import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { isUuid } from '../../../lib/ore-lavoro/server';
import { isIsoDate } from '../../../lib/time-grid';

// Pagamenti ricevuti dal datore di lavoro: segnarne uno (le ore da farsi
// pagare ripartono da quel giorno) o toglierne uno segnato per sbaglio.

export const prerender = false;

type Body = Record<string, unknown>;

async function leggiJson(request: Request): Promise<Body | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

const errore = (msg: string, status = 400) => Response.json({ error: msg }, { status });

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.staff_id)) return errore('Persona non valida.');
  if (typeof body.data !== 'string' || !isIsoDate(body.data)) return errore('Data non valida.');
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') return errore('Note non valide.');
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null;

  const { data, error } = await getSupabaseAdmin()
    .from('work_payments')
    .upsert({ staff_id: body.staff_id, data: body.data, note }, { onConflict: 'staff_id,data' })
    .select('id, data, note')
    .single();
  if (error || !data) return errore(error?.message || 'Errore nel salvataggio.');
  return Response.json({ ok: true, pagamento: data });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();
  const body = await leggiJson(request);
  if (!body || !isUuid(body.id)) return errore('Pagamento non specificato.');
  const { error } = await getSupabaseAdmin().from('work_payments').delete().eq('id', body.id);
  if (error) return errore(error.message);
  return Response.json({ ok: true });
};
