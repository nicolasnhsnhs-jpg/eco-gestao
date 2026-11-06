import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import type { ProdutoCertificado } from './modelos'

/*
 * Certificados de serviço e catálogo de produtos.
 * Quem vê e emite: Administrador e ADM (o banco garante).
 * O número (CERT-AAAA-0001) e a cópia dos dados do cliente são feitos pelo banco.
 */

export type Certificado = Tables<'certificados'>
export type ProdutoCatalogo = Tables<'produtos_certificado'>

const RELACOES = `
  cliente:clientes(id, nome, nome_fantasia),
  endereco:enderecos(id, apelido, logradouro, numero, cidade, uf),
  tipo:tipos_servico(id, nome, formulario_os, periodicidade_meses_padrao),
  os:ordens_servico(id, numero)
`

export function useCertificados() {
  return useQuery({
    queryKey: ['certificados', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certificados')
        .select(`*, ${RELACOES}`)
        .order('data_execucao', { ascending: false })
        .order('numero', { ascending: false })
        .limit(500)
      if (error) throw error
      return data
    },
  })
}

export type CertificadoResumo = NonNullable<ReturnType<typeof useCertificados>['data']>[number]

export function useCertificado(id: string | undefined) {
  return useQuery({
    queryKey: ['certificados', 'um', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certificados')
        .select(`*, ${RELACOES}`)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type DadosCertificado = Omit<TablesInsert<'certificados'>, 'numero'>

export function useSalvarCertificado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: DadosCertificado }) => {
      if (id) {
        // O cliente não muda depois de emitido (o banco também garante).
        const { cliente_id: _cliente, ...resto } = dados
        const { error } = await supabase
          .from('certificados')
          .update(resto satisfies TablesUpdate<'certificados'>)
          .eq('id', id)
        if (error) throw error
        return id
      }
      // O número é preenchido pelo banco; o valor aqui é só para o tipo.
      const { data, error } = await supabase
        .from('certificados')
        .insert({ ...dados, numero: '' })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['certificados'] })
      void queryClient.invalidateQueries({ queryKey: ['servicos'] })
    },
  })
}

export function useCancelarCertificado(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase
        .from('certificados')
        .update({ cancelado_em: new Date().toISOString(), motivo_cancelamento: motivo })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['certificados'] }),
  })
}

// -----------------------------------------------------------------------------
// Catálogo de produtos
// -----------------------------------------------------------------------------

export function useProdutosCatalogo() {
  return useQuery({
    queryKey: ['certificados', 'produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_certificado')
        .select('*')
        .order('ativo', { ascending: false })
        .order('principio_ativo')
      if (error) throw error
      return data
    },
  })
}

export function useSalvarProdutoCatalogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id?: string
      dados: TablesInsert<'produtos_certificado'>
    }) => {
      const { error } = id
        ? await supabase.from('produtos_certificado').update(dados).eq('id', id)
        : await supabase.from('produtos_certificado').insert(dados)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['certificados', 'produtos'] }),
  })
}

// -----------------------------------------------------------------------------
// Assinaturas escaneadas (bucket privado "assinaturas"; só o Admin troca)
// -----------------------------------------------------------------------------

export const ARQUIVO_ASSINATURA = {
  responsavel: 'responsavel.png',
  succao: 'responsavel-succao.png',
} as const
export type QualAssinatura = keyof typeof ARQUIVO_ASSINATURA

/** Bytes da assinatura, ou null se ainda não foi enviada. */
export async function baixarAssinatura(qual: QualAssinatura): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage
    .from('assinaturas')
    .download(ARQUIVO_ASSINATURA[qual])
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

export function useAssinatura(qual: QualAssinatura) {
  return useQuery({
    queryKey: ['certificados', 'assinatura', qual],
    queryFn: async () => {
      const bytes = await baixarAssinatura(qual)
      return bytes
        ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }))
        : null
    },
  })
}

export function useEnviarAssinatura() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ qual, png }: { qual: QualAssinatura; png: Blob }) => {
      const { error } = await supabase.storage
        .from('assinaturas')
        .upload(ARQUIVO_ASSINATURA[qual], png, {
          upsert: true,
          contentType: 'image/png',
          // Troca vale logo (sem guardar a antiga no cache do navegador).
          cacheControl: '0',
        })
      if (error) throw error
    },
    onSuccess: (_, { qual }) =>
      void queryClient.invalidateQueries({ queryKey: ['certificados', 'assinatura', qual] }),
  })
}

// -----------------------------------------------------------------------------
// De onde vem o certificado (para já começar preenchido)
// -----------------------------------------------------------------------------

/** Periodicidade combinada com o cliente para aquele serviço e unidade (vencimento). */
async function periodicidadeDoCliente(
  clienteId: string,
  enderecoId: string | null,
  tipoId: string,
): Promise<number | null> {
  let consulta = supabase
    .from('vencimentos_servico')
    .select('periodicidade_meses')
    .eq('cliente_id', clienteId)
    .eq('tipo_servico_id', tipoId)
    .limit(1)
  consulta = enderecoId ? consulta.eq('endereco_id', enderecoId) : consulta.is('endereco_id', null)
  const { data, error } = await consulta
  if (error) throw error
  return data[0]?.periodicidade_meses ?? null
}

