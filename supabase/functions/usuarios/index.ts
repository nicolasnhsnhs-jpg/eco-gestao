// Edge Function "usuarios": ações que só o servidor pode fazer, porque precisam
// da chave secreta do Supabase (que nunca vai para o navegador):
//   - convidar: cria o usuário e manda o e-mail de convite;
//   - criarOperador: cria o login de um operador com senha definida pelo admin
//     (operadores de campo nem sempre têm e-mail);
//   - definirSenha: troca a senha de um operador que esqueceu a dele;
//   - desativar / reativar: bloqueia ou libera o login;
//   - alterarEmail / reenviarAcesso: troca o e-mail e manda o link para criar a senha;
//   - aprovar / recusar: decide quem se cadastrou por um link de cadastro.
// Só o administrador consegue chamar estas ações. As duas exceções, sem login, são
// verLink e solicitarAcesso: quem recebeu um link de cadastro cria a própria conta,
// que nasce bloqueada até o administrador aprovar.

import { createClient } from 'npm:@supabase/supabase-js@2'

// "administrativo" é o perfil ADM (não confundir com "admin", o Administrador).
const PAPEIS = [
  'admin',
  'financeiro',
  'administrativo',
  'vendedor',
  'recepcao',
  'operador',
] as const

// Endereço só para identificar o login; ninguém recebe e-mail nele. Cada unidade tem o
// seu (segredo DOMINIO_OPERADOR do projeto; sem ele, vale o de SC). Igual a src/lib/unidade.ts.
const DOMINIO_OPERADOR = Deno.env.get('DOMINIO_OPERADOR') ?? 'op.ecoambientalsc.com.br'
const SENHA_MINIMA = 8
type Papel = (typeof PAPEIS)[number]

type Pedido =
  | { acao: 'convidar'; email: string; nome: string; papel: Papel; redirecionarPara: string }
  | { acao: 'criarOperador'; nome: string; login: string; senha: string }
  | { acao: 'definirSenha'; usuarioId: string; senha: string }
  | { acao: 'desativar' | 'reativar'; usuarioId: string }
  | { acao: 'alterarEmail'; usuarioId: string; email: string }
  | { acao: 'reenviarAcesso'; usuarioId: string; redirecionarPara: string }
  | { acao: 'aprovar'; usuarioId: string; papel: Papel }
  | { acao: 'recusar'; usuarioId: string }

type PedidoPublico =
  | { acao: 'verLink'; codigo: string }
  | { acao: 'solicitarAcesso'; codigo: string; nome: string; email: string; senha: string }

