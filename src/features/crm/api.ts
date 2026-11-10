import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'

import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import { nomeDeArquivoSeguro, type SetorAtendimento, type StatusConversa } from './regras'

export type Mensagem = Tables<'wa_mensagens'>
export type Nota = Tables<'wa_notas'> & { autor: { nome: string } | null }
export type Etiqueta = Tables<'wa_etiquetas'>

const SELECT_CONVERSA = `
  id, status, setor, nao_lidas, responsavel_id, ultimo_responsavel_id, ultima_entrada_em,
  ultima_mensagem_em, ultima_mensagem_previa, finalizada_em,
  contato:wa_contatos (id, wa_id, nome_perfil, cliente_id,
    cliente:clientes (id, nome, nome_fantasia, vendedor_responsavel_id)),
  responsavel:perfis!wa_conversas_responsavel_id_fkey (id, nome),
  ultimo_responsavel:perfis!wa_conversas_ultimo_responsavel_id_fkey (id, nome),
  etiquetas:wa_conversa_etiquetas (etiqueta_id)
`

export type Conversa = {
  id: string
  status: StatusConversa
  setor: SetorAtendimento | null
  nao_lidas: number
  responsavel_id: string | null
  ultimo_responsavel_id: string | null
  ultima_entrada_em: string | null
  ultima_mensagem_em: string | null
  ultima_mensagem_previa: string | null
  finalizada_em: string | null
  contato: {
    id: string
    wa_id: string
    nome_perfil: string | null
    cliente_id: string | null
    cliente: {
      id: string
      nome: string
      nome_fantasia: string | null
      vendedor_responsavel_id: string | null
    } | null
  } | null
  responsavel: { id: string; nome: string } | null
  ultimo_responsavel: { id: string; nome: string } | null
  etiquetas: { etiqueta_id: string }[]
}

const CHAVE = ['crm'] as const

/** Conversas que a pessoa enxerga (o banco filtra pelo perfil), da mais recente para a mais antiga. */
export function useConversas(ativo = true) {
  return useQuery({
    queryKey: [...CHAVE, 'conversas'],
    enabled: ativo,
    // Plano B do tempo real: se o websocket cair, a lista se atualiza sozinha.
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_conversas')
        .select(SELECT_CONVERSA)
        .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
        .limit(500)
      if (error) throw error
      return data as unknown as Conversa[]
    },
  })
}

export function useConversa(id: string | undefined) {
  const conversas = useConversas()
  return { ...conversas, data: conversas.data?.find((c) => c.id === id) }
}

/** Total de mensagens não lidas, para o número no menu. */
export function useNaoLidasCrm(ativo: boolean) {
  return useQuery({
    queryKey: [...CHAVE, 'nao-lidas'],
    enabled: ativo,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_conversas')
        .select('nao_lidas')
        .gt('nao_lidas', 0)
        .neq('status', 'finalizada')
      if (error) throw error
      return data.reduce((soma, c) => soma + c.nao_lidas, 0)
    },
  })
}

const POR_PAGINA = 60

/** Mensagens de uma conversa, das mais antigas para as mais novas (as últimas `quantas`). */
export function useMensagens(conversaId: string | undefined, paginas: number) {
  return useQuery({
    queryKey: [...CHAVE, 'mensagens', conversaId, paginas],
    enabled: !!conversaId,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_mensagens')
        .select('*')
        .eq('conversa_id', conversaId!)
        .order('enviada_em', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(POR_PAGINA * paginas + 1)
      if (error) throw error
      const temMais = data.length > POR_PAGINA * paginas
      return { mensagens: data.slice(0, POR_PAGINA * paginas).reverse(), temMais }
    },
  })
}

export type EstadoConexao = 'conectando' | 'conectado' | 'reconectando'

// Um canal só para o app inteiro (aberto pelo layout); as telas leem o estado daqui.
let estadoConexao: EstadoConexao = 'conectando'
const ouvintesConexao = new Set<() => void>()
function definirConexao(novo: EstadoConexao) {
  estadoConexao = novo
  ouvintesConexao.forEach((avisar) => avisar())
}

/** Situação da conexão em tempo real (para o aviso "reconectando"). */
export function useEstadoConexaoCrm(): EstadoConexao {
  return useSyncExternalStore(
    (avisar) => {
      ouvintesConexao.add(avisar)
      return () => ouvintesConexao.delete(avisar)
    },
    () => estadoConexao,
  )
}

