/* =====================================================
   SERVICE WORKER - Dona Rita Embalagens PWA
   ===================================================== */

const CACHE_NAME = 'dona-rita-v1';
const CACHE_VERSION = 1;

/* Arquivos essenciais para funcionar OFFLINE */
const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './logo.png',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'
];

/* ============ INSTALAÇÃO ============ */
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Adiciona arquivos essenciais; se algum falhar, continua mesmo assim
            return Promise.allSettled(
                CORE_ASSETS.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[SW] Não foi possível cachear:', url, err);
                    })
                )
            );
        }).then(() => self.skipWaiting())
    );
});

/* ============ ATIVAÇÃO ============ */
self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[SW] Removendo cache antigo:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

/* ============ INTERCEPTAÇÃO DE REQUISIÇÕES ============ */
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Ignora métodos que não são GET
    if (req.method !== 'GET') return;

    // Ignora requisições do tipo chrome-extension, etc.
    if (!req.url.startsWith('http')) return;

    // Estratégia: Cache First com atualização em background (Stale-While-Revalidate)
    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            const fetchPromise = fetch(req)
                .then((networkResponse) => {
                    // Só cacheia respostas válidas
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(req, responseClone).catch(() => {});
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Se falhar e tivermos cache, retorna o cache
                    return cachedResponse;
                });

            // Retorna cache imediatamente se existir, senão espera a rede
            return cachedResponse || fetchPromise;
        })
    );
});

/* ============ MENSAGENS DO CLIENTE ============ */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
