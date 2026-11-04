// Peças comuns das Edge Functions do financeiro: resposta com CORS, cliente com a
// chave secreta e a conferência de quem chama (Admin ou Financeiro ativo).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function chaveSecreta(): string {
  // Projetos novos usam SUPABASE_SECRET_KEYS (JSON); os antigos, SUPABASE_SERVICE_ROLE_KEY.
  const novas = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (novas) {
    const chaves = JSON.parse(novas) as Record<string, string>
    if (chaves.default) return chaves.default
  }
  const antiga = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!antiga) throw new Error('Chave secreta do Supabase não configurada.')
  return antiga
}

export function clienteAdmin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Devolve o id de quem chama, ou a resposta de erro se não for Admin/Financeiro ativo. */
export async function conferirFinanceiro(
  req: Request,
  admin: SupabaseClient,
): Promise<{ usuarioId: string } | Response> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Faça login novamente.' })
  const { data: quem, error } = await admin.auth.getUser(token)
  if (error || !quem.user) return resposta(401, { erro: 'Sessão expirada. Faça login novamente.' })
  const { data: perfil } = await admin
    .from('perfis')
    .select('papel, ativo')
    .eq('id', quem.user.id)
    .single()
  if (!perfil?.ativo || !['admin', 'financeiro'].includes(perfil.papel)) {
    return resposta(403, { erro: 'Somente o financeiro mexe com notas fiscais.' })
  }
  return { usuarioId: quem.user.id }
}
