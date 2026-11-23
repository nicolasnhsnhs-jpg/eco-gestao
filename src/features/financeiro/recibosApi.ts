import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Tables, TablesInsert } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/** Recibos avulsos (o que não tem nota fiscal). Só Admin e Financeiro enxergam. */
export type Recibo = Tables<'recibos'>
export type NovoRecibo = Pick<
  TablesInsert<'recibos'>,
  | 'data'
  | 'cliente_id'
  | 'pagador_nome'
  | 'pagador_documento'
  | 'descricao'
  | 'valor'
  | 'forma_pagamento'
  | 'observacoes'
  | 'assinatura_digital'
>

const CHAVE = ['financeiro', 'recibos'] as const

export function useRecibos() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recibos')
        .select('*')
        .order('numero', { ascending: false })
        .limit(300)
      if (error) throw error
      return data
    },
  })
}

export function useSalvarRecibo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: NovoRecibo }) => {
      const consulta = id
        ? supabase.from('recibos').update(dados).eq('id', id)
        : supabase.from('recibos').insert(dados)
      const { data, error } = await consulta.select('*').single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

export function useCancelarRecibo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cancelado }: { id: string; cancelado: boolean }) => {
      const { error } = await supabase.from('recibos').update({ cancelado }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  })
}

/** Razão social e CPF/CNPJ do cliente, para já preencher o pagador. */
export async function documentoDoCliente(id: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('nome, cpf_cnpj, tipo_pessoa')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
