/**
 * Transforma erros do Supabase/PostgreSQL em mensagens em português para a tela.
 */

type ErroBanco = { code?: string; message?: string; details?: string }

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  '23505': 'Já existe um cadastro com estes dados (por exemplo, o mesmo CPF/CNPJ).',
  '23503': 'Este registro está ligado a outras informações e não pode ser removido.',
  '42501': 'Você não tem permissão para fazer isso.',
  PGRST116: 'Registro não encontrado ou sem permissão de acesso.',
}

const MENSAGENS_LOGIN: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme o seu e-mail pelo link do convite antes de entrar.',
  'User is banned': 'Seu acesso foi desativado. Fale com o administrador.',
  'Failed to fetch': 'Sem conexão com o servidor. Verifique a internet.',
}

export function mensagemDeErro(erro: unknown): string {
  if (!erro) return 'Algo deu errado. Tente novamente.'
  const e = erro as ErroBanco

  if (e.message && MENSAGENS_LOGIN[e.message]) return MENSAGENS_LOGIN[e.message]
  if (e.message?.includes('Password should be at least')) {
    return 'A senha é curta demais. Use pelo menos 8 caracteres.'
  }
  if (e.message?.includes('should be different from the old password')) {
    return 'A nova senha precisa ser diferente da anterior.'
  }

  // Mensagens que nós mesmos escrevemos no banco (raise exception) já vêm em português.
  if (e.code === '42501' && e.message && !e.message.startsWith('new row violates')) {
    return e.message
  }
  if (e.code === '23514' && e.message && !e.message.includes('violates check constraint')) {
    return e.message
  }
  if (e.code === '23514') return 'Algum campo está com um valor inválido. Confira os dados.'
  if (e.code && MENSAGENS_POR_CODIGO[e.code]) return MENSAGENS_POR_CODIGO[e.code]
  if (e.code === 'P0002' || e.code === '22023') return e.message ?? 'Dados inválidos.'

  return e.message || 'Algo deu errado. Tente novamente.'
}
