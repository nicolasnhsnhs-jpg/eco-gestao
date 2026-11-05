import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

import type { Custos } from './calculo'

/** Custos e margens da calculadora (chave "servico.item" → valor). */
export function useCustosOrcamento() {
  return useQuery({
    queryKey: ['custos_orcamento'],
    queryFn: async (): Promise<Custos> => {
      const { data, error } = await supabase.from('custos_orcamento').select('chave, valor')
      if (error) throw error
      return Object.fromEntries(
        data.map((c) => [c.chave, c.valor == null ? null : Number(c.valor)]),
      )
    },
  })
}

/** Grava só o que mudou (só o Admin consegue: o banco recusa os outros). */
export function useSalvarCustos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (alterados: Custos) => {
      const linhas = Object.entries(alterados).map(([chave, valor]) => ({
        chave,
        valor: valor ?? null,
      }))
      if (!linhas.length) return
      const { error } = await supabase.from('custos_orcamento').upsert(linhas)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custos_orcamento'] }),
  })
}
