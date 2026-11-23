import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { caricaPeriodo, caricaStaff, isClub, isUuid, periodoValido } from '../../../lib/ore-lavoro/server';
import { csvRiepilogo } from '../../../lib/ore-lavoro/csv';

export const prerender = false;

// GET ?staff=<uuid>&dal=&al=[&club=]: riepilogo CSV giorno per giorno del
// periodo, con il totale (da work_hours_daily e work_hours_summary).
export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();

  const staff = url.searchParams.get('staff');
  const dal = url.searchParams.get('dal');
  const al = url.searchParams.get('al');
  const clubParam = url.searchParams.get('club');
  const club = isClub(clubParam) ? clubParam : null;
  if (!isUuid(staff)) return Response.json({ error: 'Maestro non valido.' }, { status: 400 });
  if (!periodoValido(dal, al)) return Response.json({ error: 'Periodo non valido.' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const [dati, persone] = await Promise.all([
      // Raggruppando per mese un periodo dentro un solo mese dà un'unica riga di totale.
      caricaPeriodo(supabase, staff, dal, al!, { raggruppa: dal!.slice(0, 7) === al!.slice(0, 7) ? 'month' : 'week', club }),
      caricaStaff(supabase),
    ]);
    const totale = dati.riepiloghi.length === 1 ? dati.riepiloghi[0] : null;
    const nome = (persone.find((p) => p.id === staff)?.nome ?? 'maestro').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const file = `ore-${nome}-${dal}-${al}${club ? `-${club}` : ''}.csv`;
    return new Response(csvRiepilogo(dati.giorni, totale), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Errore nell'export." }, { status: 500 });
  }
};
