import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Json, Tables, TablesInsert } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Descrição do contrato assinado: o que o cliente tem no ano (serviços,
 * quantidades, frequência) e a taxa fora do horário. Um por cliente.
 * Não tem valor: o valor mensal fica no contrato recorrente.
 */

export type ItemContrato = {
  servico: string
  detalhe?: string
  quantidade?: number | null
  unidade?: string
  frequencia?: string
  vezes_ano?: number | null
  locais?: string
}

export type DescricaoContrato = Omit<Tables<'descricoes_contrato'>, 'itens'> & {
  itens: ItemContrato[]
}

/** Frequências mais comuns, com quantas vezes caem no ano. */
export const FREQUENCIAS: { nome: string; vezes: number | null }[] = [
  { nome: 'Semanal', vezes: 52 },
  { nome: 'Quinzenal', vezes: 24 },
  { nome: 'Mensal', vezes: 12 },
  { nome: 'Bimestral', vezes: 6 },
  { nome: 'Trimestral', vezes: 4 },
  { nome: 'Quadrimestral', vezes: 3 },
  { nome: 'Semestral', vezes: 2 },
  { nome: 'Anual', vezes: 1 },
  { nome: 'Sob demanda', vezes: null },
]

export function useDescricaoContrato(clienteId: string) {
  return useQuery({
    queryKey: ['descricao-contrato', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('descricoes_contrato')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle()
      if (error) throw error
      return data as DescricaoContrato | null
    },
  })
}

export type DadosDescricao = Omit<
  TablesInsert<'descricoes_contrato'>,
  'id' | 'cliente_id' | 'criado_em' | 'criado_por' | 'atualizado_em' | 'atualizado_por' | 'itens'
> & { itens: ItemContrato[] }

export function useSalvarDescricaoContrato(clienteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: DadosDescricao) => {
      const { error } = await supabase
        .from('descricoes_contrato')
        .upsert(
          { ...dados, cliente_id: clienteId, itens: dados.itens as unknown as Json },
          { onConflict: 'cliente_id' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['descricao-contrato', clienteId] }),
  })
}

export function useApagarDescricaoContrato(clienteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('descricoes_contrato')
        .delete()
        .eq('cliente_id', clienteId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['descricao-contrato', clienteId] }),
  })
}

/** "150 porta-iscas" / "2 reservatórios" / "" */
export function quantidadeTexto(item: ItemContrato): string {
  if (item.quantidade == null) return item.unidade ?? ''
  const n = item.quantidade.toLocaleString('pt-BR')
  return item.unidade ? `${n} ${item.unidade}` : n
}