const BLOQUEADO = '876000h' // "banir" por 100 anos = bloquear o login
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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

  let pedido: Pedido | PedidoPublico
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' })
  }

  // 0. Ações sem login: quem recebeu o link de cadastro.
  if (pedido.acao === 'verLink' || pedido.acao === 'solicitarAcesso') {
    return await atenderLinkDeCadastro(admin, pedido)
  }

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

  // 3. Executa a ação.
  if (pedido.acao === 'convidar') {
    const email = pedido.email?.trim().toLowerCase()
    const nome = pedido.nome?.trim()
    if (!email || !EMAIL_VALIDO.test(email)) {
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

  if (pedido.acao === 'criarOperador') {
    const nome = pedido.nome?.trim()
    const login = pedido.login?.trim().toLowerCase()
    if (!nome || nome.length < 2) return resposta(400, { erro: 'Informe o nome.' })
    if (!login || !/^[a-z0-9][a-z0-9.]{1,30}$/.test(login)) {
      return resposta(400, { erro: 'O login usa só letras minúsculas, números e ponto.' })
    }
    if (!pedido.senha || pedido.senha.length < SENHA_MINIMA) {
      return resposta(400, { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` })
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: `${login}@${DOMINIO_OPERADOR}`,
      password: pedido.senha,
      email_confirm: true,
      user_metadata: { nome },
      app_metadata: { papel: 'operador' },
    })
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message)
      return resposta(400, { erro: jaExiste ? 'Este login já está em uso.' : error.message })
    }

    const { error: erroPerfil } = await admin
      .from('perfis')
      .update({ papel: 'operador', nome })
      .eq('id', data.user.id)
    if (erroPerfil) return resposta(500, { erro: erroPerfil.message })

    return resposta(200, { ok: true, usuarioId: data.user.id })
  }

  if (pedido.acao === 'definirSenha') {
    if (!pedido.senha || pedido.senha.length < SENHA_MINIMA) {
      return resposta(400, { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` })
    }
    // Os outros perfis trocam a senha pelo "esqueci minha senha", por e-mail.
    const { data: alvo } = await admin
      .from('perfis')
      .select('papel')
      .eq('id', pedido.usuarioId)
      .single()
    if (alvo?.papel !== 'operador') {
      return resposta(400, { erro: 'Só a senha de operadores é definida pelo administrador.' })
    }

    const { error } = await admin.auth.admin.updateUserById(pedido.usuarioId, {
      password: pedido.senha,
    })
    if (error) return resposta(400, { erro: error.message })
    return resposta(200, { ok: true })
  }

  if (pedido.acao === 'desativar' || pedido.acao === 'reativar') {
    if (pedido.usuarioId === quem.user.id) {
      return resposta(400, { erro: 'Você não pode desativar a si mesmo.' })
    }
    const ativo = pedido.acao === 'reativar'

    const { error: erroLogin } = await admin.auth.admin.updateUserById(pedido.usuarioId, {
      // "Banir" por 100 anos = bloquear o login. "none" libera de novo.
      ban_duration: ativo ? 'none' : BLOQUEADO,
    })
    if (erroLogin) return resposta(400, { erro: erroLogin.message })

    const { error: erroPerfil } = await admin
      .from('perfis')
      // Reativar alguém que esperava aprovação vale como aprovar.
      .update({ ativo, aguardando_aprovacao: false })
      .eq('id', pedido.usuarioId)
    if (erroPerfil) return resposta(500, { erro: erroPerfil.message })

    return resposta(200, { ok: true })
  }

  if (pedido.acao === 'alterarEmail') {
    const email = pedido.email?.trim().toLowerCase()
    if (!email || !EMAIL_VALIDO.test(email)) {
      return resposta(400, { erro: 'Informe um e-mail válido.' })
    }
    // email_confirm: o admin garante que este é o e-mail certo; não precisa confirmar.
    const { error } = await admin.auth.admin.updateUserById(pedido.usuarioId, {
      email,
      email_confirm: true,
    })
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message)
      return resposta(400, {
        erro: jaExiste ? 'Já existe um usuário com este e-mail.' : error.message,
      })
    }
    const { error: erroPerfil } = await admin
      .from('perfis')
      .update({ email })
      .eq('id', pedido.usuarioId)
    if (erroPerfil) return resposta(500, { erro: erroPerfil.message })
    return resposta(200, { ok: true })
  }

  if (pedido.acao === 'reenviarAcesso') {
    // Manda para o e-mail atual um link para a pessoa criar (ou trocar) a senha.
    const { data: alvo } = await admin
      .from('perfis')
      .select('email')
      .eq('id', pedido.usuarioId)
      .single()
    if (!alvo) return resposta(404, { erro: 'Usuário não encontrado.' })
    if (alvo.email.endsWith(`@${DOMINIO_OPERADOR}`)) {
      return resposta(400, {
        erro: 'Este operador entra pelo login, sem e-mail. Use “Definir senha”.',
      })
    }
    const { error } = await admin.auth.resetPasswordForEmail(alvo.email, {
      redirectTo: pedido.redirecionarPara,
    })
    if (error) return resposta(400, { erro: error.message })
    return resposta(200, { ok: true })
  }

  if (pedido.acao === 'aprovar' || pedido.acao === 'recusar') {
    const { data: alvo } = await admin
      .from('perfis')
      .select('aguardando_aprovacao')
      .eq('id', pedido.usuarioId)
      .single()
    if (!alvo?.aguardando_aprovacao) {
      return resposta(400, { erro: 'Esta solicitação já foi resolvida.' })
    }

    if (pedido.acao === 'recusar') {
      // A conta nunca entrou no sistema: some de vez (o perfil vai junto).
      const { error } = await admin.auth.admin.deleteUser(pedido.usuarioId)
      if (error) return resposta(400, { erro: error.message })
      return resposta(200, { ok: true })
    }

    if (!PAPEIS.includes(pedido.papel)) return resposta(400, { erro: 'Perfil inválido.' })
    const { error: erroLogin } = await admin.auth.admin.updateUserById(pedido.usuarioId, {
      ban_duration: 'none',
      app_metadata: { papel: pedido.papel },
    })
    if (erroLogin) return resposta(400, { erro: erroLogin.message })
    const { error: erroPerfil } = await admin
      .from('perfis')
      .update({ ativo: true, aguardando_aprovacao: false, papel: pedido.papel })
      .eq('id', pedido.usuarioId)
    if (erroPerfil) return resposta(500, { erro: erroPerfil.message })
    return resposta(200, { ok: true })
  }

  return resposta(400, { erro: 'Ação desconhecida.' })
})