/**
 * Tempo real: o banco avisa quando chega mensagem ou muda uma conversa (só as que a
 * pessoa pode ver). Quando o app volta do segundo plano (o iPhone derruba a conexão)
 * ou a internet volta, busca tudo de novo para não perder nada. Usar uma vez só (layout).
 */
export function useTempoRealCrm(ativo: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ativo) return
    definirConexao('conectando')
    const atualizar = (conversaId?: string) => {
      void queryClient.invalidateQueries({ queryKey: [...CHAVE, 'conversas'] })
      void queryClient.invalidateQueries({ queryKey: [...CHAVE, 'nao-lidas'] })
      if (conversaId) {
        void queryClient.invalidateQueries({ queryKey: [...CHAVE, 'mensagens', conversaId] })
      }
    }
    const canal = supabase
      .channel('crm-whatsapp')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_mensagens' }, (p) => {
        const linha = (p.new ?? p.old) as { conversa_id?: string }
        atualizar(linha.conversa_id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversas' }, () =>
        atualizar(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          definirConexao('conectado')
          // Ao (re)conectar, busca o que pode ter chegado enquanto estava desconectado.
          void queryClient.invalidateQueries({ queryKey: CHAVE })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          definirConexao('reconectando')
        }
      })

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: CHAVE })
      }
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', aoVoltar)
      void supabase.removeChannel(canal)
    }
  }, [ativo, queryClient])
}

/**
 * Erro da função "crm". Com `mensagemId`, a mensagem já ficou gravada como "falhou" na
 * conversa (com o botão "Tentar de novo"); sem ele, nada foi gravado.
 */
export class FalhaCrm extends Error {
  readonly mensagemId?: string
  constructor(mensagem: string, mensagemId?: string) {
    super(mensagem)
    this.mensagemId = mensagemId
  }
}

/** Chama a Edge Function "crm" e traduz a mensagem de erro que ela devolve. */
async function chamarCrm<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('crm', { body: corpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalhe = (await error.context.json().catch(() => null)) as {
        erro?: string
        mensagemId?: string
      } | null
      throw new FalhaCrm(detalhe?.erro ?? 'Não foi possível concluir a ação.', detalhe?.mensagemId)
    }
    throw new FalhaCrm('Sem conexão com o servidor. Verifique a internet.')
  }
  return data as T
}

function useAtualizarCrm() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: CHAVE })
}

export function useEnviarMensagem(conversaId: string) {
  const atualizar = useAtualizarCrm()
  return useMutation({
    mutationFn: async ({
      texto,
      arquivo,
      respondeWamid,
    }: {
      texto?: string
      arquivo?: File
      respondeWamid?: string | null
    }) => {
      let anexo: { caminho: string; mime: string; nome: string; tamanho: number } | undefined
      if (arquivo) {
        const caminho = `enviadas/${conversaId}/${crypto.randomUUID()}-${nomeDeArquivoSeguro(arquivo.name)}`
        const mime = arquivo.type || 'application/octet-stream'
        const { error } = await supabase.storage
          .from('whatsapp')
          .upload(caminho, arquivo, { contentType: mime })
        if (error) throw new Error(`Não consegui enviar o arquivo: ${error.message}`)
        anexo = { caminho, mime, nome: arquivo.name, tamanho: arquivo.size }
      }
      return chamarCrm<{ mensagemId: string }>({
        acao: 'enviar',
        conversaId,
        texto,
        arquivo: anexo,
        respondeWamid: respondeWamid ?? undefined,
      })
    },
    onSettled: atualizar,
  })
}

/** Ao abrir a conversa: zera as não lidas e manda a confirmação de leitura ao cliente. */
export function useMarcarLida() {
  const atualizar = useAtualizarCrm()
  return useMutation({
    mutationFn: (conversaId: string) => chamarCrm({ acao: 'lida', conversaId }),
    onSuccess: atualizar,
  })
}

/**
 * Endereço temporário (1 hora) de uma mídia da conversa. Se o webhook ainda não
 * copiou o arquivo da Meta, pede para copiar agora.
 */
