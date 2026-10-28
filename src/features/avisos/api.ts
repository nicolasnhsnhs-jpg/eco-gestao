import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type AvisoSistema = Tables<'avisos'>

/** Avisos do usuário logado (o banco só devolve os que são dele ou do perfil dele). */
export function useAvisos(mostrarResolvidos: boolean) {
  return useQuery({
    queryKey: ['avisos', 'lista', mostrarResolvidos],
    queryFn: async () => {
      let consulta = supabase
        .from('avisos')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(200)
      if (!mostrarResolvidos) consulta = consulta.is('resolvido_em', null)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/** Quantidade de avisos ainda não lidos, para o número no menu. Atualiza a cada 5 minutos. */
export function useAvisosNaoLidos() {
  return useQuery({
    queryKey: ['avisos', 'nao-lidos'],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('avisos')
        .select('id', { count: 'exact', head: true })
        .is('lido_em', null)
        .is('resolvido_em', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

/**
 * Pede ao banco para gerar agora os avisos do dia (cobranças atrasadas, recebimentos de hoje),
 * sem esperar a tarefa da madrugada. Para quem não é do financeiro, o banco não faz nada.
 */
export function useGerarAvisosAoAbrir() {
  const queryClient = useQueryClient()
  useEffect(() => {
    void supabase.rpc('atualizar_avisos').then(({ data }) => {
      if (data) void queryClient.invalidateQueries({ queryKey: ['avisos'] })
    })
  }, [queryClient])
}

export function useMarcarAviso() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, campo }: { ids: string[]; campo: 'lido_em' | 'resolvido_em' }) => {
      const agora = new Date().toISOString()
      const dados =
        campo === 'resolvido_em' ? { lido_em: agora, resolvido_em: agora } : { lido_em: agora }
      const { error } = await supabase.from('avisos').update(dados).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['avisos'] }),
  })
}