export type Origem = {
  osId: string | null
  osNumero: string | null
  servicoId: string | null
  clienteId: string
  clienteNome: string
  enderecoId: string | null
  tipoId: string
  dataExecucao: string
  /** A OS veio de uma "O.S de contrato" (então o certificado é de contrato). */
  deContrato: boolean
  periodicidade: number | null
  areas: string
  /** Produtos do catálogo que o técnico marcou na OS (com o lote atual). */
  produtos: ProdutoCertificado[]
}

/** Produtos da OS que vieram do catálogo, um por produto, com a quantidade somada. */
async function produtosDaOs(osId: string): Promise<ProdutoCertificado[]> {
  const { data, error } = await supabase
    .from('os_produtos')
    .select(
      'unidades, gramas, produto:produtos_certificado(id, nome_comercial, principio_ativo, registro, lote, fabricacao, validade, quantidade_padrao)',
    )
    .eq('os_id', osId)
    .not('produto_id', 'is', null)
    .order('criado_em')
  if (error) throw error
  const porProduto = new Map<string, { item: ProdutoCatalogoResumo; un: number; g: number }>()
  for (const linha of data) {
    if (!linha.produto) continue
    const atual = porProduto.get(linha.produto.id) ?? { item: linha.produto, un: 0, g: 0 }
    atual.un += linha.unidades ?? 0
    atual.g += linha.gramas ?? 0
    porProduto.set(linha.produto.id, atual)
  }
  const num = (n: number) => n.toLocaleString('pt-BR')
  return [...porProduto.values()].map(({ item, un, g }) => ({
    nome_comercial: item.nome_comercial ?? '',
    principio_ativo: item.principio_ativo,
    registro: item.registro ?? '',
    quantidade: g ? `${num(g)}g` : un ? `${num(un)} un` : (item.quantidade_padrao ?? ''),
    lote: item.lote ?? '',
    fabricacao: item.fabricacao ?? '',
    validade: item.validade ?? '',
  }))
}

type ProdutoCatalogoResumo = Pick<
  ProdutoCatalogo,
  | 'id'
  | 'nome_comercial'
  | 'principio_ativo'
  | 'registro'
  | 'lote'
  | 'fabricacao'
  | 'validade'
  | 'quantidade_padrao'
>

export function useOrigemOs(osId: string | null) {
  return useQuery({
    queryKey: ['certificados', 'origem-os', osId],
    enabled: !!osId,
    queryFn: async (): Promise<Origem | null> => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(
          'id, numero, cliente_id, endereco_id, tipo_servico_id, data_agendada, servico_id, modelo_id, descricao, cliente:clientes(nome, nome_fantasia), execucao:os_execucao(data)',
        )
        .eq('id', osId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const execucao = Array.isArray(data.execucao) ? data.execucao[0] : data.execucao
      return {
        osId: data.id,
        osNumero: data.numero,
        servicoId: data.servico_id,
        clienteId: data.cliente_id,
        clienteNome: data.cliente?.nome ?? '',
        enderecoId: data.endereco_id,
        tipoId: data.tipo_servico_id,
        dataExecucao: execucao?.data ?? data.data_agendada,
        deContrato: !!data.modelo_id,
        periodicidade: await periodicidadeDoCliente(
          data.cliente_id,
          data.endereco_id,
          data.tipo_servico_id,
        ),
        areas: data.descricao ?? '',
        produtos: await produtosDaOs(data.id),
      }
    },
  })
}

export function useOrigemServico(servicoId: string | null) {
  return useQuery({
    queryKey: ['certificados', 'origem-servico', servicoId],
    enabled: !!servicoId,
    queryFn: async (): Promise<Origem | null> => {
      const { data, error } = await supabase
        .from('servicos')
        .select(
          'id, cliente_id, endereco_id, tipo_servico_id, data_execucao, periodicidade_meses, cliente:clientes(nome, nome_fantasia), os:ordens_servico(modelo_id)',
        )
        .eq('id', servicoId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        osId: null,
        osNumero: null,
        servicoId: data.id,
        clienteId: data.cliente_id,
        clienteNome: data.cliente?.nome ?? '',
        enderecoId: data.endereco_id,
        tipoId: data.tipo_servico_id,
        dataExecucao: data.data_execucao,
        // Serviço que veio de uma "O.S de contrato" → certificado de contrato.
        deContrato: (data.os ?? []).some((o) => !!o.modelo_id),
        periodicidade:
          data.periodicidade_meses ??
          (await periodicidadeDoCliente(data.cliente_id, data.endereco_id, data.tipo_servico_id)),
        areas: '',
        produtos: [],
      }
    },
  })
}

/** Periodicidade do cliente, para quando o certificado é emitido avulso. */
export function usePeriodicidadeDoCliente(
  clienteId: string,
  enderecoId: string | null,
  tipoId: string,
) {
  return useQuery({
    queryKey: ['certificados', 'periodicidade', clienteId, enderecoId, tipoId],
    enabled: !!clienteId && !!tipoId,
    queryFn: () => periodicidadeDoCliente(clienteId, enderecoId, tipoId),
  })
}
