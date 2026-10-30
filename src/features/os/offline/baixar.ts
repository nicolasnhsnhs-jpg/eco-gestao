import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { hojeISO } from '@/lib/datas'
import { estaOnline } from '@/lib/offline'

import { consultaOs, consultaVeiculos, osAberta, type OsResumo } from '../api'
import { consultaInsetos, consultaPontosOs, consultaProdutos } from '../pragasApi'

/*
 * Baixa para o celular tudo o que o operador precisa das OS do dia (e das que
 * ficaram em aberto): a OS com a ficha do cliente, os pontos, produtos, insetos
 * e os veículos. Roda ao abrir o app com sinal e sempre que o sinal volta.
 */

const CHAVE_BAIXADO_EM = 'eco-os-baixado-em'

export function ultimoDownload(): Date | null {
  try {
    const texto = localStorage.getItem(CHAVE_BAIXADO_EM)
    return texto ? new Date(texto) : null
  } catch {
    return null
  }
}

export function useBaixarOsDoDia(lista: OsResumo[] | undefined) {
  const queryClient = useQueryClient()
  const [baixadoEm, setBaixadoEm] = useState(ultimoDownload)
  const [online, setOnline] = useState(estaOnline)
  // Data de hoje fixada ao abrir a tela (para saber se o download é de hoje).
  const [hoje] = useState(() => new Date().toDateString())

  useEffect(() => {
    const mudou = () => setOnline(estaOnline())
    window.addEventListener('online', mudou)
    window.addEventListener('offline', mudou)
    return () => {
      window.removeEventListener('online', mudou)
      window.removeEventListener('offline', mudou)
    }
  }, [])

  useEffect(() => {
    if (!online || !lista) return
    let cancelado = false
    void (async () => {
      // Só as do dia (e as atrasadas que seguem abertas), como combinado.
      const hoje = hojeISO()
      const abertas = lista.filter((os) => osAberta(os.status) && os.data_agendada <= hoje)
      await Promise.all([
        queryClient.prefetchQuery(consultaVeiculos()),
        ...abertas.flatMap((os) => [
          queryClient.prefetchQuery(consultaOs(os.id)),
          queryClient.prefetchQuery(consultaPontosOs(os.id)),
          queryClient.prefetchQuery(consultaProdutos(os.id)),
          queryClient.prefetchQuery(consultaInsetos(os.id)),
        ]),
      ])
      if (cancelado) return
      const agora = new Date()
      try {
        localStorage.setItem(CHAVE_BAIXADO_EM, agora.toISOString())
      } catch {
        // sem espaço: a OS continua na memória enquanto o app estiver aberto
      }
      setBaixadoEm(agora)
    })()
    return () => {
      cancelado = true
    }
  }, [online, lista, queryClient])

  return { baixadoEm, baixadoHoje: baixadoEm?.toDateString() === hoje, online }
}
