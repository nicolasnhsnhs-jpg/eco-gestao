import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { gravarExecucao, type CamposExecucao, type OsCompleta } from '../api'

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
 * Põe as alterações também na cópia da OS guardada no celular (cache da
 * consulta ['os', id], que fica salvo entre aberturas do app). Sem isso, depois
 * que o rascunho era enviado e apagado, reabrir a OS mostrava a cópia antiga —
 * baixada de manhã, sem chegada e início — e os horários pareciam ter sumido.
 */
export function aplicarNaOsGuardada(
  queryClient: QueryClient,
  osId: string,
  novos: CamposExecucao,
) {
  // Uma busca da OS que saiu antes desta alteração traria a versão antiga.
  // Cancela antes de gravar: o cancelamento devolve a cópia ao estado anterior.
  void queryClient.cancelQueries({ queryKey: ['os', osId], exact: true }).then(() =>
    queryClient.setQueryData<OsCompleta | null>(['os', osId], (os) =>
      os?.execucao ? { ...os, execucao: { ...os.execucao, ...novos } } : os,
    ),
  )
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

/** A fila avisa quando um arquivo subiu ou foi descartado (detalhe: id / {osId, id}). */
export const EVENTO_ARQUIVO_ENVIADO = 'eco-arquivo-enviado'
export const EVENTO_ARQUIVO_DESCARTADO = 'eco-arquivo-descartado'

const ASSINATURAS = ['assinatura_cliente_id', 'assinatura_operador_id'] as const

/** O arquivo da assinatura foi descartado: tira o id do rascunho guardado no celular. */
export function esquecerArquivoNoRascunho(osId: string, id: string) {
  const guardado = lerRascunho(osId)
  if (!guardado) return
  let mudou = false
  const campos = { ...guardado.campos }
  for (const k of ASSINATURAS) {
    if (campos[k] === id) {
      campos[k] = null
      mudou = true
    }
  }
  if (mudou) guardar(osId, { campos, pendente: true })
}

/** Erro de chave estrangeira: a assinatura aponta para um arquivo que ainda não subiu. */
const ehArquivoQueFalta = (erro: unknown) => (erro as { code?: string } | null)?.code === '23503'

const ESPERA_ENVIO_MS = 1500

export function useRascunhoExecucao(osId: string, doBanco: CamposExecucao, podeEditar: boolean) {
  const queryClient = useQueryClient()
  const [campos, setCampos] = useState<CamposExecucao>(() =>
    mesclarComRascunho(doBanco, lerRascunho(osId)),
  )
  const [estado, setEstado] = useState<EstadoEnvio>(() =>
    lerRascunho(osId)?.pendente ? 'salvo_no_celular' : 'enviado',
  )
  // Só o que o operador mudou e ainda não foi enviado (não a linha inteira do banco).
  const pendentes = useRef<CamposExecucao>(
    (() => {
      const guardado = lerRascunho(osId)
      return guardado?.pendente ? guardado.campos : {}
    })(),
  )
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const enviar = useCallback(async () => {
    const lote = pendentes.current
    if (Object.keys(lote).length === 0) return true
    setEstado('enviando')
    try {
      let enviado: CamposExecucao = lote
      try {
        await gravarExecucao(osId, lote)
      } catch (erro) {
        // A assinatura ainda está subindo pela fila: manda o resto agora e a
        // assinatura fica guardada até o arquivo chegar (aí envia de novo).
        if (!ehArquivoQueFalta(erro)) throw erro
        enviado = { ...lote }
        for (const k of ASSINATURAS) delete enviado[k]
        await gravarExecucao(osId, enviado)
      }
      // Só limpa o que foi enviado (o operador pode ter mexido durante o envio).
      const restante = { ...pendentes.current }
      for (const k of Object.keys(enviado) as (keyof CamposExecucao)[]) {
        if (restante[k] === enviado[k]) delete restante[k]
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
      aplicarNaOsGuardada(queryClient, osId, novos)
      setEstado('salvo_no_celular')
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => void enviar(), ESPERA_ENVIO_MS)
    },
    [enviar, osId, podeEditar, queryClient],
  )

  // Chegou uma versão nova da OS (abriu com a cópia do celular e o banco
  // respondeu depois): a tela passa a mostrar o que está no banco, mantendo por
  // cima o que o operador mudou e ainda não foi enviado.
  const bancoAnterior = useRef(doBanco)
  useEffect(() => {
    if (bancoAnterior.current === doBanco) return
    bancoAnterior.current = doBanco
    setCampos({ ...doBanco, ...pendentes.current })
  }, [doBanco])

  // Voltou o sinal (ou o celular saiu do modo avião), ou subiu o arquivo de uma
  // assinatura: envia o que ficou guardado.
  useEffect(() => {
    const aoVoltar = () => void enviar()
    window.addEventListener('online', aoVoltar)
    window.addEventListener(EVENTO_ARQUIVO_ENVIADO, aoVoltar)
    if (Object.keys(pendentes.current).length > 0) void enviar()
    return () => {
      window.removeEventListener('online', aoVoltar)
      window.removeEventListener(EVENTO_ARQUIVO_ENVIADO, aoVoltar)
      clearTimeout(temporizador.current)
    }
  }, [enviar])

  // Assinatura descartada na tarja vermelha: o quadro volta para assinar de novo.
  useEffect(() => {
    const aoDescartar = (e: Event) => {
      const { osId: daOs, id } = (e as CustomEvent<{ osId: string; id: string }>).detail
      if (daOs !== osId) return
      setCampos((atual) => {
        const novos: CamposExecucao = {}
        for (const k of ASSINATURAS) if (atual[k] === id) novos[k] = null
        if (Object.keys(novos).length === 0) return atual
        pendentes.current = { ...pendentes.current, ...novos }
        guardar(osId, { campos: pendentes.current, pendente: true })
        setEstado('salvo_no_celular')
        return { ...atual, ...novos }
      })
    }
    window.addEventListener(EVENTO_ARQUIVO_DESCARTADO, aoDescartar)
    return () => window.removeEventListener(EVENTO_ARQUIVO_DESCARTADO, aoDescartar)
  }, [osId])

  /** Envia já tudo o que falta (usado antes de concluir). Devolve se deu certo. */
  const enviarAgora = useCallback(() => {
    clearTimeout(temporizador.current)
    return enviar()
  }, [enviar])

  return { campos, alterar, estado, enviarAgora }
}
