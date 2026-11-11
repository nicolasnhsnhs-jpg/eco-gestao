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
  if (error) await lancarErroDaFuncao(error)
}

async function lancarErroDaFuncao(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    const detalhe = (await error.context.json().catch(() => null)) as { erro?: string } | null
    throw new Error(detalhe?.erro ?? 'Não foi possível concluir a ação.')
  }
  throw error
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

export function useCriarOperador() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: (dados: { nome: string; login: string; senha: string }) =>
      chamarFuncao({ acao: 'criarOperador', ...dados }),
    onSuccess: atualizar,
  })
}

export function useDefinirSenha() {
  return useMutation({
    mutationFn: (dados: { usuarioId: string; senha: string }) =>
      chamarFuncao({ acao: 'definirSenha', ...dados }),
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

/** Troca o e-mail de acesso (ex.: o convite foi para um e-mail que a pessoa não usa). */
export function useAlterarEmail() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: (dados: { usuarioId: string; email: string }) =>
      chamarFuncao({ acao: 'alterarEmail', ...dados }),
    onSuccess: atualizar,
  })
}

/** Manda de novo, para o e-mail atual, o link para a pessoa criar a senha. */
export function useReenviarAcesso() {
  return useMutation({
    mutationFn: (usuarioId: string) =>
      chamarFuncao({
        acao: 'reenviarAcesso',
        usuarioId,
        redirecionarPara: `${window.location.origin}/definir-senha`,
      }),
  })
}

export function useResolverSolicitacao() {
  const atualizar = useAtualizarListas()
  return useMutation({
    mutationFn: (
      dados:
        { usuarioId: string; aprovar: true; papel: Papel } | { usuarioId: string; aprovar: false },
    ) =>
      dados.aprovar
        ? chamarFuncao({ acao: 'aprovar', usuarioId: dados.usuarioId, papel: dados.papel })
        : chamarFuncao({ acao: 'recusar', usuarioId: dados.usuarioId }),
    onSuccess: atualizar,
  })
}

// --- Links de cadastro -------------------------------------------------------

export type LinkCadastro = Tables<'links_cadastro'>

export function enderecoDoLink(codigo: string) {
  return `${window.location.origin}/cadastro/${codigo}`
}

export function useLinksCadastro() {
  return useQuery({
    queryKey: ['links-cadastro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_cadastro')
        .select('*')
        .eq('revogado', false)
        .gt('expira_em', new Date().toISOString())
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCriarLinkCadastro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ papel, dias }: { papel: Papel; dias: number }) => {
      const expira = new Date(Date.now() + dias * 24 * 60 * 60_000).toISOString()
      const { data, error } = await supabase
        .from('links_cadastro')
        .insert({ papel, expira_em: expira })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['links-cadastro'] }),
  })
}

export function useRevogarLinkCadastro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('links_cadastro')
        .update({ revogado: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['links-cadastro'] }),
  })
}

/** Tela pública: o link ainda vale? Para qual perfil? (sem login) */
export async function verLinkCadastro(codigo: string): Promise<Papel> {
  const { data, error } = await supabase.functions.invoke('usuarios', {
    body: { acao: 'verLink', codigo },
  })
  if (error) await lancarErroDaFuncao(error)
  return (data as { papel: Papel }).papel
}

export async function solicitarAcesso(dados: {
  codigo: string
  nome: string
  email: string
  senha: string
}) {
  await chamarFuncao({ acao: 'solicitarAcesso', ...dados })
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

/** Liga ou desliga o acesso ao CRM do WhatsApp (o admin sempre tem; o operador nunca). */
export function useAlterarAtendeWhatsapp() {
  const atualizar = useAtualizarListas()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ usuarioId, atende }: { usuarioId: string; atende: boolean }) => {
      const { error } = await supabase
        .from('perfis')
        .update({ atende_whatsapp: atende })
        .eq('id', usuarioId)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      void queryClient.invalidateQueries({ queryKey: ['crm', 'atendentes'] })
    },
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
