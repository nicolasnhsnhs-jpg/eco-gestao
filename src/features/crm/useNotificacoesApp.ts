import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useNaoLidasCrm } from './api'
import { atualizarNumeroDoIcone, sincronizarNotificacoes } from './push'

/**
 * Peças das notificações que valem para o app inteiro (montado no AppLayout):
 * - ao abrir, confere a inscrição deste aparelho (sem pedir permissão);
 * - toque na notificação com o app já aberto: o Service Worker avisa e vamos à conversa;
 * - número de mensagens não lidas no ícone do app e no título da aba.
 */
export function useNotificacoesApp(ativo: boolean) {
  const navigate = useNavigate()
  const { data: naoLidas = 0 } = useNaoLidasCrm(ativo)

  useEffect(() => {
    if (!ativo) return
    sincronizarNotificacoes().catch((e) => console.warn('Notificações:', (e as Error).message))
  }, [ativo])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const aoReceber = (evento: MessageEvent) => {
      const dados = evento.data as { tipo?: string; url?: string } | null
      if (dados?.tipo === 'abrir' && dados.url?.startsWith('/')) void navigate(dados.url)
    }
    navigator.serviceWorker.addEventListener('message', aoReceber)
    return () => navigator.serviceWorker.removeEventListener('message', aoReceber)
  }, [navigate])

  useEffect(() => {
    if (!ativo) return
    atualizarNumeroDoIcone(naoLidas)
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '')
    document.title = naoLidas > 0 ? `(${naoLidas > 99 ? '99+' : naoLidas}) ${base}` : base
  }, [ativo, naoLidas])
}
