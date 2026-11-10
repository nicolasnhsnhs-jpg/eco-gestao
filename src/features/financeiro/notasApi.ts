import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'

import { nomeSeguro, TAMANHO_MAXIMO } from '@/lib/arquivos'
import type { Database, TablesInsert } from '@/lib/database.types'
import { hojeISO } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { UNIDADE } from '@/lib/unidade'

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
  cliente:clientes(id, nome, nome_fantasia, cpf_cnpj, email, emails_extras),
  pdf:arquivos!arquivo_pdf_id(*),
  boleto:arquivos!arquivo_boleto_id(*),
  contrato:contratos(id, descricao, valor_mensal),
  lancamento:lancamentos(id, status, valor, vencimento)
`

export type FiltroNotas = {
  /** "2026-11" (mês de competência) ou vazio = todos. */
  mes: string
  /** "2026-11-10" (dia da emissão) ou vazio = todos. */
  dia?: string
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
      if (filtro.dia) consulta = consulta.eq('data_emissao', filtro.dia)
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
 * Guarda um PDF da nota (a própria nota ou o boleto) nos arquivos do cliente, ligado à
 * conta a receber (que só o financeiro vê). Devolve o id do arquivo.
 */
async function guardarPdfDaNota(
  nota: NotaFiscalCompleta,
  arquivo: File,
  categoria: 'nota_fiscal' | 'boleto',
  descricao: string | null,
): Promise<string> {
  if (arquivo.type !== 'application/pdf') throw new Error('Escolha um arquivo PDF.')
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
    categoria,
    cliente_id: nota.cliente_id,
    lancamento_id: nota.lancamento_id,
    descricao,
  })
  if (error) {
    await supabase.storage.from('arquivos').remove([caminho])
    throw error
  }
  return id
}

/** Liga o PDF da nota emitida (trocar o PDF zera o envio, para mandar de novo). */
export function useAnexarPdfNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async ({ nota, arquivo }: { nota: NotaFiscalCompleta; arquivo: File }) => {
      const id = await guardarPdfDaNota(
        nota,
        arquivo,
        'nota_fiscal',
        nota.numero ? `NF ${nota.numero}` : null,
      )
      const { error: erroNota } = await supabase
        .from('notas_fiscais')
        .update({ arquivo_pdf_id: id, enviada_em: null, enviada_para: null, erro_envio: null })
        .eq('id', nota.id)
      if (erroNota) throw erroNota
    },
    onSuccess: atualizar,
  })
}

/** Anexa (ou troca) o boleto da nota; ele segue no e-mail junto com a nota. */
export function useAnexarBoletoNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async ({ nota, arquivo }: { nota: NotaFiscalCompleta; arquivo: File }) => {
      const id = await guardarPdfDaNota(
        nota,
        arquivo,
        'boleto',
        nota.numero ? `Boleto da NF ${nota.numero}` : 'Boleto',
      )
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ arquivo_boleto_id: id })
        .eq('id', nota.id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/** Tira o boleto da nota (o arquivo continua na ficha do cliente). */
export function useTirarBoletoNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async (notaId: string) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ arquivo_boleto_id: null })
        .eq('id', notaId)
      if (error) throw error
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

/** IBS/CBS da configuração (vai igual em todas as notas até as regras de 2027). */
export function useIbsCbs() {
  return useQuery({
    queryKey: ['configuracoes', 'nfse_ibscbs'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['nfse_ibscbs_cst', 'nfse_ibscbs_classificacao'])
      const valor = (chave: string) => data?.find((c) => c.chave === chave)?.valor ?? ''
      return {
        cst: String(valor('nfse_ibscbs_cst') || '000'),
        classificacao: String(valor('nfse_ibscbs_classificacao') || '000001'),
      }
    },
  })
}

export type AliquotaDaCidade = {
  municipio: string
  aliquota: number | null
  /** O código do serviço em que a cidade tem a alíquota (ex.: 07.10.01.001). */
  codigoServico?: string | null
  detalhe: string | null
}

/** A alíquota do ISS como está parametrizada no Sistema Nacional para a cidade. */
export function useAliquotaIssDaCidade() {
  return useMutation({
    mutationFn: (p: {
      clienteId: string
      contratoId?: string | null
      municipio?: string | null
      codigoTributacao: string
    }) => chamarNfse<AliquotaDaCidade>({ acao: 'aliquotaIss', ...p }),
  })
}

/** Uma NFS-e que a empresa emitiu, como veio do Sistema Nacional (de qualquer emissor). */
export type NotaDoAdn = {
  chave: string
  numero: string | null
  emitida_em: string | null
  valor: number | null
  descricao: string | null
  codigo_tributacao: string | null
  codigo_nbs: string | null
  municipio_prestacao: string | null
  iss_retido: boolean
  aliquota_iss: number | null
  tp_ret_piscofins: number | null
  aliquota_pis: number | null
  aliquota_cofins: number | null
  valor_pis: number | null
  valor_cofins: number | null
  valor_ret_csll: number | null
  valor_irrf: number | null
  valor_inss: number | null
}

/**
 * As últimas 5 notas emitidas para o cliente, do Sistema Nacional (também as feitas
 * fora do sistema). completo=false: a primeira leitura do histórico ainda não acabou.
 */
export function useUltimasNotasDoCliente() {
  return useMutation({
    mutationFn: (clienteId: string) =>
      chamarNfse<{ notas: NotaDoAdn[]; completo: boolean }>({ acao: 'ultimasNotas', clienteId }),
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
  /** null quando foi "Só emitir": o e-mail sai depois, pelo botão Enviar. */
  envio: { enviada: true; para: string[] } | { enviada: false; motivo: string } | null
}

/**
 * Emite o rascunho na Sefin Nacional: a nota vira emitida, com PDF. Com `enviar` (o
 * padrão), já vai ao cliente; sem, espera o financeiro anexar o boleto e clicar em Enviar.
 */
export function useEmitirNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: (p: string | { notaId: string; enviar: boolean }) =>
      chamarNfse<ResultadoEmissao>(
        typeof p === 'string' ? { acao: 'emitir', notaId: p } : { acao: 'emitir', ...p },
      ),
    onSettled: atualizar,
  })
}

export type MotivoCancelamento = '1' | '2' | '9'

/** Cancela a NFS-e no Sistema Nacional; a nota fica como cancelada no sistema. */
export function useCancelarNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: (p: { notaId: string; motivo: MotivoCancelamento; justificativa: string }) =>
      chamarNfse<{ cancelada: true; numero: string | null }>({ acao: 'cancelar', ...p }),
    onSettled: atualizar,
  })
}

/**
 * Rascunho com os dados de uma nota (e a conta a receber e o boleto dela), para acertar o
 * que estava errado. Se já existe um rascunho ou nota que a corrige, devolve esse.
 * Com substituição, a emissão do rascunho substitui a nota no Sistema Nacional.
 */
async function abrirCopiaDaNota(
  n: NotaFiscalCompleta,
  substituicao: { motivo: MotivoSubstituicao; justificativa: string } | null,
): Promise<string> {
  const { data: existente } = await supabase
    .from('notas_fiscais')
    .select('id, status')
    .eq('substitui_nota_id', n.id)
    .neq('status', 'cancelada')
    .limit(1)
  const atual = existente?.[0]
  if (atual) {
    if (substituicao && atual.status === 'rascunho') {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({
          motivo_substituicao: substituicao.motivo,
          justificativa_substituicao: substituicao.justificativa,
        })
        .eq('id', atual.id)
      if (error) throw error
    }
    return atual.id
  }
  const { data, error } = await supabase
    .from('notas_fiscais')
    .insert({
      tipo: n.tipo,
      status: 'rascunho',
      cliente_id: n.cliente_id,
      contrato_id: n.contrato_id,
      lancamento_id: n.lancamento_id,
      data_emissao: hojeISO(),
      competencia: n.competencia,
      vencimento: n.vencimento,
      forma_pagamento: n.forma_pagamento,
      valor_servico: n.valor_servico,
      descricao: n.descricao,
      codigo_tributacao: n.codigo_tributacao,
      codigo_nbs: n.codigo_nbs,
      iss_retido: n.iss_retido,
      aliquota_iss: n.aliquota_iss,
      pis_cofins_retidos: n.pis_cofins_retidos,
      aliquota_pis: n.aliquota_pis,
      aliquota_cofins: n.aliquota_cofins,
      valor_pis: n.valor_pis,
      valor_cofins: n.valor_cofins,
      valor_csll: n.valor_csll,
      aliquota_irrf: n.aliquota_irrf,
      aliquota_csll: n.aliquota_csll,
      aliquota_inss: n.aliquota_inss,
      valor_irrf: n.valor_irrf,
      valor_inss: n.valor_inss,
      municipio_prestacao: n.municipio_prestacao,
      cst_piscofins: n.cst_piscofins,
      trib_issqn: n.trib_issqn,
      tp_imunidade: n.tp_imunidade,
      tp_ret_piscofins: n.tp_ret_piscofins,
      arquivo_boleto_id: n.arquivo_boleto_id,
      observacoes: [
        n.observacoes,
        `Substitui a NF ${n.numero ?? ''}${substituicao ? '' : ' (cancelada)'}.`,
      ]
        .filter(Boolean)
        .join(' '),
      substitui_nota_id: n.id,
      motivo_substituicao: substituicao?.motivo ?? null,
      justificativa_substituicao: substituicao?.justificativa ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** "Corrigir e emitir de novo": rascunho com os dados da nota cancelada. */
export function useCorrigirNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: (n: NotaFiscalCompleta) => abrirCopiaDaNota(n, null),
    onSuccess: atualizar,
  })
}

/** cMotivo da substituição no Sistema Nacional. */
export type MotivoSubstituicao = '01' | '02' | '03' | '04' | '05' | '99'

/**
 * "Substituir NFS-e": rascunho com os dados da nota emitida; ao emitir, a nova substitui a
 * antiga no Sistema Nacional (que fica substituída lá) e a antiga fica cancelada aqui.
 */
export function useSubstituirNota() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: (p: {
      nota: NotaFiscalCompleta
      motivo: MotivoSubstituicao
      justificativa: string
    }) =>
      abrirCopiaDaNota(p.nota, {
        motivo: p.motivo,
        justificativa: p.justificativa.replace(/\s+/g, ' ').trim(),
      }),
    onSuccess: atualizar,
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

// -----------------------------------------------------------------------------
// Boleto pelo sistema (Edge Function "boleto", no Sicredi ou no Asaas)
// -----------------------------------------------------------------------------

export type BancoBoleto = 'sicredi' | 'asaas'

export const NOME_BANCO: Record<BancoBoleto, string> = { sicredi: 'Sicredi', asaas: 'Asaas' }

/** Os bancos desta unidade, na ordem dos botões (SC: só Asaas; RS: Asaas e Sicredi). */
export const BANCOS_DA_UNIDADE: readonly BancoBoleto[] = UNIDADE.bancosBoleto

/** desligado | sandbox (testes do banco, nada vale) | producao */
export type AmbienteBoleto = 'desligado' | 'sandbox' | 'producao'

export type ConfigBoleto = {
  ambiente: Record<BancoBoleto, AmbienteBoleto>
  /** Banco quando a nota não escolheu: nao, sicredi, asaas ou valor (até o limite, Asaas). */
  regra: 'nao' | BancoBoleto | 'valor'
  limiteAsaas: number | null
}

export function useConfigBoleto() {
  return useQuery({
    queryKey: ['configuracoes', 'boleto'],
    queryFn: async (): Promise<ConfigBoleto> => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'boleto_ambiente',
          'boleto_asaas_ambiente',
          'boleto_ao_emitir',
          'boleto_limite_asaas',
        ])
      if (error) throw error
      const c = Object.fromEntries(data.map((l) => [l.chave, (l.valor ?? '').trim()]))
      const limite = Number(c.boleto_limite_asaas)
      return {
        ambiente: {
          sicredi: (c.boleto_ambiente || 'desligado') as AmbienteBoleto,
          asaas: (c.boleto_asaas_ambiente || 'desligado') as AmbienteBoleto,
        },
        regra: (c.boleto_ao_emitir || 'nao') as ConfigBoleto['regra'],
        limiteAsaas: c.boleto_limite_asaas && Number.isFinite(limite) ? limite : null,
      }
    },
  })
}

/** Banco pela regra da configuração (o mesmo cálculo da função "boleto"). */
export function bancoPelaRegra(cfg: ConfigBoleto, valorBoleto: number): BancoBoleto | null {
  if (cfg.regra === 'sicredi' || cfg.regra === 'asaas') return cfg.regra
  if (cfg.regra === 'valor' && cfg.limiteAsaas != null)
    return valorBoleto <= cfg.limiteAsaas ? 'asaas' : 'sicredi'
  return null
}

async function chamarBoleto<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('boleto', { body: corpo })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalhe = (await error.context.json().catch(() => null)) as { erro?: string } | null
      throw new Error(detalhe?.erro ?? 'O pedido ao banco falhou.')
    }
    throw error
  }
  return data as T
}

export type BoletoGerado = {
  banco: BancoBoleto
  cobrancaId: string
  linhaDigitavel: string
  valor: number
  vencimento: string
}

/** Registra o boleto da nota no banco; o PDF fica ligado à nota e vai no e-mail. */
export function useGerarBoleto() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: ({ notaId, banco }: { notaId: string; banco: BancoBoleto }) =>
      chamarBoleto<BoletoGerado>({ acao: 'gerar', notaId, banco }),
    onSettled: atualizar,
  })
}

/** No rascunho: por qual banco sai o boleto na emissão (null = pela regra). */
export function useEscolherBancoBoleto() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async ({ notaId, banco }: { notaId: string; banco: BancoBoleto | null }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ boleto_banco: banco })
        .eq('id', notaId)
        .is('boleto_cobranca_id', null)
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/** No rascunho: se a emissão já gera o boleto no banco (desmarcado = nota sai sem). */
export function useBoletoNaEmissao() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: async ({ notaId, gerar }: { notaId: string; gerar: boolean }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update({ boleto_na_emissao: gerar })
        .eq('id', notaId)
        .eq('status', 'rascunho')
      if (error) throw error
    },
    onSuccess: atualizar,
  })
}

/**
 * Emissão em lote: grava em cada rascunho por boleto se o boleto sai junto na emissão e
 * por qual banco (banco null = a nota sai sem boleto).
 */
export function usePrepararBoletoDoRascunho() {
  return useMutation({
    mutationFn: async ({ notaId, banco }: { notaId: string; banco: BancoBoleto | null }) => {
      const { error } = await supabase
        .from('notas_fiscais')
        .update(
          banco ? { boleto_banco: banco, boleto_na_emissao: true } : { boleto_na_emissao: false },
        )
        .eq('id', notaId)
        .eq('status', 'rascunho')
        .is('boleto_cobranca_id', null)
      if (error) throw error
    },
  })
}

export type EnsaioBoleto = BoletoGerado & {
  pix: string | null
  pdfBase64: string | null
  erroPdf: string | null
}

/** Registra um boleto de teste no sandbox do banco. A nota não muda. */
export function useEnsaiarBoleto() {
  return useMutation({
    mutationFn: ({ notaId, banco }: { notaId: string; banco: BancoBoleto }) =>
      chamarBoleto<EnsaioBoleto>({ acao: 'ensaiar', notaId, banco }),
  })
}

export type SituacaoBoleto = {
  situacao: string | null
  pago: boolean
  pagoEm: string | null
  valorPago: number | null
}

/** Atualiza a situação do boleto no banco (aguardando, pago, vencido…). */
export function useConsultarBoleto() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: (notaId: string) => chamarBoleto<SituacaoBoleto>({ acao: 'consultar', notaId }),
    onSettled: atualizar,
  })
}

/** Cancela o boleto no banco (deixa de valer) e o tira da nota. */
export function useBaixarBoleto() {
  const atualizar = useAtualizarNotas()
  return useMutation({
    mutationFn: (notaId: string) => chamarBoleto<{ baixado: string }>({ acao: 'baixar', notaId }),
    onSettled: atualizar,
  })
}

export type ResultadoTesteBoleto = {
  resultados: {
    banco: BancoBoleto
    ambiente: AmbienteBoleto
    testado: 'sandbox' | 'producao'
    conexao: string
  }[]
}

/** Confere as credenciais de cada banco ligado (o Sicredi desligado, no sandbox). */
export function useTestarBoleto() {
  return useMutation({
    mutationFn: () => chamarBoleto<ResultadoTesteBoleto>({ acao: 'testar' }),
  })
}
