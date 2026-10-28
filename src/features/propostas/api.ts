import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database, Json, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Propostas: o banco decide quem vê o quê (Admin/Financeiro: todas;
 * vendedor: as dele e as dos clientes dele; recepção: nenhuma).
 */

export type StatusProposta = Database['public']['Enums']['status_proposta']
/** Status + "expirada", calculada pelo banco (enviada e depois da validade). */
export type SituacaoProposta = StatusProposta | 'expirada'
export type ItemProposta = Tables<'proposta_itens'>

export const NOME_SITUACAO_PROPOSTA: Record<SituacaoProposta, string> = {
  enviada: 'Enviada',
  expirada: 'Expirada',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
}

export const COR_SITUACAO_PROPOSTA = {
  enviada: 'cinza',
  expirada: 'alerta',
  aprovada: 'verde',
  recusada: 'perigo',
} as const satisfies Record<SituacaoProposta, string>

const RELACOES = `
  cliente:clientes(id, nome, nome_fantasia, vendedor_responsavel_id),
  vendedor:perfis!propostas_vendedor_id_fkey(id, nome),
  endereco:enderecos(id, apelido, logradouro, numero, cidade, uf)
`

export function usePropostas(filtro: { clienteId?: string } = {}) {
  return useQuery({
    queryKey: ['propostas', 'lista', filtro],
    queryFn: async () => {
      let consulta = supabase
        .from('v_propostas')
        .select(`*, ${RELACOES}`)
        .order('data_envio', { ascending: false })
        .order('numero', { ascending: false })
        .limit(300)
      if (filtro.clienteId) consulta = consulta.eq('cliente_id', filtro.clienteId)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export type PropostaResumo = NonNullable<ReturnType<typeof usePropostas>['data']>[number]

export function useProposta(id: string | undefined) {
  return useQuery({
    queryKey: ['propostas', 'uma', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_propostas')
        .select(`*, ${RELACOES}, itens:proposta_itens(*, tipo:tipos_servico(id, nome))`)
        .eq('id', id!)
        .order('ordem', { referencedTable: 'proposta_itens' })
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type PropostaCompleta = NonNullable<ReturnType<typeof useProposta>['data']>

function useAtualizarPropostas() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['propostas'] })
    void queryClient.invalidateQueries({ queryKey: ['avisos'] })
  }
}

type ItemNovo = Omit<TablesInsert<'proposta_itens'>, 'proposta_id' | 'id'>

/**
 * Salva a proposta e substitui os itens. A troca dos itens é feita por uma função
 * do banco, de uma vez só (tudo ou nada); o banco recalcula o total.
 */
export function useSalvarProposta() {
  const atualizar = useAtualizarPropostas()
  return useMutation({
    mutationFn: async ({
      id,
      dados,
      itens,
    }: {
      id?: string
      dados: TablesInsert<'propostas'>
      itens: ItemNovo[]
    }) => {
      let propostaId = id
      if (id) {
        const { error } = await supabase.from('propostas').update(dados).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('propostas').insert(dados).select('id').single()
        if (error) throw error
        propostaId = data.id
      }
      const { error: erroItens } = await supabase.rpc('salvar_itens_proposta', {
        proposta: propostaId!,
        itens: itens as unknown as Json,
      })
      if (erroItens) throw erroItens
      return propostaId!
    },
    onSuccess: atualizar,
  })
}

export function useResponderProposta(id: string) {
  const atualizar = useAtualizarPropostas()
  return useMutation({
    mutationFn: async (dados: Pick<TablesUpdate<'propostas'>, 'status' | 'motivo_recusa'>) => {
      const { error } = await supabase.from('propostas').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}
