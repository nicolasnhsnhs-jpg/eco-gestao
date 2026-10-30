/**
 * Perfis de acesso do sistema.
 * Os mesmos valores existem no banco de dados (tipo "papel"). A tela usa esta lista só
 * para decidir o que mostrar; quem garante a segurança de verdade é o banco (RLS).
 */
export const PAPEIS = ['admin', 'financeiro', 'vendedor', 'recepcao', 'operador'] as const

export type Papel = (typeof PAPEIS)[number]

export const NOME_DO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  vendedor: 'Vendedor',
  recepcao: 'Recepção',
  operador: 'Operador',
}

/** Admin e Financeiro enxergam tudo. */
export const PAPEIS_ACESSO_TOTAL: readonly Papel[] = ['admin', 'financeiro']

/** Quem agenda e acompanha as ordens de serviço no escritório. */
export const PAPEIS_ESCRITORIO_OS: readonly Papel[] = ['admin', 'financeiro', 'recepcao']

/**
 * Operadores entram com um login curto (ex.: "joao"), que vira joao@<este domínio>.
 * Ninguém recebe e-mail nesse endereço: ele só identifica a conta.
 */
export const DOMINIO_OPERADOR = 'op.ecoambientalsc.com.br'
