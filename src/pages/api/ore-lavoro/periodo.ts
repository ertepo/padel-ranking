import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isAdminRequest, nonAutorizzato } from '../../../lib/adminAuth';
import { caricaPeriodo, isClub, isUuid, periodoValido } from '../../../lib/ore-lavoro/server';

export const prerender = false;

// GET /api/ore-lavoro/periodo?staff=<uuid>&dal=AAAA-MM-GG&al=AAAA-MM-GG[&raggruppa=week|month][&club=cingoli|poggio]
export const GET: APIRoute = async ({ request, cookies, url }) => {
  if (!isAdminRequest(request, cookies)) return nonAutorizzato();

  const staff = url.searchParams.get('staff');
  const dal = url.searchParams.get('dal');
  const al = url.searchParams.get('al');
  const raggruppa = url.searchParams.get('raggruppa') === 'month' ? 'month' : 'week';
  const clubParam = url.searchParams.get('club');
  const club = isClub(clubParam) ? clubParam : null;

  if (!isUuid(staff)) {
    return Response.json({ error: 'Maestro non valido.' }, { status: 400 });
  }
  if (!periodoValido(dal, al)) {
    return Response.json({ error: 'Periodo non valido.' }, { status: 400 });
  }

  try {
    const dati = await caricaPeriodo(getSupabaseAdmin(), staff, dal, al!, { raggruppa, club });
    return Response.json(dati);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Errore nel caricamento.' }, { status: 500 });
  }
};