/** Link de cadastro: confere se ainda vale e, no pedido, cria a conta já bloqueada. */
async function atenderLinkDeCadastro(
  admin: ReturnType<typeof createClient>,
  pedido: PedidoPublico,
): Promise<Response> {
  const codigo = String(pedido.codigo ?? '').trim()
  if (!/^[a-f0-9]{32}$/.test(codigo)) {
    return resposta(404, { erro: 'Link de cadastro inválido.' })
  }

  const { data: link } = await admin
    .from('links_cadastro')
    .select('id, papel, expira_em, revogado')
    .eq('codigo', codigo)
    .maybeSingle()
  if (!link || link.revogado || new Date(link.expira_em) < new Date()) {
    return resposta(404, {
      erro: 'Este link de cadastro não vale mais. Peça um novo ao administrador.',
    })
  }

  if (pedido.acao === 'verLink') return resposta(200, { ok: true, papel: link.papel })

  const nome = pedido.nome?.trim().replace(/\s+/g, ' ')
  const email = pedido.email?.trim().toLowerCase()
  if (!nome || nome.length < 5 || !nome.includes(' ')) {
    return resposta(400, { erro: 'Informe o nome completo.' })
  }
  if (nome.length > 120) return resposta(400, { erro: 'Nome comprido demais.' })
  if (!email || !EMAIL_VALIDO.test(email) || email.endsWith(`@${DOMINIO_OPERADOR}`)) {
    return resposta(400, { erro: 'Informe o seu e-mail.' })
  }
  if (!pedido.senha || pedido.senha.length < SENHA_MINIMA || pedido.senha.length > 72) {
    return resposta(400, { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` })
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: pedido.senha,
    email_confirm: true,
    ban_duration: BLOQUEADO,
    user_metadata: { nome },
    app_metadata: { papel: link.papel },
  })
  if (error) {
    const jaExiste = /already|registered|exists/i.test(error.message)
    return resposta(400, {
      erro: jaExiste
        ? 'Este e-mail já tem cadastro no sistema. Se você já pediu acesso, aguarde a aprovação do administrador.'
        : error.message,
    })
  }

  const { error: erroPerfil } = await admin
    .from('perfis')
    .update({
      nome,
      papel: link.papel,
      ativo: false,
      aguardando_aprovacao: true,
      link_cadastro_id: link.id,
    })
    .eq('id', data.user.id)
  if (erroPerfil) {
    // Sem o perfil bloqueado a conta não pode ficar: desfaz.
    await admin.auth.admin.deleteUser(data.user.id)
    return resposta(500, { erro: 'Não foi possível concluir o cadastro. Tente de novo.' })
  }
  return resposta(200, { ok: true })
}
