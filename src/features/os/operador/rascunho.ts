import { useCallback, useEffect, useRef, useState } from 'react'

import { gravarExecucao, type CamposExecucao } from '../api'

/*
 * Rascunho local da execução: cada alteração fica salva no celular na hora
 * (localStorage) e é enviada ao banco quando houver sinal. Se a internet cair no
 * meio do serviço, nada do que o operador digitou se perde.
 */

export type EstadoEnvio = 'enviado' | 'salvo_no_celular' | 'enviando'

type Guardado = { campos: CamposExecucao; pendente: boolean }

const chave = (osId: string) => `eco-os-rascunho-${osId}`

export function lerRascunho(osId: string): Guardado | null {
  try {
    const texto = localStorage.getItem(chave(osId))
    return texto ? (JSON.parse(texto) as Guardado) : null
  } catch {
    return null
  }
}

function guardar(osId: string, valor: Guardado | null) {
  try {
    if (valor) localStorage.setItem(chave(osId), JSON.stringify(valor))
    else localStorage.removeItem(chave(osId))
  } catch {
    // Sem espaço ou navegação privada: segue só com o envio direto.
  }
}

/**
 * Junta o que veio do banco com o rascunho do celular. Alterações ainda não
 * enviadas valem mais que o banco (são as mais novas).
 */
export function mesclarComRascunho(
  doBanco: CamposExecucao,
  rascunho: Guardado | null,
): CamposExecucao {
  return rascunho?.pendente ? { ...doBanco, ...rascunho.campos } : doBanco
}

/**
 * Envia o que ficou só no celular (usado pela fila antes de concluir a OS).
 * Lança o erro se não conseguir, para a fila tentar de novo depois.
 */
export async function enviarRascunhoGuardado(osId: string) {
  const guardado = lerRascunho(osId)
  if (!guardado?.pendente || Object.keys(guardado.campos).length === 0) return
  await gravarExecucao(osId, guardado.campos)
  guardar(osId, null)
}

const ESPERA_ENVIO_MS = 1500

export function useRascunhoExecucao(osId: string, doBanco: CamposExecucao, podeEditar: boolean) {
  const [campos, setCampos] = useState<CamposExecucao>(() =>
    mesclarComRascunho(doBanco, lerRascunho(osId)),
  )
  const [estado, setEstado] = useState<EstadoEnvio>(() =>
    lerRascunho(osId)?.pendente ? 'salvo_no_celular' : 'enviado',
  )
  const pendentes = useRef<CamposExecucao>(lerRascunho(osId)?.pendente ? campos : {})
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const enviar = useCallback(async () => {
    const lote = pendentes.current
    if (Object.keys(lote).length === 0) return true
    setEstado('enviando')
    try {
      await gravarExecucao(osId, lote)
      // Só limpa o que foi enviado (o operador pode ter mexido durante o envio).
      const restante = { ...pendentes.current }
      for (const k of Object.keys(lote) as (keyof CamposExecucao)[]) {
        if (restante[k] === lote[k]) delete restante[k]
      }
      pendentes.current = restante
      const aindaFalta = Object.keys(restante).length > 0
      guardar(osId, aindaFalta ? { campos: restante, pendente: true } : null)
      setEstado(aindaFalta ? 'salvo_no_celular' : 'enviado')
      return !aindaFalta
    } catch {
      setEstado('salvo_no_celular')
      return false
    }
  }, [osId])

  const alterar = useCallback(
    (novos: CamposExecucao) => {
      if (!podeEditar) return
      setCampos((atual) => ({ ...atual, ...novos }))
      pendentes.current = { ...pendentes.current, ...novos }
      guardar(osId, { campos: pendentes.current, pendente: true })
      setEstado('salvo_no_celular')
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => void enviar(), ESPERA_ENVIO_MS)
    },
    [enviar, osId, podeEditar],
  )

  // Voltou o sinal (ou o celular saiu do modo avião): envia o que ficou guardado.
  useEffect(() => {
    const aoVoltar = () => void enviar()
    window.addEventListener('online', aoVoltar)
    if (Object.keys(pendentes.current).length > 0) void enviar()
    return () => {
      window.removeEventListener('online', aoVoltar)
      clearTimeout(temporizador.current)
    }
  }, [enviar])

  /** Envia já tudo o que falta (usado antes de concluir). Devolve se deu certo. */
  const enviarAgora = useCallback(() => {
    clearTimeout(temporizador.current)
    return enviar()
  }, [enviar])

  return { campos, alterar, estado, enviarAgora }
}
