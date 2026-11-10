import type { Enums } from '@/lib/database.types'
import { formatarTelefone, soNumeros } from '@/lib/documentos'
import type { Papel } from '@/lib/papeis'
import { UNIDADE } from '@/lib/unidade'

export { janelaAberta } from '../../../supabase/functions/_shared/whatsapp'

export type StatusConversa = Enums<'status_conversa'>
export type SetorAtendimento = Enums<'setor_atendimento'>
export type StatusMensagem = Enums<'status_mensagem'>

export const NOME_STATUS: Record<StatusConversa, string> = {
  aberta: 'Aberta',
  pendente: 'Pendente',
  finalizada: 'Finalizada',
}

export const NOME_SETOR: Record<SetorAtendimento, string> = {
  administrativo: 'Administrativo',
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  operacional: 'Operacional',
}

export const SETORES = Object.keys(NOME_SETOR) as SetorAtendimento[]

/**
 * Pode abrir o CRM (a mesma regra do banco, privado.pode_usar_crm). Só na unidade que
 * tem número de WhatsApp ligado. A tela só decide o que mostrar; quem protege é o banco.
 */
export function podeUsarCrm(
  perfil: { papel: Papel; ativo: boolean; atende_whatsapp: boolean } | null,
  temCrm = UNIDADE.crm,
): boolean {
  if (!temCrm || !perfil?.ativo || perfil.papel === 'operador') return false
  return perfil.papel === 'admin' || perfil.atende_whatsapp
}

/** Admin e ADM encaminham conversas (o ADM faz o primeiro atendimento). */
export function podeTransferir(papel: Papel): boolean {
  return papel === 'admin' || papel === 'administrativo'
}

/** "5548988608723" → "(48) 98860-8723". Números de fora do Brasil ficam com +. */
export function telefoneDoWaId(waId: string): string {
  const n = soNumeros(waId)
  if (/^55\d{10,11}$/.test(n)) return formatarTelefone(n.slice(2))
  return `+${n}`
}

/** Telefone do cadastro de cliente (DDD + número) a partir do wa_id. */
export function telefoneParaCadastro(waId: string): string {
  const n = soNumeros(waId)
  if (!/^55\d{10,11}$/.test(n)) return ''
  const local = n.slice(2)
  // A Meta às vezes manda o celular sem o 9: o cadastro guarda com ele.
  if (local.length === 10 && /[6-9]/.test(local[2])) return `${local.slice(0, 2)}9${local.slice(2)}`
  return local
}

type ContatoDaConversa = {
  wa_id: string
  nome_perfil: string | null
  cliente: { nome: string; nome_fantasia: string | null } | null
}

/** Nome mostrado: o do cadastro do cliente, senão o do perfil do WhatsApp, senão o número. */
export function nomeDoContato(contato: ContatoDaConversa | null): string {
  if (!contato) return 'Contato'
  return (
    contato.cliente?.nome_fantasia ||
    contato.cliente?.nome ||
    contato.nome_perfil ||
    telefoneDoWaId(contato.wa_id)
  )
}

/** Duas letras para o avatar (a API da Meta não fornece a foto do cliente). */
export function iniciais(nome: string): string {
  const palavras = nome
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!palavras.length) return '?'
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase()
  return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase()
}

export type Filtro =
  'abertas' | 'pendentes' | 'finalizadas' | 'nao_lidas' | 'primeiro_contato' | 'minhas' | 'todas'

export const NOME_FILTRO: Record<Filtro, string> = {
  abertas: 'Abertas',
  pendentes: 'Pendentes',
  nao_lidas: 'Não lidas',
  primeiro_contato: 'Primeiro contato',
  minhas: 'Minhas',
  finalizadas: 'Finalizadas',
  todas: 'Todas',
}

/** Filtros que cada perfil vê (o primeiro contato só aparece para quem atende ele). */
export function filtrosDoPapel(papel: Papel): Filtro[] {
  const base: Filtro[] = ['abertas', 'pendentes', 'nao_lidas']
  if (podeTransferir(papel)) base.push('primeiro_contato', 'minhas')
  return [...base, 'finalizadas', 'todas']
}

type ConversaFiltravel = {
  status: StatusConversa
  nao_lidas: number
  responsavel_id: string | null
  contato: ContatoDaConversa | null
}

/** Busca sem acento e sem diferenciar maiúsculas; por número, compara só os dígitos. */
const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function filtrarConversas<T extends ConversaFiltravel>(
  conversas: T[],
  filtro: Filtro,
  busca: string,
  usuarioId: string,
): T[] {
  const termo = normalizar(busca.trim())
  const digitos = soNumeros(busca)
  return conversas.filter((c) => {
    const passa =
      filtro === 'todas' ||
      (filtro === 'abertas' && c.status === 'aberta') ||
      (filtro === 'pendentes' && c.status === 'pendente') ||
      (filtro === 'finalizadas' && c.status === 'finalizada') ||
      (filtro === 'nao_lidas' && c.nao_lidas > 0) ||
      (filtro === 'primeiro_contato' && !c.responsavel_id && c.status !== 'finalizada') ||
      (filtro === 'minhas' && c.responsavel_id === usuarioId && c.status !== 'finalizada')
    if (!passa) return false
    if (!termo) return true
    const nomes = [
      c.contato?.nome_perfil,
      c.contato?.cliente?.nome,
      c.contato?.cliente?.nome_fantasia,
    ]
      .filter(Boolean)
      .map((n) => normalizar(n!))
    if (nomes.some((n) => n.includes(termo))) return true
    if (digitos.length >= 3 && c.contato) {
      const wa = c.contato.wa_id
      return wa.includes(digitos) || telefoneParaCadastro(wa).includes(digitos)
    }
    return false
  })
}

/** "Hoje", "Ontem" ou a data, para separar as mensagens por dia. */
export function rotuloDoDia(iso: string, agora = new Date()): string {
  const dia = new Date(iso)
  const zero = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diferenca = Math.round((zero(agora) - zero(dia)) / 86_400_000)
  if (diferenca === 0) return 'Hoje'
  if (diferenca === 1) return 'Ontem'
  return dia.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: dia.getFullYear() === agora.getFullYear() ? undefined : 'numeric',
  })
}

/** Hora na lista de conversas: só a hora se for hoje, "Ontem" ou a data curta. */
export function horaNaLista(iso: string | null, agora = new Date()): string {
  if (!iso) return ''
  const rotulo = rotuloDoDia(iso, agora)
  if (rotulo === 'Hoje') {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  if (rotulo === 'Ontem') return rotulo
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Nome seguro para o arquivo no Storage (sem acentos, espaços ou barras). */
export function nomeDeArquivoSeguro(nome: string): string {
  const limpo = normalizar(nome)
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return limpo.slice(-80) || 'arquivo'
}
