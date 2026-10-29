import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type StatusComissao = Database['public']['Enums']['status_comissao']

/** Comissões em aberto (ainda não fechadas) com competência até o mês escolhido. */
export function useComissoesEmAberto(ateMes: string) {
  return useQuery({
    queryKey: ['financeiro', 'comissoes', 'abertas', ateMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select(
          `*, vendedor:perfis!comissoes_vendedor_id_fkey(id, nome),
           cliente:clientes(id, nome, nome_fantasia),
           origem:lancamentos!comissoes_lancamento_origem_id_fkey(id, descricao, status)`,
        )
        .eq('status', 'prevista')
        .is('fechamento_id', null)
        .lte('competencia', ateMes)
        .order('competencia')
      if (error) throw error
      return data
    },
  })
}

export type ComissaoAberta = NonNullable<ReturnType<typeof useComissoesEmAberto>['data']>[number]

export function useFechamentos() {
  return useQuery({
    queryKey: ['financeiro', 'comissoes', 'fechamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fechamentos_comissao')
        .select(`*, vendedor:perfis!fechamentos_comissao_vendedor_id_fkey(id, nome)`)
        .order('competencia', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
  })
}

/** n-ésimo dia útil de um mês, calculado pelo banco (considera os feriados). */
export function useDiaUtil(ano: number, mes: number, n: number) {
  return useQuery({
    queryKey: ['dia-util', ano, mes, n],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dia_util', { ano, mes, n })
      if (error) throw error
      return data
    },
  })
}

export function useFecharComissoes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dados: {
      vendedor: string
      mes: string
      vencimento: string
      conta: string | null
    }) => {
      const { data, error } = await supabase.rpc('fechar_comissoes', {
        vendedor: dados.vendedor,
        mes: dados.mes,
        vencimento: dados.vencimento,
        conta: dados.conta ?? undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['financeiro'] })
      void queryClient.invalidateQueries({ queryKey: ['avisos'] })
    },
  })
}

/** Comissões do usuário logado (o banco só devolve as dele, se for vendedor). */
export function useMinhasComissoes() {
  return useQuery({
    queryKey: ['comissoes', 'minhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('*, cliente:clientes(id, nome, nome_fantasia)')
        .neq('status', 'cancelada')
        .order('competencia', { ascending: false })
        .limit(500)
      if (error) throw error
      return data
    },
  })
}
