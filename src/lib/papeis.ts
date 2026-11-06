import { UNIDADE } from '@/lib/unidade'

/**
 * Perfis de acesso do sistema.
 * Os mesmos valores existem no banco de dados (tipo "papel"). A tela usa esta lista só
 * para decidir o que mostrar; quem garante a segurança de verdade é o banco (RLS).
 */
export const PAPEIS = [
  'admin',
  'financeiro',
  'administrativo',
  'vendedor',
  'recepcao',
  'operador',
] as const

export type Papel = (typeof PAPEIS)[number]

export const NOME_DO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  // Setor administrativo / agendamentos. Não confundir com "admin" (Administrador).
  administrativo: 'ADM',
  vendedor: 'Vendedor',
  recepcao: 'Recepção',
  operador: 'Operador',
}

/** Admin e Financeiro enxergam tudo, inclusive o financeiro. */
export const PAPEIS_ACESSO_TOTAL: readonly Papel[] = ['admin', 'financeiro']

/**
 * Quem cuida de todos os cadastros e da operação (clientes, propostas, contratos,
 * serviços, OS). O ADM entra aqui, mas não no financeiro nem na gestão de usuários.
 */
export const PAPEIS_GESTAO: readonly Papel[] = ['admin', 'financeiro', 'administrativo']

/** Quem agenda e acompanha as ordens de serviço no escritório. */
export const PAPEIS_ESCRITORIO_OS: readonly Papel[] = [
  'admin',
  'financeiro',
  'administrativo',
  'recepcao',
]

/** Quem emite certificados de serviço. */
export const PAPEIS_CERTIFICADOS: readonly Papel[] = ['admin', 'administrativo']

/** Perfis que não são da equipe comercial: não podem ser o vendedor de um cliente. */
export const PAPEIS_FORA_DO_COMERCIAL: readonly Papel[] = ['recepcao', 'operador', 'administrativo']

/**
 * Operadores entram com um login curto (ex.: "joao"), que vira joao@<este domínio>.
 * Ninguém recebe e-mail nesse endereço: ele só identifica a conta. Cada unidade tem o seu.
 */
export const DOMINIO_OPERADOR = UNIDADE.dominioOperador

/** O ADM cuida dos contratos, mas não vê quanto cada cliente paga. */
export function veValorDeContrato(papel: Papel): boolean {
  return papel !== 'administrativo'
}
