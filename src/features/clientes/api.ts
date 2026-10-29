import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Tudo o que a área de clientes lê e grava no banco fica neste arquivo.
 * As telas só chamam estes "hooks" e não precisam saber como o Supabase funciona.
 * Lembrete: o banco aplica as regras de permissão (RLS) em cada consulta;
 * um vendedor que chamar useBuscaClientes recebe só os clientes dele.
 */

export type Cliente = Tables<'clientes'>
export type Endereco = Tables<'enderecos'>
export type Contato = Tables<'contatos_cliente'>
export type Atendimento = Tables<'atendimentos'>
export type RegistroAuditoria = Tables<'auditoria'>
export type MembroEquipe = Pick<Tables<'perfis'>, 'id' | 'nome' | 'papel' | 'ativo'>

const VENDEDOR = 'vendedor:perfis!clientes_vendedor_responsavel_id_fkey(id, nome)'

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

export function useBuscaClientes(termo: string, incluirInativos: boolean) {
  return useQuery({
    queryKey: ['clientes', 'busca', termo, incluirInativos],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('buscar_clientes', { termo, incluir_inativos: incluirInativos })
        .select(`*, ${VENDEDOR}, enderecos(cidade, uf, principal)`)
      if (error) throw error
      return data
    },
  })
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select(`*, ${VENDEDOR}, enderecos(*), contatos_cliente(*)`)
        .eq('id', id)
        .order('principal', { referencedTable: 'enderecos', ascending: false })
        .order('principal', { referencedTable: 'contatos_cliente', ascending: false })
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type ClienteCompleto = NonNullable<ReturnType<typeof useCliente>['data']>

export function useAtendimentos(clienteId: string) {
  return useQuery({
    queryKey: ['clientes', clienteId, 'atendimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*, usuario:perfis!atendimentos_usuario_id_fkey(nome)')
        .eq('cliente_id', clienteId)
        .order('data_hora', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useHistoricoCliente(clienteId: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['clientes', clienteId, 'historico'],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auditoria')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('em', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })
}

/** Todos os usuários (para mostrar nomes e escolher vendedor responsável). */
export function useEquipe() {
  return useQuery({
    queryKey: ['equipe'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome, papel, ativo')
        .order('nome')
      if (error) throw error
      return data as MembroEquipe[]
    },
  })
}

/** Quem pode ser vendedor responsável: usuários ativos que não são da recepção. */
export function equipeComercial(equipe: MembroEquipe[] | undefined): MembroEquipe[] {
  return (equipe ?? []).filter((p) => p.ativo && p.papel !== 'recepcao')
}

// -----------------------------------------------------------------------------
// Gravações
// -----------------------------------------------------------------------------

function useInvalidarCliente() {
  const queryClient = useQueryClient()
  return (clienteId?: string) =>
    queryClient.invalidateQueries({ queryKey: clienteId ? ['clientes', clienteId] : ['clientes'] })
}

export function useCriarCliente() {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async ({
      cliente,
      endereco,
    }: {
      cliente: TablesInsert<'clientes'>
      endereco: Omit<TablesInsert<'enderecos'>, 'cliente_id'> | null
    }) => {
      const { data, error } = await supabase.from('clientes').insert(cliente).select('id').single()
      if (error) throw error
      if (endereco) {
        const { error: erroEndereco } = await supabase
          .from('enderecos')
          .insert({ ...endereco, cliente_id: data.id, principal: true })
        if (erroEndereco) throw erroEndereco
      }
      return data.id
    },
    onSuccess: () => invalidar(),
  })
}

export function useAtualizarCliente(id: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async (dados: TablesUpdate<'clientes'>) => {
      const { error } = await supabase.from('clientes').update(dados).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar(),
  })
}

export function useSalvarEndereco(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id?: string
      dados: Omit<TablesInsert<'enderecos'>, 'cliente_id'>
    }) => {
      const { error } = id
        ? await supabase.from('enderecos').update(dados).eq('id', id)
        : await supabase.from('enderecos').insert({ ...dados, cliente_id: clienteId })
      if (error) throw error
    },
    onSuccess: () => invalidar(clienteId),
  })
}

export function useRemoverEndereco(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enderecos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar(clienteId),
  })
}

export function useSalvarContato(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id?: string
      dados: Omit<TablesInsert<'contatos_cliente'>, 'cliente_id'>
    }) => {
      const { error } = id
        ? await supabase.from('contatos_cliente').update(dados).eq('id', id)
        : await supabase.from('contatos_cliente').insert({ ...dados, cliente_id: clienteId })
      if (error) throw error
    },
    onSuccess: () => invalidar(clienteId),
  })
}

export function useRemoverContato(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contatos_cliente').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar(clienteId),
  })
}

export function useRegistrarAtendimento(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async (
      dados: Pick<TablesInsert<'atendimentos'>, 'canal' | 'resumo' | 'data_hora'>,
    ) => {
      const { error } = await supabase
        .from('atendimentos')
        .insert({ ...dados, cliente_id: clienteId })
      if (error) throw error
    },
    onSuccess: () => invalidar(clienteId),
  })
}

export function useRemoverAtendimento(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('atendimentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar(clienteId),
  })
}

export function useTransferirCliente(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async ({ novoVendedor, motivo }: { novoVendedor: string; motivo: string }) => {
      const { error } = await supabase.rpc('transferir_cliente', {
        cliente: clienteId,
        novo_vendedor: novoVendedor,
        motivo,
      })
      if (error) throw error
    },
    onSuccess: () => invalidar(),
  })
}

export function useAnonimizarCliente(clienteId: string) {
  const invalidar = useInvalidarCliente()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('anonimizar_cliente', { cliente: clienteId })
      if (error) throw error
    },
    onSuccess: () => invalidar(),
  })
}

/** Últimos atendimentos registrados (todos os clientes que a pessoa enxerga). */
export function useAtendimentosRecentes(limite = 10) {
  return useQuery({
    queryKey: ['clientes', 'atendimentos-recentes', limite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atendimentos')
        .select(
          '*, usuario:perfis!atendimentos_usuario_id_fkey(nome), cliente:clientes(id, nome, nome_fantasia)',
        )
        .order('data_hora', { ascending: false })
        .limit(limite)
      if (error) throw error
      return data
    },
  })
}
