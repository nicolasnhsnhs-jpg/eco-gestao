import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Serviços realizados/agendados e vencimentos.
 * Quem vê: Admin/Financeiro (tudo) e o vendedor (clientes dele). O banco garante.
 * Os vencimentos são calculados pelo banco a cada serviço realizado.
 */

export type StatusServico = Database['public']['Enums']['status_servico']
export type SituacaoVencimento = 'vencido' | 'vencendo' | 'em_dia' | 'sem_data' | 'desativado'
export type TipoServico = Tables<'tipos_servico'>

export const NOME_STATUS_SERVICO: Record<StatusServico, string> = {
  agendado: 'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const COR_STATUS_SERVICO = {
  agendado: 'alerta',
  realizado: 'verde',
  cancelado: 'cinza',
} as const satisfies Record<StatusServico, string>

export const NOME_SITUACAO_VENCIMENTO: Record<SituacaoVencimento, string> = {
  vencido: 'Vencido',
  vencendo: 'Vencendo',
  em_dia: 'Em dia',
  sem_data: 'Sem data',
  desativado: 'Desativado',
}

export const COR_SITUACAO_VENCIMENTO = {
  vencido: 'perigo',
  vencendo: 'alerta',
  em_dia: 'verde',
  sem_data: 'cinza',
  desativado: 'cinza',
} as const satisfies Record<SituacaoVencimento, string>

const RELACOES = `
  cliente:clientes(id, nome, nome_fantasia),
  endereco:enderecos(id, apelido, logradouro, numero, cidade, uf),
  tipo:tipos_servico(id, nome, tipo_vencimento),
  vendedor:perfis!servicos_vendedor_id_fkey(id, nome),
  proposta:propostas(id, numero, prazo_pagamento_dias)
`

export type FiltroServicos = {
  clienteId?: string
  propostaId?: string
  /** Período da data de execução (AAAA-MM-DD). */
  de?: string
  ate?: string
  status?: StatusServico
}

export function useServicos(filtro: FiltroServicos) {
  return useQuery({
    queryKey: ['servicos', 'lista', filtro],
    queryFn: async () => {
      let consulta = supabase
        .from('servicos')
        .select(`*, ${RELACOES}`)
        .order('data_execucao', { ascending: filtro.status === 'agendado' })
        .limit(300)
      if (filtro.clienteId) consulta = consulta.eq('cliente_id', filtro.clienteId)
      if (filtro.propostaId) consulta = consulta.eq('proposta_id', filtro.propostaId)
      if (filtro.de) consulta = consulta.gte('data_execucao', filtro.de)
      if (filtro.ate) consulta = consulta.lte('data_execucao', filtro.ate)
      if (filtro.status) consulta = consulta.eq('status', filtro.status)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export type ServicoResumo = NonNullable<ReturnType<typeof useServicos>['data']>[number]

export function useServico(id: string | undefined) {
  return useQuery({
    queryKey: ['servicos', 'um', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`*, ${RELACOES}`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Contas a receber ligadas a um serviço (só Admin/Financeiro recebem algo). */
export function useLancamentosDoServico(servicoId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['financeiro', 'servico', servicoId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lancamentos')
        .select('id, descricao, valor, vencimento, situacao, status')
        .eq('servico_id', servicoId)
        .neq('status', 'cancelado')
      if (error) throw error
      return data
    },
  })
}

export function useVencimentos(filtro: { clienteId?: string; ateDias?: number }) {
  return useQuery({
    queryKey: ['servicos', 'vencimentos', filtro],
    queryFn: async () => {
      let consulta = supabase
        .from('v_vencimentos')
        .select(
          `*, cliente:clientes(id, nome, nome_fantasia, vendedor_responsavel_id),
           endereco:enderecos(id, apelido, cidade), tipo:tipos_servico(id, nome, tipo_vencimento)`,
        )
        .order('proxima_data', { ascending: true, nullsFirst: false })
        .limit(500)
      if (filtro.clienteId) consulta = consulta.eq('cliente_id', filtro.clienteId)
      if (filtro.ateDias != null) {
        consulta = consulta.eq('ativo', true).lte('dias_para_vencer', filtro.ateDias)
      }
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export type Vencimento = NonNullable<ReturnType<typeof useVencimentos>['data']>[number]

export function useTiposServico() {
  return useQuery({
    queryKey: ['tipos-servico'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_servico').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

function useAtualizar() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['servicos'] })
    void queryClient.invalidateQueries({ queryKey: ['avisos'] })
  }
}

export function useSalvarServico() {
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TablesInsert<'servicos'> }) => {
      if (id) {
        const { error } = await supabase.from('servicos').update(dados).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase.from('servicos').insert(dados).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: atualizar,
  })
}

export function useAtualizarServico(id: string) {
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: async (dados: TablesUpdate<'servicos'>) => {
      const { error } = await supabase.from('servicos').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useAjustarVencimento() {
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Pick<
        TablesUpdate<'vencimentos_servico'>,
        'periodicidade_meses' | 'antecedencia_aviso_dias' | 'ativo'
      >
    }) => {
      const { error } = await supabase.from('vencimentos_servico').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useSalvarTipoServico() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TablesInsert<'tipos_servico'> }) => {
      const { error } = id
        ? await supabase.from('tipos_servico').update(dados).eq('id', id)
        : await supabase.from('tipos_servico').insert(dados)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tipos-servico'] }),
  })
}
