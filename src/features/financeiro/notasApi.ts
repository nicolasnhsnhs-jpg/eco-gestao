import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database, TablesInsert } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Notas fiscais de serviço. São emitidas fora do sistema (hoje no Safenota) e
 * registradas aqui como nota de contrato (a mensalidade) ou avulsa (serviço pontual).
 */

export type TipoNota = Database['public']['Enums']['tipo_nota_fiscal']
export type StatusNota = Database['public']['Enums']['status_nota_fiscal']

export const NOME_TIPO_NOTA: Record<TipoNota, string> = {
  contrato: 'Contrato',
  avulsa: 'Avulsa',
}

export const NOME_STATUS_NOTA: Record<StatusNota, string> = {
  emitida: 'Emitida',
  cancelada: 'Cancelada',
}

const RELACOES = `
  cliente:clientes(id, nome, nome_fantasia, cpf_cnpj),
  contrato:contratos(id, descricao, valor_mensal),
  lancamento:lancamentos(id, status, valor, vencimento)
`

export type FiltroNotas = {
  /** "2026-11" (mês de competência) ou vazio = todos. */
  mes: string
  tipo: TipoNota | 'todos'
  status: StatusNota | 'todos'
  busca: string
  contratoId?: string
}

export function useNotasFiscais(filtro: FiltroNotas) {
  return useQuery({
    queryKey: ['financeiro', 'notas', filtro],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let consulta = supabase
        .from('notas_fiscais')
        .select(`*, ${RELACOES}`)
        .order('competencia', { ascending: false })
        .order('numero', { ascending: false })
        .limit(1000)

      if (filtro.mes) consulta = consulta.eq('competencia', `${filtro.mes}-01`)
      if (filtro.tipo !== 'todos') consulta = consulta.eq('tipo', filtro.tipo)
      if (filtro.status !== 'todos') consulta = consulta.eq('status', filtro.status)
      if (filtro.contratoId) consulta = consulta.eq('contrato_id', filtro.contratoId)
      if (filtro.busca.trim()) {
        const termo = filtro.busca.trim().replace(/[%,()]/g, ' ')
        consulta = consulta.or(`numero.ilike.%${termo}%,descricao.ilike.%${termo}%`)
      }

      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export type NotaFiscalCompleta = NonNullable<ReturnType<typeof useNotasFiscais>['data']>[number]

export function useNotaFiscal(id: string | undefined) {
  return useQuery({
    queryKey: ['financeiro', 'nota', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select(`*, ${RELACOES}`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Última nota de um contrato: é dela que a próxima copia descrição e impostos. */
export function useUltimaNotaDoContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['financeiro', 'notas', 'ultima', contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*')
        .eq('contrato_id', contratoId!)
        .eq('status', 'emitida')
        .order('competencia', { ascending: false })
        .order('data_emissao', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSalvarNotaFiscal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: TablesInsert<'notas_fiscais'> }) => {
      if (id) {
        const { error } = await supabase.from('notas_fiscais').update(dados).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from('notas_fiscais')
        .insert(dados)
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['financeiro'] })
      void queryClient.invalidateQueries({ queryKey: ['contratos'] })
    },
  })
}

/** Mensalidades em aberto do contrato, para ligar a nota à conta a receber. */
export function useMensalidadesDoContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['financeiro', 'contrato', contratoId, 'abertas'],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('id, competencia, vencimento, valor, status, numero_nota_fiscal')
        .eq('contrato_id', contratoId!)
        .neq('status', 'cancelado')
        .order('competencia', { ascending: false })
        .limit(12)
      if (error) throw error
      return data
    },
  })
}
