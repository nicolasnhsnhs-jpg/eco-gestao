import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import type { EscopoPragas } from './tipos/pragas'

/*
 * Dados do controle de pragas. Pontos do modelo: só o escritório. Pontos, produtos
 * e insetos da OS: quem vê a OS vê; o operador anota enquanto ela está aberta.
 */

export type PontoControle = Tables<'pontos_controle'>
export type PontoOs = Tables<'os_pontos'>
export type ProdutoOs = Tables<'os_produtos'>
export type InsetoOs = Tables<'os_insetos'>

const ordenarPontos = <T extends { tipo: string; numero: number }>(lista: T[]) =>
  [...lista].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero - b.numero)

// -----------------------------------------------------------------------------
// Escritório: pontos do modelo e escopo
// -----------------------------------------------------------------------------

export function usePontosModelo(modeloId: string | null) {
  return useQuery({
    queryKey: ['os', 'pontos-modelo', modeloId],
    enabled: !!modeloId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pontos_controle')
        .select('*')
        .eq('modelo_id', modeloId!)
        .order('numero')
      if (error) throw error
      return ordenarPontos(data)
    },
  })
}

function useAtualizarTudo() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['os'] })
}

/** Grava pontos do modelo e, se a OS ainda não começou, atualiza a cópia dela. */
export function useSalvarPontos(osId: string, podeAtualizarOs: boolean) {
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (acao: {
      novos?: TablesInsert<'pontos_controle'>[]
      alterar?: { id: string; dados: TablesUpdate<'pontos_controle'> }
    }) => {
      if (acao.novos?.length) {
        const { error } = await supabase.from('pontos_controle').insert(acao.novos)
        if (error) {
          throw /um_numero_por_tipo/.test(error.message)
            ? new Error('Algum desses números já existe neste local. Use outros números.')
            : error
        }
      }
      if (acao.alterar) {
        const { error } = await supabase
          .from('pontos_controle')
          .update(acao.alterar.dados)
          .eq('id', acao.alterar.id)
        if (error) throw error
      }
      if (podeAtualizarOs) {
        const { error } = await supabase.rpc('atualizar_pontos_os', { os: osId })
        if (error) throw error
      }
    },
    onSuccess: atualizar,
  })
}

/** Grava o escopo de pragas na OS e no modelo (vale para as próximas visitas). */
export function useSalvarEscopoPragas(osId: string, modeloId: string | null) {
  const atualizar = useAtualizarTudo()
  return useMutation({
    mutationFn: async (escopo: EscopoPragas) => {
      const valor = escopo as Json
      const { error } = await supabase
        .from('ordens_servico')
        .update({ escopo: valor })
        .eq('id', osId)
      if (error) throw error
      if (modeloId) {
        const r = await supabase.from('os_modelos').update({ escopo: valor }).eq('id', modeloId)
        if (r.error) throw r.error
      }
    },
    onSuccess: atualizar,
  })
}

// -----------------------------------------------------------------------------
// OS: pontos, produtos e insetos
// -----------------------------------------------------------------------------

export function usePontosOs(osId: string) {
  return useQuery({
    queryKey: ['os', osId, 'pontos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('os_pontos').select('*').eq('os_id', osId)
      if (error) throw error
      return ordenarPontos(data)
    },
  })
}

type CamposPonto = Pick<
  TablesUpdate<'os_pontos'>,
  | 'situacao'
  | 'refil'
  | 'situacao_armadilha'
  | 'lampadas_trocadas'
  | 'higiene'
  | 'capturas'
  | 'observacao'
>

/** Grava a mesma alteração em vários pontos de uma vez (ex.: "estes 5 são MC"). */
export function useAnotarPontos(osId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, campos }: { ids: string[]; campos: CamposPonto }) => {
      if (ids.length === 0) return
      const { error } = await supabase.from('os_pontos').update(campos).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os', osId, 'pontos'] }),
  })
}

export function useProdutos(osId: string) {
  return useQuery({
    queryKey: ['os', osId, 'os_produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_produtos')
        .select('*')
        .eq('os_id', osId)
        .order('criado_em')
      if (error) throw error
      return data
    },
  })
}

export function useGravarProduto(osId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (acao: { adicionar: TablesInsert<'os_produtos'> } | { remover: string }) => {
      const { error } =
        'adicionar' in acao
          ? await supabase.from('os_produtos').insert(acao.adicionar)
          : await supabase.from('os_produtos').delete().eq('id', acao.remover)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os', osId, 'os_produtos'] }),
  })
}

export function useInsetos(osId: string) {
  return useQuery({
    queryKey: ['os', osId, 'os_insetos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_insetos')
        .select('*')
        .eq('os_id', osId)
        .order('criado_em')
      if (error) throw error
      return data
    },
  })
}

export function useGravarInseto(osId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (acao: { adicionar: TablesInsert<'os_insetos'> } | { remover: string }) => {
      const { error } =
        'adicionar' in acao
          ? await supabase.from('os_insetos').insert(acao.adicionar)
          : await supabase.from('os_insetos').delete().eq('id', acao.remover)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['os', osId, 'os_insetos'] }),
  })
}
