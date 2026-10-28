import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !chave) {
  throw new Error(
    'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local (veja o .env.example).',
  )
}

/**
 * Conexão com o Supabase usada em todo o sistema.
 * A chave publicável pode ficar no navegador: quem protege os dados são as regras de RLS do banco.
 */
export const supabase = createClient<Database>(url, chave)
