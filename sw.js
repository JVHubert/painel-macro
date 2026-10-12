// Guarda a casca do painel no aparelho e mantém o JSON de indicadores sempre fresco.
// Aumente a versão a cada publicação para os celulares baixarem a nova.
const VERSAO = 'painel-macro-v5';
const ARQUIVOS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'indicadores.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'dados/indicadores.json',
];

const DADOS = 'dados/indicadores.json';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSAO)
      // Cada arquivo sozinho: se um faltar, a instalação não cai inteira.
      .then((c) => Promise.all(ARQUIVOS.map((arquivo) => c.add(arquivo).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Indicadores: rede primeiro, porque o valor novo é o motivo de abrir o painel.
  if (new URL(e.request.url).pathname.endsWith(DADOS)) {
    e.respondWith(
      fetch(e.request)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(VERSAO).then((c) => c.put(e.request, copia));
          return resposta;
        })
        .catch(() => caches.match(e.request)),
    );
    return;
  }

  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((achou) => achou || fetch(e.request)));
});
