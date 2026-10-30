import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { definirGuardarNoCelular, estaOnline, limparGuardado, sessaoGuardada } from '@/lib/offline'
import { supabase } from '@/lib/supabase'

import { AuthContext, type Auth } from './contexto'

/** Guarda quem está logado e o perfil dele, e avisa o resto do sistema quando muda. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState<Session | null>(null)
  const [sessaoCarregada, setSessaoCarregada] = useState(false)

  useEffect(() => {
    function carregar() {
      supabase.auth.getSession().then(({ data }) => {
        // Sem internet o Supabase não renova o token e devolve "sem sessão": usa a
        // sessão guardada no celular. O banco confere tudo de novo quando o sinal volta.
        setSessao(data.session ?? (estaOnline() ? null : sessaoGuardada()))
        setSessaoCarregada(true)
      })
    }
    carregar()
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (!novaSessao && evento !== 'SIGNED_OUT' && !estaOnline()) return
      setSessao(novaSessao)
      setSessaoCarregada(true)
    })
    window.addEventListener('online', carregar)
    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('online', carregar)
    }
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
    // Limpa da memória e do celular tudo o que foi carregado por este usuário.
    definirGuardarNoCelular(false)
    queryClient.clear()
    await limparGuardado()
  }, [queryClient])

  // Só o celular do operador guarda dados para trabalhar sem internet.
  definirGuardarNoCelular(perfil.data?.papel === 'operador')

  const valor: Auth = {
    sessao,
    perfil: perfil.data ?? null,
    carregando: !sessaoCarregada || (!!usuarioId && perfil.isPending),
    sair,
  }

  return <AuthContext value={valor}>{children}</AuthContext>
}
