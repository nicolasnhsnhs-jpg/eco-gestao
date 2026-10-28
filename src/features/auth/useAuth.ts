import { useContext } from 'react'

import { AuthContext, type Auth, type Perfil } from './contexto'

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth precisa estar dentro do <AuthProvider>.')
  return auth
}

/** Perfil do usuário logado. Só use em telas protegidas pelo <RotaProtegida>. */
export function usePerfil(): Perfil {
  const { perfil } = useAuth()
  if (!perfil) throw new Error('usePerfil usado fora de uma rota protegida.')
  return perfil
}