export function useUrlMidia(mensagem: Pick<Mensagem, 'id' | 'midia_caminho' | 'midia_id'>) {
  return useQuery({
    queryKey: [...CHAVE, 'midia', mensagem.id, mensagem.midia_caminho],
    enabled: !!(mensagem.midia_caminho || mensagem.midia_id),
    staleTime: 50 * 60_000,
    retry: 1,
    queryFn: async () => {
      let caminho = mensagem.midia_caminho
      if (!caminho) {
        caminho = (await chamarCrm<{ caminho: string }>({ acao: 'midia', mensagemId: mensagem.id }))
          .caminho
      }
      const { data, error } = await supabase.storage.from('whatsapp').createSignedUrl(caminho, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

// -----------------------------------------------------------------------------
// Atendimento: responsável, status, cliente, etiquetas e notas
// -----------------------------------------------------------------------------

function useRpc<A extends Record<string, unknown>>(
  executar: (args: A) => PromiseLike<{ error: unknown }>,
) {
  const atualizar = useAtualizarCrm()
  return useMutation({
    mutationFn: async (args: A) => {
      const { error } = await executar(args)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export const useAssumir = () => useRpc((a: { conversa: string }) => supabase.rpc('crm_assumir', a))

export const useTransferir = () =>
  useRpc(
    (a: {
      conversa: string
      responsavel: string | null
      novo_setor: SetorAtendimento | null
      motivo: string | null
    }) =>
      supabase.rpc('crm_transferir', {
        conversa: a.conversa,
        // A função aceita nulo (volta para o primeiro contato); os tipos gerados não sabem.
        responsavel: a.responsavel as string,
        novo_setor: a.novo_setor ?? undefined,
        motivo: a.motivo ?? undefined,
      }),
  )

export const useMudarStatus = () =>
  useRpc((a: { conversa: string; novo_status: StatusConversa }) => supabase.rpc('crm_status', a))

export const useVincularCliente = () =>
  useRpc((a: { conversa: string; cliente: string | null }) =>
    supabase.rpc('crm_vincular_cliente', { conversa: a.conversa, cliente: a.cliente as string }),
  )

/** Quem atende pelo WhatsApp (para transferir). */
export function useAtendentes() {
  return useQuery({
    queryKey: [...CHAVE, 'atendentes'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome, papel, atende_whatsapp')
        .eq('ativo', true)
        .neq('papel', 'operador')
        .order('nome')
      if (error) throw error
      return data.filter((p) => p.papel === 'admin' || p.atende_whatsapp)
    },
  })
}

export function useNotas(conversaId: string) {
  return useQuery({
    queryKey: [...CHAVE, 'notas', conversaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_notas')
        .select('*, autor:perfis (nome)')
        .eq('conversa_id', conversaId)
        .order('criado_em')
      if (error) throw error
      return data as unknown as Nota[]
    },
  })
}

export function useAdicionarNota(conversaId: string) {
  const atualizar = useAtualizarCrm()
  return useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase.from('wa_notas').insert({ conversa_id: conversaId, texto })
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useApagarNota() {
  const atualizar = useAtualizarCrm()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wa_notas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useEtiquetas() {
  return useQuery({
    queryKey: [...CHAVE, 'etiquetas'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('wa_etiquetas').select('*').order('nome')
      if (error) throw error
      return data
    },
  })
}

export function useCriarEtiqueta() {
  const atualizar = useAtualizarCrm()
  return useMutation({
    mutationFn: async (dados: { nome: string; cor: string }) => {
      const { error } = await supabase.from('wa_etiquetas').insert(dados)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useAlternarEtiqueta() {
  const atualizar = useAtualizarCrm()
  return useMutation({
    mutationFn: async (a: { conversaId: string; etiquetaId: string; marcar: boolean }) => {
      const { error } = a.marcar
        ? await supabase
            .from('wa_conversa_etiquetas')
            .insert({ conversa_id: a.conversaId, etiqueta_id: a.etiquetaId })
        : await supabase
            .from('wa_conversa_etiquetas')
            .delete()
            .eq('conversa_id', a.conversaId)
            .eq('etiqueta_id', a.etiquetaId)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

export function useTransferencias(conversaId: string) {
  return useQuery({
    queryKey: [...CHAVE, 'transferencias', conversaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wa_transferencias')
        .select(
          'id, em, setor, motivo, anterior:perfis!wa_transferencias_responsavel_anterior_fkey (nome), novo:perfis!wa_transferencias_responsavel_novo_fkey (nome), feita:perfis!wa_transferencias_feita_por_fkey (nome)',
        )
        .eq('conversa_id', conversaId)
        .order('em', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as unknown as {
        id: string
        em: string
        setor: SetorAtendimento | null
        motivo: string | null
        anterior: { nome: string } | null
        novo: { nome: string } | null
        feita: { nome: string } | null
      }[]
    },
  })
}

/** Ao finalizar: guarda um resumo no histórico de atendimentos da ficha do cliente. */
export function useRegistrarAtendimento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (a: { clienteId: string; resumo: string }) => {
      const { error } = await supabase
        .from('atendimentos')
        .insert({ cliente_id: a.clienteId, canal: 'whatsapp', resumo: a.resumo })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}
