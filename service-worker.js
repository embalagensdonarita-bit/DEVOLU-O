/* =====================================================
   SERVICE WORKER - Dona Rita Embalagens PWA
   Versão: v2 (compatível com o HTML otimizado p/ Spark)
   ===================================================== */

// ⚠️ Bump de versão: força os clientes a baixar o novo HTML
const CACHE_NAME = 'dona-rita-v2';
const CACHE_VERSION = 2;

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

/* Domínios que NUNCA devem ser interceptados pelo SW
   (Firebase/Firestore/Auth/Google APIs gerenciam seu próprio cache) */
const BYPASS_HOSTS = [
    'firestore.googleapis.com',
    'firebaseio.com',
    'firebaseapp.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'googleapis.com',
    'gstatic.com',
    'google-analytics.com',
    'googletagmanager.com'
];

function shouldBypass(url) {
    try {
        const u = new URL(url);
        return BYPASS_HOSTS.some(h => u.hostname.endsWith(h));
    } catch (e) {
        return false;
    }
}

/* ============ INSTALAÇÃO ============ */
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando v' + CACHE_VERSION + '...');
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
    console.log('[SW] Ativando v' + CACHE_VERSION + '...');
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

    // Ignora requisições não-HTTP (chrome-extension, etc.)
    if (!req.url.startsWith('http')) return;

    // ✅ Ignora Firebase / Google APIs (deixa o SDK gerenciar)
    if (shouldBypass(req.url)) return;

    // Estratégia: Stale-While-Revalidate (cache-first com atualização em background)
    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            const fetchPromise = fetch(req)
                .then((networkResponse) => {
                    // Cacheia apenas respostas same-origin válidas
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
