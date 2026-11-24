// Service worker della pagina kiosk delle ore di lavoro. Non mette niente in
// cache e non tocca le richieste: c'è solo perché Chrome, per installare la
// pagina come app a schermo intero ("Aggiungi a schermata Home"), vuole un
// service worker con un gestore fetch.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
