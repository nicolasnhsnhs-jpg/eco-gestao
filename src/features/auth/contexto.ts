import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

import type { Tables } from '@/lib/database.types'

export type Perfil = Tables<'perfis'>

export type Auth = {
  sessao: Session | null
  perfil: Perfil | null
  /** true enquanto ainda não sabemos se há alguém logado. */
  carregando: boolean
  sair: () => Promise<void>
}

export const AuthContext = createContext<Auth | null>(null)
