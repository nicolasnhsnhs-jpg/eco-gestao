import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'

import type { Tables } from '@/lib/database.types'
import type { Papel } from '@/lib/papeis'
import { supabase } from '@/lib/supabase'

export type Usuario = Tables<'perfis'>

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .order('ativo', { ascending: false })
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

/** Quantos clientes cada vendedor tem (para a transferência de carteira). */
export function useClientesPorVendedor() {
  return useQuery({
    queryKey: ['clientes', 'por-vendedor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('vendedor_responsavel_id')
        .not('vendedor_responsavel_id', 'is', null)
      if (error) throw error
      const contagem = new Map<string, number>()
      for (const c of data) {
        const id = c.vendedor_responsavel_id!
        contagem.set(id, (contagem.get(id) ?? 0) + 1)
      }
      return contagem
    },
  })
}

function useAtualizarListas() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['usuarios'] })
    void queryClient.invalidateQueries({ queryKey: ['equipe'] })
    void queryClient.invalidateQueries({ queryKey: ['clientes'] })
  }
}

/** Chama a Edge Function "usuarios" e traduz a mensagem de erro que ela devolve. */
async function chamarFuncao(corpo: Record<string, unknown>) {
  const { error } = await supabase.functions.invoke('usuarios', { body: corpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalhe = (await error.context.json().catch(() => null)) as { erro?: string } | null
      throw new Error(detalhe?.erro ?? 'Não foi possível concluir a ação.')
    }
    throw error
  }
}

export function useConvidarUsuario() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: (dados: { nome: string; email: string; papel: Papel }) =>
      chamarFuncao({
        acao: 'convidar',
        ...dados,
        redirecionarPara: `${window.location.origin}/definir-senha`,
      }),
    onSuccess: atualizar,
  })
}

export function useAlternarAtivo() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: ({ usuarioId, ativo }: { usuarioId: string; ativo: boolean }) =>
      chamarFuncao({ acao: ativo ? 'reativar' : 'desativar', usuarioId }),
    onSuccess: atualizar,
  })
}

export function useAlterarPapel() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: async ({ usuarioId, papel }: { usuarioId: string; papel: Papel }) => {
      const { error } = await supabase.from('perfis').update({ papel }).eq('id', usuarioId)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useAlterarNome() {
  const queryClient = useQueryClient()
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: async ({ usuarioId, nome }: { usuarioId: string; nome: string }) => {
      const { error } = await supabase.from('perfis').update({ nome }).eq('id', usuarioId)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      // Se for o próprio usuário, atualiza o nome no menu.
      void queryClient.invalidateQueries({ queryKey: ['perfil'] })
    },
  })
}

export function useAlterarComissao() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: async ({
      usuarioId,
      percentual,
    }: {
      usuarioId: string
      percentual: number | null
    }) => {
      const { error } = await supabase
        .from('perfis')
        .update({ comissao_percentual: percentual })
        .eq('id', usuarioId)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useTransferirCarteira() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: async (dados: { de: string; para: string; motivo: string }) => {
      const { data, error } = await supabase.rpc('transferir_carteira', {
        vendedor_atual: dados.de,
        novo_vendedor: dados.para,
        motivo: dados.motivo,
      })
      if (error) throw error
      return data
    },
    onSuccess: atualizar,
  })
}
