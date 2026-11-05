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
export type CartaoCredito = Tables<'cartoes_credito'>
export type ContaFixa = Tables<'lancamentos_recorrentes'>
export type Investimento = Tables<'v_saldos_investimentos'>
export type MovimentoInvestimento = Tables<'movimentos_investimento'>

export type Painel = {
  saldo_atual: number
  /** Total nos investimentos: fica fora do saldo atual e do projetado. */
  investido: number
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
  conta:contas_bancarias(id, nome),
  cartao:cartoes_credito(id, nome)
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

// -----------------------------------------------------------------------------
// Contas fixas (lançamentos recorrentes)
// -----------------------------------------------------------------------------

/** Contas fixas: o banco lança sozinho a de cada mês (do atual e do próximo), pendente. */
export function useContasFixas() {
  return useQuery({
    queryKey: ['financeiro', 'contas-fixas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_recorrentes')
        .select(
          '*, cliente:clientes(id, nome, nome_fantasia), fornecedor:fornecedores(id, nome), categoria:categorias_financeiras(id, nome)',
        )
        .order('ativo', { ascending: false })
        .order('tipo', { ascending: false })
        .order('dia_vencimento')
      if (error) throw error
      return data
    },
  })
}

export type ContaFixaCompleta = NonNullable<ReturnType<typeof useContasFixas>['data']>[number]

export function useContaFixa(id: string | null | undefined) {
  return useQuery({
    queryKey: ['financeiro', 'conta-fixa', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_recorrentes')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSalvarContaFixa() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id?: string
      dados: TablesUpdate<'lancamentos_recorrentes'>
    }) => {
      const { error } = id
        ? await supabase.from('lancamentos_recorrentes').update(dados).eq('id', id)
        : await supabase
            .from('lancamentos_recorrentes')
            .insert(dados as TablesInsert<'lancamentos_recorrentes'>)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

// -----------------------------------------------------------------------------
// Cartões de crédito
// -----------------------------------------------------------------------------

export function useCartoes() {
  return useQuery({
    queryKey: ['financeiro', 'cartoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cartoes_credito')
        .select('*')
        .order('ativo', { ascending: false })
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useSalvarCartao() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TablesInsert<'cartoes_credito'> }) => {
      const { error } = id
        ? await supabase.from('cartoes_credito').update(dados).eq('id', id)
        : await supabase.from('cartoes_credito').insert(dados)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/** Compras no cartão: as em aberto (todas) e as pagas dos últimos meses. */
export function useComprasNoCartao(desde: string) {
  return useQuery({
    queryKey: ['financeiro', 'compras-cartao', desde],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lancamentos')
        .select(`*, ${RELACOES}`)
        .not('cartao_credito_id', 'is', null)
        .neq('status', 'cancelado')
        .or(`status.in.(pendente,agendado),vencimento.gte.${desde}`)
        .order('vencimento')
        .order('data_compra')
        .limit(1000)
      if (error) throw error
      return data
    },
  })
}

export type PagamentoFatura = {
  cartaoId: string
  vencimento: string
  data_pagamento: string
  conta_bancaria_id: string
}

/** Paga a fatura: confirma de uma vez todas as compras em aberto dela. */
export function usePagarFatura() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({ cartaoId, vencimento, ...dados }: PagamentoFatura) => {
      // Um único UPDATE: ou todas as compras da fatura são confirmadas, ou nenhuma.
      const { error } = await supabase
        .from('lancamentos')
        .update({ ...dados, status: 'realizado' })
        .eq('cartao_credito_id', cartaoId)
        .eq('vencimento', vencimento)
        .in('status', ['pendente', 'agendado'])
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

// -----------------------------------------------------------------------------
// Investimentos
// -----------------------------------------------------------------------------

export function useInvestimentos() {
  return useQuery({
    queryKey: ['financeiro', 'investimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_saldos_investimentos')
        .select('*')
        .order('ativo', { ascending: false })
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useMovimentosInvestimento() {
  return useQuery({
    queryKey: ['financeiro', 'movimentos-investimento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentos_investimento')
        .select('*, investimento:investimentos(id, nome), conta:contas_bancarias(id, nome)')
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(300)
      if (error) throw error
      return data
    },
  })
}

export function useSalvarInvestimento() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TablesInsert<'investimentos'> }) => {
      const { error } = id
        ? await supabase.from('investimentos').update(dados).eq('id', id)
        : await supabase.from('investimentos').insert(dados)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useRegistrarMovimentoInvestimento() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async (dados: TablesInsert<'movimentos_investimento'>) => {
      const { error } = await supabase.from('movimentos_investimento').insert(dados)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/** Movimento lançado errado: fica no histórico, mas sai das contas. */
export function useCancelarMovimentoInvestimento() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('movimentos_investimento')
        .update({ cancelado: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

// -----------------------------------------------------------------------------
// Antecipação de recebíveis
// -----------------------------------------------------------------------------

export type Antecipacao = {
  lancamentos: string[]
  data: string
  conta_bancaria_id: string
  instituicao: string
  /** Em reais (a tela converte quando a pessoa digita em %). */
  desconto: number
  observacoes?: string
}

/**
 * Antecipa as contas a receber escolhidas: ficam realizadas na data da antecipação,
 * cada uma com a sua parte do desconto, e o vencimento do cliente continua guardado.
 */
export function useAntecipar() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async (a: Antecipacao) => {
      const { data, error } = await supabase.rpc('antecipar_recebiveis', {
        p_lancamentos: a.lancamentos,
        p_data: a.data,
        p_conta: a.conta_bancaria_id,
        p_instituicao: a.instituicao,
        p_desconto: a.desconto,
        p_observacoes: a.observacoes || undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: atualizar,
  })
}

export function useAntecipacoes() {
  return useQuery({
    queryKey: ['financeiro', 'antecipacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('antecipacoes')
        .select(
          '*, conta:contas_bancarias(id, nome), lancamentos(id, descricao, vencimento, valor, valor_pago, cliente:clientes(id, nome, nome_fantasia))',
        )
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })
}

export type AntecipacaoCompleta = NonNullable<ReturnType<typeof useAntecipacoes>['data']>[number]

/** Antecipação lançada errado: as contas voltam a ficar em aberto. Só o administrador. */
export function useDesfazerAntecipacao() {
  const atualizar = useAtualizarFinanceiro()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('desfazer_antecipacao', { p_antecipacao: id })
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}
