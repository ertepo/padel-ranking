import type { APIRoute } from 'astro';
import { fetchOpenResaAvailability } from '../../../lib/openresa';

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Data non valida.' }, { status: 400 });
  }

  try {
    const availability = await fetchOpenResaAvailability(date);
    return Response.json(availability, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('OpenResa availability request failed', error);
    return Response.json(
      { error: 'Non riusciamo a caricare le disponibilita in questo momento.' },
      { status: 502 },
    );
  }
};
