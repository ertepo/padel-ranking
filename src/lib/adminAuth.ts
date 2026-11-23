// Controllo dell'area admin, lo stesso usato dalle pagine e dalle API
// esistenti: cookie admin_password uguale a ADMIN_PASSWORD e, per le API,
// richieste provenienti dallo stesso sito.

type Cookies = { get: (name: string) => { value: string } | undefined };

export function isAdmin(cookies: Cookies): boolean {
  return Boolean(import.meta.env.ADMIN_PASSWORD) && cookies.get('admin_password')?.value === import.meta.env.ADMIN_PASSWORD;
}

export function isAdminRequest(request: Request, cookies: Cookies): boolean {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  return isAdmin(cookies);
}

export function nonAutorizzato(): Response {
  return Response.json({ error: 'Accesso non autorizzato.' }, { status: 401 });
}
