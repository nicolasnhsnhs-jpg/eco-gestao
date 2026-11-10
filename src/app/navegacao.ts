import {
  Award,
  Bell,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarDays,
  ClipboardList,
  FileText,
  HandCoins,
  House,
  Mail,
  MessageCircle,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import {
  PAPEIS,
  PAPEIS_ACESSO_TOTAL,
  PAPEIS_CERTIFICADOS,
  PAPEIS_ESCRITORIO_OS,
  PAPEIS_GESTAO,
  type Papel,
} from '@/lib/papeis'

export type ItemMenu = {
  rotulo: string
  caminho: string
  icone: LucideIcon
  /** Quem vê este item no menu. */
  papeis: readonly Papel[]
  /** Para quem este item aparece na barra de atalhos do celular (no máximo 4 por perfil). */
  barraInferior?: readonly Papel[]
  /** Grupo do menu lateral onde o item fica (ver GRUPOS). */
  grupo?: NomeGrupo
  /** Só aparece para quem usa o CRM do WhatsApp (permissão no perfil, ver crm/regras.ts). */
  crm?: boolean
}

/** O que, além do perfil, muda o menu de uma pessoa. */
export type OpcoesMenu = { crm?: boolean }

type NomeGrupo = 'administrativo' | 'propostas'

export type GrupoMenu = {
  tipo: 'grupo'
  rotulo: string
  icone: LucideIcon
  itens: ItemMenu[]
}

/** O que aparece no menu lateral: um item solto ou um grupo que abre e fecha. */
export type EntradaMenu = ({ tipo: 'item' } & ItemMenu) | GrupoMenu

/**
 * Grupos do menu lateral. Quem não está em `papeis` vê os itens do grupo soltos
 * (o vendedor, por exemplo, não tem um "Administrativo").
 */
const GRUPOS: Record<NomeGrupo, { rotulo: string; icone: LucideIcon; papeis: readonly Papel[] }> = {
  administrativo: { rotulo: 'Administrativo', icone: Building2, papeis: PAPEIS_GESTAO },
  propostas: { rotulo: 'Propostas', icone: FileText, papeis: PAPEIS },
}

const TODOS = PAPEIS
/** O operador só trabalha com as OS dele: não vê clientes. */
const SEM_OPERADOR = PAPEIS.filter((p) => p !== 'operador')
/** Quem trabalha com propostas, serviços e contratos. */
const COMERCIAL: readonly Papel[] = [...PAPEIS_GESTAO, 'vendedor']

export const MENU: readonly ItemMenu[] = [
  { rotulo: 'Início', caminho: '/', icone: House, papeis: TODOS, barraInferior: TODOS },
  {
    rotulo: 'Atendimento',
    caminho: '/crm',
    icone: MessageCircle,
    papeis: SEM_OPERADOR,
    barraInferior: SEM_OPERADOR,
    crm: true,
  },
  {
    rotulo: 'Clientes',
    caminho: '/clientes',
    icone: Users,
    papeis: SEM_OPERADOR,
    barraInferior: SEM_OPERADOR,
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
    papeis: COMERCIAL,
    grupo: 'propostas',
  },
  {
    rotulo: 'Calculadora',
    caminho: '/orcamentos',
    icone: Calculator,
    // O financeiro não usa: só quem vende, o admin e o ADM.
    papeis: ['admin', 'administrativo', 'vendedor'],
    grupo: 'propostas',
  },
  {
    // Serviços agendados e feitos: é onde o ADM confere a agenda e vê o que já pode virar certificado.
    rotulo: 'Agenda',
    caminho: '/servicos',
    icone: CalendarDays,
    papeis: COMERCIAL,
    barraInferior: ['vendedor'],
    grupo: 'administrativo',
  },
  {
    rotulo: 'Ordens de serviço',
    caminho: '/os',
    icone: ClipboardList,
    papeis: PAPEIS_ESCRITORIO_OS,
    barraInferior: ['recepcao', 'administrativo'],
    grupo: 'administrativo',
  },
  {
    rotulo: 'Certificados',
    caminho: '/certificados',
    icone: Award,
    papeis: PAPEIS_CERTIFICADOS,
    grupo: 'administrativo',
  },
  {
    rotulo: 'Contratos',
    caminho: '/contratos',
    icone: BriefcaseBusiness,
    papeis: COMERCIAL,
    grupo: 'administrativo',
  },
  {
    rotulo: 'Assinatura de e-mail',
    caminho: '/administrativo',
    icone: Mail,
    papeis: PAPEIS_GESTAO,
    grupo: 'administrativo',
  },
  { rotulo: 'Minhas comissões', caminho: '/comissoes', icone: HandCoins, papeis: ['vendedor'] },
  { rotulo: 'Avisos', caminho: '/avisos', icone: Bell, papeis: TODOS, barraInferior: TODOS },
  { rotulo: 'Usuários', caminho: '/usuarios', icone: UserCog, papeis: ['admin'] },
]

/** Itens do menu que um perfil pode ver. */
export function menuDoPapel(papel: Papel, opcoes: OpcoesMenu = {}): ItemMenu[] {
  return MENU.filter((item) => item.papeis.includes(papel) && (!item.crm || opcoes.crm))
}

/** Atalhos da barra de baixo (celular) de um perfil. Com o CRM, podem ser 5. */
export function barraDoPapel(papel: Papel, opcoes: OpcoesMenu = {}): ItemMenu[] {
  return menuDoPapel(papel, opcoes).filter((item) => item.barraInferior?.includes(papel))
}

/**
 * Menu lateral de um perfil, já agrupado. O grupo fica onde aparece o primeiro
 * item dele; um grupo com um item só vira item solto.
 */
export function entradasDoPapel(papel: Papel, opcoes: OpcoesMenu = {}): EntradaMenu[] {
  const entradas: EntradaMenu[] = []
  const grupos = new Map<NomeGrupo, GrupoMenu>()
  for (const item of menuDoPapel(papel, opcoes)) {
    const nome = item.grupo
    if (!nome || !GRUPOS[nome].papeis.includes(papel)) {
      entradas.push({ tipo: 'item', ...item })
      continue
    }
    let grupo = grupos.get(nome)
    if (!grupo) {
      grupo = { tipo: 'grupo', rotulo: GRUPOS[nome].rotulo, icone: GRUPOS[nome].icone, itens: [] }
      grupos.set(nome, grupo)
      entradas.push(grupo)
    }
    grupo.itens.push(item)
  }
  return entradas.map((e) =>
    e.tipo === 'grupo' && e.itens.length === 1 ? { tipo: 'item', ...e.itens[0] } : e,
  )
}
