import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Origine richiesta non valida.' }, { status: 403 });
  }

  let token = '';

  try {
    const body = await request.json();
    token = typeof body.token === 'string' ? body.token : '';
  } catch {
    return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const expectedToken = import.meta.env.LIVESCORE_CONTROL_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    return Response.json({ error: 'Token non valido.' }, { status: 401 });
  }

  cookies.set('livescore_control', expectedToken, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 365,
  });

  return Response.json({ ok: true });
};
