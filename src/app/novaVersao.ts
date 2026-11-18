import { useSyncExternalStore } from 'react'

/*
 * Avisa quando sai versão nova do sistema.
 *
 * O Service Worker abre sempre a versão guardada no aparelho (para funcionar sem
 * internet) e baixa a nova em segundo plano. Sem este aviso, quem deixa o sistema
 * aberto o dia todo continua na versão antiga até fechar e abrir de novo.
 */

const MEIA_HORA = 30 * 60 * 1000

let temNovaVersao = false
const ouvintes = new Set<() => void>()

/** Registra o Service Worker e passa a procurar versão nova. */
export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Sem controlador = primeira vez que o app abre neste aparelho: não há o que atualizar.
  const tinhaVersaoGuardada = !!navigator.serviceWorker.controller

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaVersaoGuardada) return
    temNovaVersao = true
    ouvintes.forEach((avisar) => avisar())
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registro) => {
      const procurar = () => void registro.update().catch(() => {})
      setInterval(procurar, MEIA_HORA)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') procurar()
      })
    })
  })
}

const CHAVE_RECARGA = 'eco-recarga-arquivo-antigo'

/**
 * Depois de publicar versão nova, quem estava com o sistema aberto ainda tem a
 * versão antiga na tela, e ela pede arquivos (PDF, ficha...) que não existem mais
 * ("Failed to fetch dynamically imported module"). Sair e entrar não resolve, só
 * recarregar a página: então recarrega sozinho, uma vez (se falhar de novo logo
 * em seguida, deixa o erro aparecer em vez de ficar recarregando sem parar).
 */
export function recarregarSeFaltarArquivo() {
  window.addEventListener('vite:preloadError', (evento) => {
    let ultima = 0
    try {
      ultima = Number(sessionStorage.getItem(CHAVE_RECARGA)) || 0
    } catch {
      // Sem sessionStorage (aba anônima): recarrega mesmo assim.
    }
    if (Date.now() - ultima < 30_000) return
    try {
      sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()))
    } catch {
      // idem
    }
    evento.preventDefault()
    window.location.reload()
  })
}

/** O erro é de arquivo da versão antiga do sistema (veja recarregarSeFaltarArquivo). */
export function ehArquivoDeVersaoAntiga(mensagem: string | undefined) {
  return (
    !!mensagem &&
    /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
      mensagem,
    )
  )
}

/** true quando a versão nova já foi baixada e falta só recarregar a página. */
export function useNovaVersao() {
  return useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar)
      return () => ouvintes.delete(avisar)
    },
    () => temNovaVersao,
  )
}
