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

/*
 * Notificações push do atendimento (WhatsApp). O servidor manda o conteúdo
 * criptografado (supabase/functions/_shared/pushCrm.ts); aqui ele vira a notificação.
 * No iPhone, só funciona com o app aberto pela tela de início, e toda mensagem push
 * precisa mostrar uma notificação (o iOS não aceita push silencioso).
 */
self.addEventListener('push', (evento) => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' }
  }
  const tarefas = [
    self.registration.showNotification(dados.titulo || 'Eco Gestão', {
      body: dados.corpo || 'Nova mensagem no atendimento',
      // Uma notificação por mensagem (o servidor já garante que a mesma mensagem não
      // chega duas vezes); ao abrir a conversa, o app limpa as notificações dela.
      tag: dados.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: dados.url || '/crm', conversaId: dados.conversaId || null },
    }),
  ]
  // Número no ícone do app (iPhone com o app na tela de início, Android e computador).
  if (typeof dados.naoLidas === 'number' && self.navigator && 'setAppBadge' in self.navigator) {
    tarefas.push(
      (dados.naoLidas > 0
        ? self.navigator.setAppBadge(dados.naoLidas)
        : self.navigator.clearAppBadge()
      ).catch(() => {}),
    )
  }
  evento.waitUntil(Promise.all(tarefas))
})

// Tocou na notificação: abre o app direto na conversa (ou traz para a frente o que já está aberto).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const caminho = (evento.notification.data && evento.notification.data.url) || '/crm'
  const endereco = new URL(caminho, self.location.origin).href
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const janela of janelas) {
        if (new URL(janela.url).origin !== self.location.origin) continue
        try {
          await janela.focus()
          janela.postMessage({ tipo: 'abrir', url: caminho })
          return
        } catch {
          // Não deu para trazer esta janela: abre uma nova abaixo.
        }
      }
      await self.clients.openWindow(endereco)
    })(),
  )
})
