import {
  Bell,
  BriefcaseBusiness,
  FileText,
  House,
  UserCog,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { PAPEIS_ACESSO_TOTAL, type Papel } from '@/lib/papeis'

export type ItemMenu = {
  rotulo: string
  caminho: string
  icone: LucideIcon
  /** Quem vê este item no menu. */
  papeis: readonly Papel[]
  /** Aparece na barra inferior do celular (no máximo 4 itens). */
  barraInferior?: boolean
}

const TODOS: readonly Papel[] = ['admin', 'financeiro', 'vendedor', 'recepcao']

export const MENU: readonly ItemMenu[] = [
  { rotulo: 'Início', caminho: '/', icone: House, papeis: TODOS, barraInferior: true },
  { rotulo: 'Clientes', caminho: '/clientes', icone: Users, papeis: TODOS, barraInferior: true },
  {
    rotulo: 'Financeiro',
    caminho: '/financeiro',
    icone: Wallet,
    papeis: PAPEIS_ACESSO_TOTAL,
    barraInferior: true,
  },
  {
    rotulo: 'Propostas',
    caminho: '/propostas',
    icone: FileText,
    papeis: ['admin', 'financeiro', 'vendedor'],
  },
  {
    rotulo: 'Serviços',
    caminho: '/servicos',
    icone: Wrench,
    papeis: ['admin', 'financeiro', 'vendedor'],
  },
  {
    rotulo: 'Contratos',
    caminho: '/contratos',
    icone: BriefcaseBusiness,
    papeis: ['admin', 'financeiro', 'vendedor'],
  },
  { rotulo: 'Avisos', caminho: '/avisos', icone: Bell, papeis: TODOS, barraInferior: true },
  { rotulo: 'Usuários', caminho: '/usuarios', icone: UserCog, papeis: ['admin'] },
]

/** Itens do menu que um perfil pode ver. */
export function menuDoPapel(papel: Papel): ItemMenu[] {
  return MENU.filter((item) => item.papeis.includes(papel))
}
