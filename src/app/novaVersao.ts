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
