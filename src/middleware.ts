import { defineMiddleware } from 'astro:middleware';
import { getSupabaseAdmin } from './lib/supabaseAdmin';
import { EXCLUDED_PATH_PREFIXES } from './lib/trackedPaths';

const STATIC_FILE_RE = /\.[a-z0-9]+$/i;

function shouldTrack(pathname: string, method: string): boolean {
  if (method !== 'GET') return false;
  if (STATIC_FILE_RE.test(pathname)) return false;
  return !EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function trackPageView(path: string): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const day = new Date().toISOString().slice(0, 10);
    const { error } = await supabaseAdmin.rpc('increment_page_view', { p_day: day, p_path: path });
    if (error) {
      console.error('Tracciamento visita fallito:', error.message);
    }
  } catch (err) {
    console.error('Tracciamento visita fallito:', err);
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  if (response.status < 400 && shouldTrack(context.url.pathname, context.request.method)) {
    const tracking = trackPageView(context.url.pathname);
    context.locals.netlify?.context?.waitUntil(tracking);
  }

  return response;
});
