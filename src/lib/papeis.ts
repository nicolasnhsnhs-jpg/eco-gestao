/**
 * Perfis de acesso do sistema.
 * Os mesmos valores existem no banco de dados (tipo "papel"). A tela usa esta lista só
 * para decidir o que mostrar; quem garante a segurança de verdade é o banco (RLS).
 */
export const PAPEIS = ['admin', 'financeiro', 'vendedor', 'recepcao'] as const

export type Papel = (typeof PAPEIS)[number]

export const NOME_DO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  financeiro: 'Financeiro',
  vendedor: 'Vendedor',
  recepcao: 'Recepção',
}

/** Admin e Financeiro enxergam tudo. */
export const PAPEIS_ACESSO_TOTAL: readonly Papel[] = ['admin', 'financeiro']
