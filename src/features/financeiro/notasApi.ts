import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'

import { nomeSeguro, TAMANHO_MAXIMO } from '@/lib/arquivos'
import type { Database, TablesInsert } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * Notas fiscais de serviço, de contrato (a mensalidade) ou avulsas (serviço pontual).
 * Emitidas pelo sistema (função "nfse", direto no Sistema Nacional NFS-e) ou fora
 * dele (Safenota) e registradas aqui.
 */

export type TipoNota = Database['public']['Enums']['tipo_nota_fiscal']
export type StatusNota = Database['public']['Enums']['status_nota_fiscal']

export const NOME_TIPO_NOTA: Record<TipoNota, string> = {
  contrato: 'Contrato',
  avulsa: 'Avulsa',
}

export const NOME_STATUS_NOTA: Record<StatusNota, string> = {
  rascunho: 'Rascunho',
  emitida: 'Emitida',
  cancelada: 'Cancelada',
}

const RELACOES = `
  cliente:clientes(id, nome, nome_fantasia, cpf_cnpj, email),
  pdf:arquivos!arquivo_pdf_id(*),
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

function useAtualizarNotas() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['financeiro'] })
    void queryClient.invalidateQueries({ queryKey: ['contratos'] })
    void queryClient.invalidateQueries({ queryKey: ['avisos'] })
  }
}

/** O rascunho que não vai ser emitido (nota emitida não se apaga: cancela-se). */
export function useDescartarRascunho() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .delete()
        .eq('id', id)
        .eq('status', 'rascunho')
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/**
 * Guarda o PDF da nota nos arquivos do cliente (ligado à conta a receber, que só o
 * financeiro vê) e o liga à nota.
 */
export function useAnexarPdfNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async ({ nota, arquivo }: { nota: NotaFiscalCompleta; arquivo: File }) => {
      if (arquivo.type !== 'application/pdf') throw new Error('Escolha o PDF da nota.')
      if (arquivo.size > TAMANHO_MAXIMO) throw new Error('O PDF passa de 20 MB.')
      const id = crypto.randomUUID()
      const caminho = `clientes/${nota.cliente_id}/${id}-${nomeSeguro(arquivo.name)}`
      const envio = await supabase.storage
        .from('arquivos')
        .upload(caminho, arquivo, { contentType: 'application/pdf' })
      if (envio.error) throw envio.error

      const { error } = await supabase.from('arquivos').insert({
        id,
        caminho_storage: caminho,
        nome_original: arquivo.name,
        tipo_mime: 'application/pdf',
        tamanho_bytes: arquivo.size,
        categoria: 'nota_fiscal',
        cliente_id: nota.cliente_id,
        lancamento_id: nota.lancamento_id,
        descricao: nota.numero ? `NF ${nota.numero}` : null,
      })
      if (error) {
        await supabase.storage.from('arquivos').remove([caminho])
        throw error
      }
      const { error: erroNota } = await supabase
        .from('notas_fiscais')
        .update({ arquivo_pdf_id: id, enviada_em: null, enviada_para: null, erro_envio: null })
        .eq('id', nota.id)
      if (erroNota) throw erroNota
    },
    onSuccess: atualizar,
  })
}

/**
 * Manda o PDF ao e-mail do cliente (Edge Function "notas"). Sem e-mail, ou se o envio
 * falhar, a nota fica com envio pendente e o financeiro recebe um aviso: a resposta
 * diz isso em `pendente` em vez de dar erro.
 */
export function useEnviarNotaPorEmail() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async ({ notaId, para }: { notaId: string; para?: string }) => {
      const { data, error } = await supabase.functions.invoke('notas', {
        body: { acao: 'enviar', notaId, para },
      })
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const detalhe = (await error.context.json().catch(() => null)) as {
            erro?: string
            pendente?: boolean
          } | null
          if (detalhe?.pendente) return { enviada: false as const, motivo: detalhe.erro ?? '' }
          throw new Error(detalhe?.erro ?? 'Não foi possível enviar a nota.')
        }
        throw error
      }
      return { enviada: true as const, para: (data as { para: string[] }).para }
    },
    onSettled: atualizar,
  })
}

/** O financeiro mandou a nota por fora (WhatsApp, e-mail pessoal…): resolve o aviso. */
export function useMarcarNotaEnviada() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async ({ notaId, como }: { notaId: string; como: string }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ enviada_em: new Date().toISOString(), enviada_para: como, erro_envio: null })
        .eq('id', notaId)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

// -----------------------------------------------------------------------------
// Emissão pelo sistema (Edge Function "nfse", direto no Sistema Nacional NFS-e)
// -----------------------------------------------------------------------------

/** desligado | homologacao (testes do governo, nada vale) | producao */
export type AmbienteNfse = 'desligado' | 'homologacao' | 'producao'

export function useAmbienteNfse() {
  return useQuery({
    queryKey: ['configuracoes', 'nfse_ambiente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'nfse_ambiente')
        .maybeSingle()
      if (error) throw error
      return (data?.valor ?? 'desligado') as AmbienteNfse
    },
  })
}

/** Alíquota da CSLL retida (%), da configuração da emissão (padrão 1). */
export function useAliquotaCsll() {
  return useQuery({
    queryKey: ['configuracoes', 'nfse_aliquota_csll'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'nfse_aliquota_csll')
        .maybeSingle()
      const n = Number(String(data?.valor ?? '').replace(',', '.'))
      return Number.isFinite(n) && n > 0 ? n : 1
    },
  })
}

async function chamarNfse<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('nfse', { body: corpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalhe = (await error.context.json().catch(() => null)) as { erro?: string } | null
      throw new Error(detalhe?.erro ?? 'A emissão da nota falhou.')
    }
    throw error
  }
  return data as T
}

export type ResultadoEmissao = {
  numero: string
  chave: string
  envio: { enviada: true; para: string[] } | { enviada: false; motivo: string }
}

/** Emite o rascunho na Sefin Nacional: a nota vira emitida, com PDF, e vai ao cliente. */
export function useEmitirNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: (notaId: string) => chamarNfse<ResultadoEmissao>({ acao: 'emitir', notaId }),
    onSettled: atualizar,
  })
}

export type ResultadoEnsaio =
  | { ok: true; numero: string | null; chave: string; alertas: string[]; pdfBase64: string }
  | { ok: false; erro: string }

/** Manda o rascunho ao ambiente de testes do governo. A nota não muda. */
export function useEnsaiarNota() {
  return useMutation({
    mutationFn: (notaId: string) => chamarNfse<ResultadoEnsaio>({ acao: 'ensaiar', notaId }),
  })
}

export type ResultadoTesteNfse = {
  titular: string
  cnpj: string | null
  validoAte: string
  ambiente: AmbienteNfse
  conexao: string
}

/** Confere o certificado A1 e a conexão com a Sefin Nacional. */
export function useTestarNfse() {
  return useMutation({
    mutationFn: () => chamarNfse<ResultadoTesteNfse>({ acao: 'testar' }),
  })
}
