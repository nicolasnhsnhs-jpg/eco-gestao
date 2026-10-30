import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import { enfileirar } from './offline/fila'

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

export const consultaPontosOs = (osId: string) =>
  queryOptions({
    queryKey: ['os', osId, 'pontos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('os_pontos').select('*').eq('os_id', osId)
      if (error) throw error
      return ordenarPontos(data)
    },
  })

export function usePontosOs(osId: string) {
  return useQuery(consultaPontosOs(osId))
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
  | 'sujidade'
  | 'foto_antes'
>

/**
 * Grava a mesma alteração em vários pontos de uma vez (ex.: "estes 5 são MC").
 * Funciona sem internet: a tela muda na hora e o envio vai pela fila.
 */
export function useAnotarPontos(osId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ ids, campos }: { ids: string[]; campos: CamposPonto }) => {
      if (ids.length === 0) return
      const alvo = new Set(ids)
      queryClient.setQueryData<PontoOs[]>(['os', osId, 'pontos'], (atual) =>
        atual?.map((p) => (alvo.has(p.id) ? { ...p, ...campos } : p)),
      )
      await enfileirar({ tipo: 'pontos', osId, ids, campos })
    },
  })
}

export const consultaProdutos = (osId: string) =>
  queryOptions({
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

export function useProdutos(osId: string) {
  return useQuery(consultaProdutos(osId))
}

export function useGravarProduto(osId: string) {
  const queryClient = useQueryClient()
  const chave = ['os', osId, 'os_produtos']
  return useMutation({
    networkMode: 'always',
    mutationFn: async (acao: { adicionar: TablesInsert<'os_produtos'> } | { remover: string }) => {
      if ('adicionar' in acao) {
        // O id nasce no celular: dá para remover um item que ainda não foi enviado.
        const linha = { ...acao.adicionar, id: acao.adicionar.id ?? crypto.randomUUID() }
        queryClient.setQueryData<ProdutoOs[]>(chave, (atual) => [
          ...(atual ?? []),
          {
            criado_em: new Date().toISOString(),
            criado_por: null,
            atualizado_em: new Date().toISOString(),
            atualizado_por: null,
            ...linha,
          } as ProdutoOs,
        ])
        await enfileirar({ tipo: 'produto+', osId, linha })
      } else {
        queryClient.setQueryData<ProdutoOs[]>(chave, (atual) =>
          atual?.filter((i) => i.id !== acao.remover),
        )
        await enfileirar({ tipo: 'produto-', osId, id: acao.remover })
      }
    },
  })
}

export const consultaInsetos = (osId: string) =>
  queryOptions({
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

export function useInsetos(osId: string) {
  return useQuery(consultaInsetos(osId))
}

export function useGravarInseto(osId: string) {
  const queryClient = useQueryClient()
  const chave = ['os', osId, 'os_insetos']
  return useMutation({
    networkMode: 'always',
    mutationFn: async (acao: { adicionar: TablesInsert<'os_insetos'> } | { remover: string }) => {
      if ('adicionar' in acao) {
        // O id nasce no celular: dá para remover um item que ainda não foi enviado.
        const linha = { ...acao.adicionar, id: acao.adicionar.id ?? crypto.randomUUID() }
        queryClient.setQueryData<InsetoOs[]>(chave, (atual) => [
          ...(atual ?? []),
          {
            criado_em: new Date().toISOString(),
            criado_por: null,
            atualizado_em: new Date().toISOString(),
            atualizado_por: null,
            ...linha,
          } as InsetoOs,
        ])
        await enfileirar({ tipo: 'inseto+', osId, linha })
      } else {
        queryClient.setQueryData<InsetoOs[]>(chave, (atual) =>
          atual?.filter((i) => i.id !== acao.remover),
        )
        await enfileirar({ tipo: 'inseto-', osId, id: acao.remover })
      }
    },
  })
}
