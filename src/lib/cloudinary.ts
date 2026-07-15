export type GalleryImage = {
  src: string;
  alt: string;
  caption?: string;
  orientation: 'landscape' | 'portrait';
  accentClass: string;
};

type CloudinaryResource = {
  secure_url: string;
  width: number;
  height: number;
  created_at: string;
  public_id: string;
  context?: { custom?: Record<string, string> };
};

type CloudinaryListResponse = {
  resources: CloudinaryResource[];
  next_cursor?: string;
};

const ACCENT_CLASSES = [
  'dark-club-card dark-club-card-blue rotate-1',
  'dark-club-card dark-club-card-violet -rotate-1',
  'dark-club-card dark-club-card-green -rotate-2',
  'dark-club-card rotate-2',
];

// Trasforma l'URL originale applicando le stesse ottimizzazioni usate
// per le foto già caricate a mano (formato/qualità automatici, larghezza max).
function optimizeUrl(secureUrl: string): string {
  return secureUrl.replace('/upload/', '/upload/f_auto,q_auto,w_1200/');
}

async function fetchAllResources(
  cloudName: string,
  authHeader: string,
  assetFolder: string,
): Promise<CloudinaryResource[]> {
  const resources: CloudinaryResource[] = [];
  let nextCursor: string | undefined;

  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/by_asset_folder`);
    url.searchParams.set('asset_folder', assetFolder);
    url.searchParams.set('max_results', '500');
    url.searchParams.set('context', 'true');
    if (nextCursor) url.searchParams.set('next_cursor', nextCursor);

    const response = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      throw new Error(`Cloudinary API error (${response.status}): ${await response.text()}`);
    }

    const payload = (await response.json()) as CloudinaryListResponse;
    resources.push(...(payload.resources || []));
    nextCursor = payload.next_cursor;
  } while (nextCursor);

  return resources;
}

// Recupera tutte le immagini di una cartella Cloudinary (dynamic asset folder)
// e le converte nel formato atteso da PhotoCarousel.svelte. Ritorna un array
// vuoto (senza lanciare errori) se le credenziali non sono configurate o la
// chiamata fallisce, cosi la pagina resta comunque utilizzabile.
export async function fetchCloudinaryFolderImages(
  assetFolder: string,
  altPrefix: string,
): Promise<GalleryImage[]> {
  // Il cloud name non e un segreto: compare in chiaro in ogni URL delle
  // immagini, per questo usa il prefisso PUBLIC_ come le altre variabili
  // non sensibili del progetto (evita anche il secrets-scanner di Netlify).
  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = import.meta.env.CLOUDINARY_API_KEY;
  const apiSecret = import.meta.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('Cloudinary non configurato: PUBLIC_CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET mancanti.');
    return [];
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

  try {
    const resources = await fetchAllResources(cloudName, authHeader, assetFolder);

    resources.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return resources.map((resource, index) => ({
      src: optimizeUrl(resource.secure_url),
      alt: resource.context?.custom?.alt || `${altPrefix} - foto ${index + 1}`,
      caption: resource.context?.custom?.caption,
      orientation: resource.width >= resource.height ? 'landscape' : 'portrait',
      accentClass: ACCENT_CLASSES[index % ACCENT_CLASSES.length],
    }));
  } catch (error) {
    console.error('Errore nel recupero delle foto da Cloudinary:', error);
    return [];
  }
}
