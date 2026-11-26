import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import type { EtapaApr, ModeloApr } from './aprModelos'

/*
 * APR — Análise Preliminar de Risco (migration 20270205120000_apr.sql).
 * O escritório emite; cada técnico escolhido assina no celular (Pendências).
 */

const CAMPOS = `*, participantes:apr_participantes(perfil_id, nome, funcao, ordem, assinatura_caminho, assinada_em)`

export type FiltroAprs = { status?: 'pendente' | 'concluida' | 'cancelada' }

export function useAprs(filtro: FiltroAprs = {}) {
  return useQuery({
    queryKey: ['aprs', 'lista', filtro],
    queryFn: async () => {
      let consulta = supabase
        .from('aprs')
        .select(CAMPOS)
        .order('data', { ascending: false })
        .order('numero', { ascending: false })
        .limit(200)
      if (filtro.status) consulta = consulta.eq('status', filtro.status)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

export function useApr(id: string | undefined) {
  return useQuery({
    queryKey: ['aprs', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('aprs').select(CAMPOS).eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type Apr = NonNullable<ReturnType<typeof useApr>['data']>
export type ParticipanteApr = Apr['participantes'][number]

/** Ordem de quem assina (a escolhida na emissão). */
export const participantesEmOrdem = (a: Pick<Apr, 'participantes'>) =>
  [...a.participantes].sort((x, y) => x.ordem - y.ordem)

/** APRs em que o técnico ainda precisa assinar (Pendências do celular). */
export function useMinhasAprsPendentes(perfilId: string | undefined) {
  return useQuery({
    queryKey: ['aprs', 'pendentes', perfilId],
    enabled: !!perfilId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apr_participantes')
        .select('apr:aprs!inner(id, numero, ano, titulo, cliente_nome, local, data, status)')
        .eq('perfil_id', perfilId!)
        .is('assinada_em', null)
        .neq('apr.status', 'cancelada')
      if (error) throw error
      return data
        .flatMap((l) => (l.apr ? [l.apr] : []))
        .sort((a, b) => a.data.localeCompare(b.data))
    },
  })
}

/** Usuários que podem assinar: operadores (técnicos) e o restante da equipe ativa. */
export function useEquipeApr() {
  return useQuery({
    queryKey: ['equipe', 'apr'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome, papel')
        .eq('ativo', true)
        .in('papel', ['operador', 'admin', 'administrativo'])
        .order('nome')
      if (error) throw error
      return data
    },
  })
}

export type DadosApr = {
  modelo: ModeloApr
  titulo: string
  descricaoAtividade: string
  clienteId: string
  enderecoId: string | null
  clienteNome: string
  clienteDocumento: string | null
  local: string
  enderecoTexto: string
  data: string
  etapas: EtapaApr[]
  epis: string[]
  observacoes: string
  tecnicos: string[]
}

export function useEmitirApr() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (d: DadosApr) => {
      const { data, error } = await supabase
        .from('aprs')
        .insert({
          // Número e ano: o banco põe (sequência do ano).
          numero: 0,
          ano: 0,
          modelo: d.modelo,
          titulo: d.titulo.trim(),
          descricao_atividade: d.descricaoAtividade.trim() || null,
          cliente_id: d.clienteId,
          endereco_id: d.enderecoId,
          cliente_nome: d.clienteNome,
          cliente_documento: d.clienteDocumento,
          local: d.local.trim() || null,
          endereco_texto: d.enderecoTexto.trim() || null,
          data: d.data,
          etapas: d.etapas as unknown as Json,
          epis: d.epis,
          observacoes: d.observacoes.trim() || null,
        })
        .select('id')
        .single()
      if (error) throw error
      const r = await supabase.rpc('apr_definir_tecnicos', { apr: data.id, tecnicos: d.tecnicos })
      if (r.error) {
        // Sem quem assine a APR não serve: desfaz.
        await supabase.rpc('cancelar_apr', { apr: data.id, motivo: 'Erro ao escolher os técnicos' })
        throw r.error
      }
      return data.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aprs'] }),
  })
}

export function useAtualizarApr(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      d: Omit<DadosApr, 'modelo' | 'clienteId' | 'enderecoId' | 'clienteNome' | 'clienteDocumento'>,
    ) => {
      const { error } = await supabase
        .from('aprs')
        .update({
          titulo: d.titulo.trim(),
          descricao_atividade: d.descricaoAtividade.trim() || null,
          local: d.local.trim() || null,
          endereco_texto: d.enderecoTexto.trim() || null,
          data: d.data,
          etapas: d.etapas as unknown as Json,
          epis: d.epis,
          observacoes: d.observacoes.trim() || null,
        })
        .eq('id', id)
      if (error) throw error
      const r = await supabase.rpc('apr_definir_tecnicos', { apr: id, tecnicos: d.tecnicos })
      if (r.error) throw r.error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aprs'] }),
  })
}

export function useCancelarApr(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.rpc('cancelar_apr', { apr: id, motivo })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aprs'] }),
  })
}

/** O técnico assina: a imagem vai para a pasta da APR e o banco registra. */
export function useAssinarApr(apr: { id: string; cliente_id: string }, perfilId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (imagem: Blob) => {
      const caminho = `clientes/${apr.cliente_id}/apr/${apr.id}/${perfilId}-${Date.now()}.png`
      const envio = await supabase.storage
        .from('arquivos')
        .upload(caminho, imagem, { contentType: 'image/png' })
      if (envio.error) throw envio.error
      const { error } = await supabase.rpc('assinar_apr', { apr: apr.id, caminho })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aprs'] }),
  })
}

/** As assinaturas (PNG) para o PDF: caminho → bytes. */
export async function baixarAssinaturasApr(
  caminhos: string[],
): Promise<Record<string, Uint8Array>> {
  const saida: Record<string, Uint8Array> = {}
  await Promise.all(
    caminhos.map(async (c) => {
      const { data, error } = await supabase.storage.from('arquivos').download(c)
      if (!error && data) saida[c] = new Uint8Array(await data.arrayBuffer())
    }),
  )
  return saida
}
