import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { hojeISO } from '@/lib/datas'
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

/* ---------------- Um dia de cada vez ---------------- */

type OsDoDia = {
  id: string
  status: string
  data_agendada: string
  concluida_em: string | null
}

const aberta = (status: string) => status === 'agendada' || status === 'em_execucao'

/**
 * As OS que o operador vê no dia escolhido. Hoje: as de hoje, as atrasadas que
 * seguem abertas e as concluídas hoje. Outro dia: só as marcadas para aquele dia.
 */
export function osDoDia<T extends OsDoDia>(lista: readonly T[], dia: string, hoje: string): T[] {
  return lista.filter((os) => {
    if (os.status === 'cancelada') return false
    if (dia !== hoje) return os.data_agendada === dia
    if (os.data_agendada === hoje) return true
    if (aberta(os.status)) return os.data_agendada < hoje
    return !!os.concluida_em && hojeISO(new Date(os.concluida_em)) === hoje
  })
}

/** Hoje e os próximos dias que têm OS, com quantas OS cada um tem. */
export function diasComOs(lista: readonly OsDoDia[], hoje: string): { dia: string; qtd: number }[] {
  const dias = new Set([hoje])
  for (const os of lista)
    if (os.status !== 'cancelada' && os.data_agendada > hoje) dias.add(os.data_agendada)
  return [...dias].sort().map((dia) => ({ dia, qtd: osDoDia(lista, dia, hoje).length }))
}

/**
 * Nova ordem depois de mexer nas OS de um dia: as do dia na ordem nova, e a ordem
 * das OS de outros dias continua guardada.
 */
export function ordemComODia(ordem: readonly string[], doDia: readonly string[]): string[] {
  const doDiaSet = new Set(doDia)
  return [...doDia, ...ordem.filter((id) => !doDiaSet.has(id))]
}
