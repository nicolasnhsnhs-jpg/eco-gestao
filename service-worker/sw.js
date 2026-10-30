/*
 * Service Worker do Eco Gestão: guarda o próprio sistema (HTML, JS, CSS, logos)
 * no celular, para o app abrir sem internet. Os dados (Supabase) NÃO passam por
 * aqui: quem guarda os dados é o próprio app (IndexedDB) e a fila de envio.
 *
 * Este arquivo é um modelo: no build, o plugin em vite.config.ts troca
 * a versão e a lista de arquivos daquela versão (marcadores abaixo).
 */

const CACHE = 'eco-gestao-__VERSAO__'
const ARQUIVOS = __ARQUIVOS__

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting()),
  )
})

// Versão nova ativa: apaga as versões antigas guardadas.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((chave) => chave.startsWith('eco-gestao-') && chave !== CACHE)
            .map((chave) => caches.delete(chave)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return
  const url = new URL(pedido.url)
  // Supabase, ViaCEP, fontes: sempre direto na rede.
  if (url.origin !== self.location.origin) return

  // Abrir qualquer tela: usa a versão guardada (abre na hora, com ou sem sinal).
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      caches
        .match('/index.html', { ignoreVary: true })
        .then((guardado) => guardado || fetch(pedido)),
    )
    return
  }

  // ignoreVary: o JS/CSS é pedido com cabeçalho Origin e o servidor responde com
  // "Vary: Origin"; sem isto o arquivo guardado não seria reconhecido offline.
  evento.respondWith(
    caches.match(pedido, { ignoreVary: true }).then((guardado) => guardado || fetch(pedido)),
  )
})
