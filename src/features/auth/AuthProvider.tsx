import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { supabase } from '@/lib/supabase'

import { AuthContext, type Auth } from './contexto'

/** Guarda quem está logado e o perfil dele, e avisa o resto do sistema quando muda. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState<Session | null>(null)
  const [sessaoCarregada, setSessaoCarregada] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setSessaoCarregada(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
      setSessaoCarregada(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const usuarioId = sessao?.user.id
  const perfil = useQuery({
    queryKey: ['perfil', usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', usuarioId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    // Limpa da memória tudo o que foi carregado por este usuário.
    queryClient.clear()
  }, [queryClient])

  const valor: Auth = {
    sessao,
    perfil: perfil.data ?? null,
    carregando: !sessaoCarregada || (!!usuarioId && perfil.isPending),
    sair,
  }

  return <AuthContext value={valor}>{children}</AuthContext>
}
