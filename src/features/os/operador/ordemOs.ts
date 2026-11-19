import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { estaOnline } from '@/lib/offline'
import { supabase } from '@/lib/supabase'

/*
 * Ordem das OS escolhida pelo operador no Início (migration
 * 20270121120000_os_ordem_operador.sql).
 *
 * A ordem vale primeiro no celular (localStorage, funciona sem internet) e é
 * enviada ao banco para valer também em outro aparelho. Sem sinal, fica marcada
 * "pendente" e vai quando o sinal volta. Concluir uma OS não mexe na ordem.
 */

/** A lista na ordem escolhida; as que não estão na ordem vão no fim, na ordem de antes. */
export function ordenarPelaEscolha<T extends { id: string }>(lista: T[], ordem: string[]): T[] {
  const posicao = new Map(ordem.map((id, i) => [id, i]))
  return lista
    .map((item, i) => ({ item, i, p: posicao.get(item.id) }))
    .sort((a, b) => {
      if (a.p !== undefined && b.p !== undefined) return a.p - b.p
      if (a.p !== undefined) return -1
      if (b.p !== undefined) return 1
      return a.i - b.i
    })
    .map((x) => x.item)
}

/** Troca a OS de lugar com a de cima (-1) ou a de baixo (+1). */
export function moverNaOrdem(ids: string[], id: string, direcao: -1 | 1): string[] {
  const i = ids.indexOf(id)
  const j = i + direcao
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const nova = [...ids]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  return nova
}

type OrdemGuardada = { ids: string[]; em: string; pendente: boolean }

const chave = (operadorId: string) => `eco-os-ordem-${operadorId}`

function lerLocal(operadorId: string): OrdemGuardada | null {
  try {
    const texto = localStorage.getItem(chave(operadorId))
    return texto ? (JSON.parse(texto) as OrdemGuardada) : null
  } catch {
    return null
  }
}

function gravarLocal(operadorId: string, ordem: OrdemGuardada) {
  try {
    localStorage.setItem(chave(operadorId), JSON.stringify(ordem))
  } catch {
    // sem espaço: a ordem continua valendo enquanto o app estiver aberto
  }
}

async function enviar(operadorId: string, ordem: OrdemGuardada) {
  const { error } = await supabase
    .from('os_ordem_operador')
    .upsert({ operador_id: operadorId, os_ids: ordem.ids, atualizado_em: ordem.em })
  if (error) throw error
}

export function useOrdemDoOperador(operadorId: string) {
  const queryClient = useQueryClient()
  const [local, setLocal] = useState(() => lerLocal(operadorId))
  const doBanco = useQuery({
    // Começa com "os" para ficar guardada no celular junto com as OS.
    queryKey: ['os', 'ordem-operador', operadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_ordem_operador')
        .select('os_ids, atualizado_em')
        .eq('operador_id', operadorId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  // Vale a mais recente: a do celular (se ainda não foi enviada, sempre ela) ou a do banco.
  const ordem = useMemo(() => {
    const banco = doBanco.data
    if (
      local &&
      (local.pendente || !banco || Date.parse(local.em) >= Date.parse(banco.atualizado_em))
    )
      return local.ids
    return banco?.os_ids ?? local?.ids ?? []
  }, [local, doBanco.data])

  const mandarPendente = useCallback(async () => {
    const atual = lerLocal(operadorId)
    if (!atual?.pendente || !estaOnline()) return
    try {
      await enviar(operadorId, atual)
      // Só tira o "pendente" se ninguém mudou a ordem enquanto enviava.
      if (lerLocal(operadorId)?.em === atual.em) {
        const enviada = { ...atual, pendente: false }
        gravarLocal(operadorId, enviada)
        setLocal(enviada)
      }
      void queryClient.invalidateQueries({ queryKey: ['os', 'ordem-operador', operadorId] })
    } catch {
      // sem sinal ou erro passageiro: tenta de novo quando o sinal voltar
    }
  }, [operadorId, queryClient])

  useEffect(() => {
    void mandarPendente()
    window.addEventListener('online', mandarPendente)
    return () => window.removeEventListener('online', mandarPendente)
  }, [mandarPendente])

  const salvarOrdem = useCallback(
    (ids: string[]) => {
      const nova = { ids, em: new Date().toISOString(), pendente: true }
      gravarLocal(operadorId, nova)
      setLocal(nova)
      void mandarPendente()
    },
    [operadorId, mandarPendente],
  )

  return { ordem, salvarOrdem }
}
