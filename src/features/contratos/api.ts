import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Database, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Contratos recorrentes. O banco gera sozinho a mensalidade do mês atual e do
 * próximo (todo dia de madrugada) e ajusta as futuras se o contrato mudar.
 */

export type StatusContrato = Database['public']['Enums']['status_contrato']

export const NOME_STATUS_CONTRATO: Record<StatusContrato, string> = {
  ativo: 'Ativo',
  suspenso: 'Suspenso',
  encerrado: 'Encerrado',
}

export const COR_STATUS_CONTRATO = {
  ativo: 'verde',
  suspenso: 'alerta',
  encerrado: 'cinza',
} as const satisfies Record<StatusContrato, string>

const RELACOES = `
  cliente:clientes(id, nome, nome_fantasia),
  endereco:enderecos(id, apelido, logradouro, numero, cidade),
  vendedor:perfis!contratos_vendedor_id_fkey(id, nome),
  proposta:propostas(id, numero)
`

export function useContratos(filtro: { clienteId?: string } = {}) {
  return useQuery({
    queryKey: ['contratos', 'lista', filtro],
    queryFn: async () => {
      let consulta = supabase
        .from('contratos')
        .select(`*, ${RELACOES}`)
        .order('status')
        .order('data_inicio', { ascending: false })
      if (filtro.clienteId) consulta = consulta.eq('cliente_id', filtro.clienteId)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export type ContratoResumo = NonNullable<ReturnType<typeof useContratos>['data']>[number]

export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: ['contratos', 'um', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`*, ${RELACOES}`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Mensalidades geradas para o contrato (só Admin/Financeiro recebem algo). */
export function useMensalidades(contratoId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['financeiro', 'contrato', contratoId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_lancamentos')
        .select('id, competencia, vencimento, valor, valor_pago, status, situacao')
        .eq('contrato_id', contratoId)
        .order('competencia', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

function useAtualizar() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['contratos'] })
    void queryClient.invalidateQueries({ queryKey: ['financeiro'] })
  }
}

/** Categoria opcional: sem ela, o banco usa "Contrato recorrente" (o vendedor não vê categorias). */
export type DadosContrato = Omit<TablesInsert<'contratos'>, 'categoria_id'> & {
  categoria_id?: string
}

export function useSalvarContrato() {
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosContrato }) => {
      if (id) {
        const { error } = await supabase.from('contratos').update(dados).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from('contratos')
        .insert(dados as TablesInsert<'contratos'>)
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: atualizar,
  })
}

export function useAtualizarContrato(id: string) {
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: async (dados: TablesUpdate<'contratos'>) => {
      const { error } = await supabase.from('contratos').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/** "Gerar cobranças agora": mensalidades do mês atual e do próximo. */
export function useGerarCobrancas() {
  const atualizar = useAtualizar()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('gerar_cobrancas_contratos')
      if (error) throw error
      return data
    },
    onSuccess: atualizar,
  })
}
