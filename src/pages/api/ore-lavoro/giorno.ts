import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { isUuid } from '../../../lib/ore-lavoro/server';
import { isIsoDate } from '../../../lib/time-grid';

export const prerender = false;

// PUT { staff_id, data, da_verificare, note }: segna (o toglie) un giorno da
// verificare con la sua nota. Senza segno e senza nota la riga si cancella.
export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  if (!isUuid(body.staff_id)) return Response.json({ error: 'Maestro non valido.' }, { status: 400 });
  if (typeof body.data !== 'string' || !isIsoDate(body.data)) return Response.json({ error: 'Data non valida.' }, { status: 400 });
  if (typeof body.da_verificare !== 'boolean') return Response.json({ error: 'Valore non valido.' }, { status: 400 });
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    return Response.json({ error: 'Note non valide.' }, { status: 400 });
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const supabase = getSupabaseAdmin();
  const { error } =
    !body.da_verificare && !note
      ? await supabase.from('work_day_flags').delete().eq('staff_id', body.staff_id).eq('data', body.data)
      : await supabase.from('work_day_flags').upsert({
          staff_id: body.staff_id,
          data: body.data,
          da_verificare: body.da_verificare,
          note,
          updated_at: new Date().toISOString(),
        });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
};
