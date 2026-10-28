import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Leituras e gravações do financeiro.
 * Só Admin e Financeiro conseguem dados aqui: para os outros perfis o banco devolve vazio.
 */

export type Lancamento = Tables<'v_lancamentos'>
export type ContaBancaria = Tables<'v_saldos_contas'>
export type Categoria = Tables<'categorias_financeiras'>
export type Fornecedor = Tables<'fornecedores'>

export type Painel = {
  saldo_atual: number
  a_receber: number
  a_pagar: number
  receber_atrasado: number
  pagar_atrasado: number
  receber_hoje: number
  pagar_hoje: number
  receber_30_dias: number
  pagar_30_dias: number
}

const RELACOES = `
  cliente:clientes(id, nome, nome_fantasia),
  fornecedor:fornecedores(id, nome),
  categoria:categorias_financeiras(id, nome),
  conta:contas_bancarias(id, nome)
`

export type FiltroLancamentos = {
  tipo: 'todos' | 'entrada' | 'saida'
  situacao: 'em_aberto' | 'atrasado' | 'realizado' | 'cancelado' | 'todos'
  /** Mês do vencimento, "2026-10". Vazio = todos os meses. */
  mes: string
  busca: string
  clienteId?: string
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

export function useLancamentos(filtro: FiltroLancamentos) {
  return useQuery({
    queryKey: ['financeiro', 'lancamentos', filtro],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let consulta = supabase
        .from('v_lancamentos')
        .select(`*, ${RELACOES}`)
        .order('vencimento', { ascending: true })
        .limit(500)

      if (filtro.tipo !== 'todos') consulta = consulta.eq('tipo', filtro.tipo)
      if (filtro.situacao === 'em_aberto')
        consulta = consulta.in('status', ['pendente', 'agendado'])
      else if (filtro.situacao !== 'todos') consulta = consulta.eq('situacao', filtro.situacao)
      if (filtro.mes) {
        const [ano, mes] = filtro.mes.split('-').map(Number)
        const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10)
        consulta = consulta.gte('vencimento', `${filtro.mes}-01`).lte('vencimento', fim)
      }
      if (filtro.busca.trim()) {
        const termo = filtro.busca.trim().replace(/[%,()]/g, ' ')
        consulta = consulta.or(`descricao.ilike.%${termo}%,numero_nota_fiscal.ilike.%${termo}%`)
      }
      if (filtro.clienteId) consulta = consulta.eq('cliente_id', filtro.clienteId)

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export type LancamentoCompleto = NonNullable<ReturnType<typeof useLancamentos>['data']>[number]

export function useLancamento(id: string | undefined) {
  return useQuery({
    queryKey: ['financeiro', 'lancamento', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lancamentos')
        .select(`*, ${RELACOES}`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Lançamentos de um cliente (para a ficha). */
export function useLancamentosDoCliente(clienteId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['financeiro', 'cliente', clienteId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lancamentos')
        .select(`*, ${RELACOES}`)
        .eq('cliente_id', clienteId)
        .neq('status', 'cancelado')
        .order('vencimento', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })
}

export function usePainel() {
  return useQuery({
    queryKey: ['financeiro', 'painel'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_financeiro')
      if (error) throw error
      return data as unknown as Painel
    },
  })
}

export function useResumoMensal() {
  return useQuery({
    queryKey: ['financeiro', 'resumo'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resumo_mensal', {
        meses_antes: 5,
        meses_depois: 2,
      })
      if (error) throw error
      return data
    },
  })
}

export function useContas() {
  return useQuery({
    queryKey: ['financeiro', 'contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_saldos_contas')
        .select('*')
        .order('ativo', { ascending: false })
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['financeiro', 'categorias'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('*')
        .order('tipo')
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useFornecedores() {
  return useQuery({
    queryKey: ['financeiro', 'fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('ativo', { ascending: false })
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

// -----------------------------------------------------------------------------
// Gravações
// -----------------------------------------------------------------------------

/** Depois de qualquer gravação, atualiza painel, listas e avisos. */
function useAtualizarFinanceiro() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['financeiro'] })
    void queryClient.invalidateQueries({ queryKey: ['avisos'] })
  }
}

export function useCriarLancamentos() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    // Várias linhas num único INSERT: ou entram todas as parcelas, ou nenhuma.
    mutationFn: async (lancamentos: TablesInsert<'lancamentos'>[]) => {
      const { data, error } = await supabase.from('lancamentos').insert(lancamentos).select('id')
      if (error) throw error
      return data
    },
    onSuccess: atualizar,
  })
}

export function useAtualizarLancamento() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: TablesUpdate<'lancamentos'> }) => {
      const { error } = await supabase.from('lancamentos').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export type Confirmacao = {
  data_pagamento: string
  valor_pago: number
  conta_bancaria_id: string
  forma_pagamento: TablesUpdate<'lancamentos'>['forma_pagamento']
}

/** "O dinheiro entrou/saiu": marca como realizado. */
export function useConfirmarLancamento() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Confirmacao }) => {
      const { error } = await supabase
        .from('lancamentos')
        .update({ ...dados, status: 'realizado' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useSalvarConta() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TablesInsert<'contas_bancarias'> }) => {
      const { error } = id
        ? await supabase.from('contas_bancarias').update(dados).eq('id', id)
        : await supabase.from('contas_bancarias').insert(dados)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useSalvarCategoria() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id?: string
      dados: TablesInsert<'categorias_financeiras'>
    }) => {
      const { error } = id
        ? await supabase.from('categorias_financeiras').update(dados).eq('id', id)
        : await supabase.from('categorias_financeiras').insert(dados)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useSalvarFornecedor() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TablesInsert<'fornecedores'> }) => {
      if (id) {
        const { error } = await supabase.from('fornecedores').update(dados).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from('fornecedores')
        .insert(dados)
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: atualizar,
  })
}
