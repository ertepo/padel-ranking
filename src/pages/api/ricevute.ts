import type { APIRoute } from 'astro';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export const prerender = false;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, cookies }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  const adminAuthorized =
    Boolean(import.meta.env.ADMIN_PASSWORD) &&
    cookies.get('admin_password')?.value === import.meta.env.ADMIN_PASSWORD;

  if (!adminAuthorized) {
    return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
  }

  let body: {
    data?: unknown;
    nominativo?: unknown;
    importo_lettere?: unknown;
    causale?: unknown;
    importo_cifre?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const data = typeof body.data === 'string' && DATE_PATTERN.test(body.data) ? body.data : '';
  const nominativo = typeof body.nominativo === 'string' ? body.nominativo.trim() : '';
  const importoLettere = typeof body.importo_lettere === 'string' ? body.importo_lettere.trim() : '';
  const causale = typeof body.causale === 'string' ? body.causale.trim() : '';
  const importoCifre =
    typeof body.importo_cifre === 'number' && Number.isFinite(body.importo_cifre)
      ? Math.round(body.importo_cifre * 100) / 100
      : NaN;

  if (!data) {
    return Response.json({ error: 'Data non valida.' }, { status: 400 });
  }
  if (!nominativo || !importoLettere || !causale) {
    return Response.json({ error: 'Tutti i campi sono obbligatori.' }, { status: 400 });
  }
  if (!Number.isFinite(importoCifre) || importoCifre <= 0) {
    return Response.json({ error: 'Il totale deve essere un numero positivo.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: ricevuta, error } = await supabase
    .rpc('crea_ricevuta', {
      p_data: data,
      p_nominativo: nominativo,
      p_importo_lettere: importoLettere,
      p_causale: causale,
      p_importo_cifre: importoCifre,
    })
    .single();

  if (error || !ricevuta) {
    return Response.json({ error: error?.message || 'Errore nel salvataggio della ricevuta.' }, { status: 400 });
  }

  return Response.json({ ok: true, ricevuta });
};
