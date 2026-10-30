import {
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  HandCoins,
  House,
  UserCog,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { PAPEIS, PAPEIS_ACESSO_TOTAL, PAPEIS_ESCRITORIO_OS, type Papel } from '@/lib/papeis'

export type ItemMenu = {
  rotulo: string
  caminho: string
  icone: LucideIcon
  /** Quem vê este item no menu. */
  papeis: readonly Papel[]
  /** Para quem este item aparece na barra de atalhos do celular (no máximo 4 por perfil). */
  barraInferior?: readonly Papel[]
}

const TODOS = PAPEIS
/** O operador só trabalha com as OS dele: não vê clientes. */
const SEM_OPERADOR = PAPEIS.filter((p) => p !== 'operador')

export const MENU: readonly ItemMenu[] = [
  { rotulo: 'Início', caminho: '/', icone: House, papeis: TODOS, barraInferior: TODOS },
  {
    rotulo: 'Clientes',
    caminho: '/clientes',
    icone: Users,
    papeis: SEM_OPERADOR,
    barraInferior: SEM_OPERADOR,
  },
  {
    rotulo: 'Ordens de serviço',
    caminho: '/os',
    icone: ClipboardList,
    papeis: PAPEIS_ESCRITORIO_OS,
    barraInferior: ['recepcao'],
  },
  {
    rotulo: 'Financeiro',
    caminho: '/financeiro',
    icone: Wallet,
    papeis: PAPEIS_ACESSO_TOTAL,
    barraInferior: PAPEIS_ACESSO_TOTAL,
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
    barraInferior: ['vendedor'],
  },
  {
    rotulo: 'Contratos',
    caminho: '/contratos',
    icone: BriefcaseBusiness,
    papeis: ['admin', 'financeiro', 'vendedor'],
  },
  { rotulo: 'Minhas comissões', caminho: '/comissoes', icone: HandCoins, papeis: ['vendedor'] },
  { rotulo: 'Avisos', caminho: '/avisos', icone: Bell, papeis: TODOS, barraInferior: TODOS },
  { rotulo: 'Usuários', caminho: '/usuarios', icone: UserCog, papeis: ['admin'] },
]

/** Itens do menu que um perfil pode ver. */
export function menuDoPapel(papel: Papel): ItemMenu[] {
  return MENU.filter((item) => item.papeis.includes(papel))
}

/** Atalhos da barra de baixo (celular) de um perfil. */
export function barraDoPapel(papel: Papel): ItemMenu[] {
  return menuDoPapel(papel).filter((item) => item.barraInferior?.includes(papel))
}
