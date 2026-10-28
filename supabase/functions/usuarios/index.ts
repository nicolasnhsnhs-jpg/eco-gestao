// Edge Function "usuarios": ações que só o servidor pode fazer, porque precisam
// da chave secreta do Supabase (que nunca vai para o navegador):
//   - convidar: cria o usuário e manda o e-mail de convite;
//   - desativar / reativar: bloqueia ou libera o login.
// Só o administrador consegue chamar estas ações.

import { createClient } from 'npm:@supabase/supabase-js@2'

const PAPEIS = ['admin', 'financeiro', 'vendedor', 'recepcao'] as const
type Papel = (typeof PAPEIS)[number]

type Pedido =
  | { acao: 'convidar'; email: string; nome: string; papel: Papel; redirecionarPara: string }
  | { acao: 'desativar' | 'reativar'; usuarioId: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function resposta(status: number, corpo: unknown) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Quem está chamando? Confere o token do usuário logado.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Faça login novamente.' })
  const { data: quem, error: erroToken } = await admin.auth.getUser(token)
  if (erroToken || !quem.user)
    return resposta(401, { erro: 'Sessão expirada. Faça login novamente.' })

  // 2. Ele é um administrador ativo?
  const { data: perfil } = await admin
    .from('perfis')
    .select('papel, ativo')
    .eq('id', quem.user.id)
    .single()
  if (!perfil?.ativo || perfil.papel !== 'admin') {
    return resposta(403, { erro: 'Somente o administrador pode gerenciar usuários.' })
  }

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' })
  }

  // 3. Executa a ação.
  if (pedido.acao === 'convidar') {
    const email = pedido.email?.trim().toLowerCase()
    const nome = pedido.nome?.trim()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return resposta(400, { erro: 'Informe um e-mail válido.' })
    }
    if (!nome || nome.length < 2) return resposta(400, { erro: 'Informe o nome.' })
    if (!PAPEIS.includes(pedido.papel)) return resposta(400, { erro: 'Perfil inválido.' })

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: pedido.redirecionarPara,
    })
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message)
      return resposta(400, {
        erro: jaExiste ? 'Já existe um usuário com este e-mail.' : error.message,
      })
    }

    // O perfil é criado automaticamente pelo banco; aqui só definimos o papel e o nome.
    const { error: erroPerfil } = await admin
      .from('perfis')
      .update({ papel: pedido.papel, nome })
      .eq('id', data.user.id)
    if (erroPerfil) return resposta(500, { erro: erroPerfil.message })

    return resposta(200, { ok: true, usuarioId: data.user.id })
  }

  if (pedido.acao === 'desativar' || pedido.acao === 'reativar') {
    if (pedido.usuarioId === quem.user.id) {
      return resposta(400, { erro: 'Você não pode desativar a si mesmo.' })
    }
    const ativo = pedido.acao === 'reativar'

    const { error: erroLogin } = await admin.auth.admin.updateUserById(pedido.usuarioId, {
      // "Banir" por 100 anos = bloquear o login. "none" libera de novo.
      ban_duration: ativo ? 'none' : '876000h',
    })
    if (erroLogin) return resposta(400, { erro: erroLogin.message })

    const { error: erroPerfil } = await admin
      .from('perfis')
      .update({ ativo })
      .eq('id', pedido.usuarioId)
    if (erroPerfil) return resposta(500, { erro: erroPerfil.message })

    return resposta(200, { ok: true })
  }

  return resposta(400, { erro: 'Ação desconhecida.' })
})
