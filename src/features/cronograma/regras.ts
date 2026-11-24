/*
 * Regras do Cronograma (Serviços > Cronograma), sem tela nem banco, para testar.
 *
 * A logística digita os dias como na planilha ("10 e 25", "3, 9, 16, 23, 30"); cada
 * unidade usa os dias da rota, só a Nª visita dela (o cliente mensal numa rota
 * quinzenal) ou os seus próprios. A situação diz o que falta: enviar, reenviar porque
 * a data mudou, avisar à mão porque o cliente não tem e-mail…
 */

import {
  datasDaUnidade,
  horarioDaUnidade,
} from '../../../supabase/functions/_shared/emailCronograma'

const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "2026-12" → quantos dias o mês tem. */
function diasNoMes(mes: string): number {
  const [a, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/**
 * "10 e 25" no mês "2026-12" → ["2026-12-10", "2026-12-25"]. Aceita vírgula, "e",
 * espaço, barra e ponto e vírgula; dias que o mês não tem vão para `invalidos`.
 */
export function diasDoTexto(texto: string, mes: string): { datas: string[]; invalidos: string[] } {
  const total = diasNoMes(mes)
  const datas = new Set<string>()
  const invalidos: string[] = []
  for (const parte of texto.split(/[\s,;/]+|\be\b/i).map((p) => p.trim())) {
    if (!parte) continue
    const n = /^\d{1,2}$/.test(parte) ? Number(parte) : NaN
    if (!Number.isInteger(n) || n < 1 || n > total) invalidos.push(parte)
    else datas.add(`${mes}-${String(n).padStart(2, '0')}`)
  }
  return { datas: [...datas].sort(), invalidos }
}

/** ["2026-12-03", "2026-12-09", "2026-12-16"] → "3, 9 e 16" (para editar de novo). */
export function textoDosDias(datas: readonly string[]): string {
  const dias = [...datas].sort().map((d) => String(Number(d.slice(8, 10))))
  if (dias.length <= 1) return dias.join('')
  return `${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}`
}

/** "2026-12-10" → "10/12 qui" */
export function diaCurto(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const semana = SEMANA_CURTA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${semana}`
}

/** Sábado ou domingo (para chamar a atenção na hora de digitar). */
export function fimDeSemana(iso: string): boolean {
  const [a, m, d] = iso.split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
  return dia === 0 || dia === 6
}

export type DiasDaUnidade = { datas: string[] | null; so_visita: number | null }

// Os mesmos cálculos do e-mail (a função "cronograma" usa o mesmo arquivo).
export { datasDaUnidade, horarioDaUnidade }

export type Situacao =
  | 'fora'
  | 'sem_datas'
  | 'sem_email'
  | 'a_enviar'
  | 'enviado'
  | 'alterado'
  | 'manual'
  | 'aguardando'
  | 'confirmado'
  | 'outra_data'

export const NOME_SITUACAO: Record<Situacao, string> = {
  fora: 'Fora deste mês',
  sem_datas: 'Sem datas',
  sem_email: 'Pendente de envio: sem e-mail',
  a_enviar: 'A enviar',
  enviado: 'Enviado',
  alterado: 'Datas alteradas: reenviar',
  manual: 'Avisado à mão',
  aguardando: 'Aguardando resposta',
  confirmado: 'Cliente confirmou',
  outra_data: 'Pediu outra data',
}

export const COR_SITUACAO: Record<Situacao, 'verde' | 'cinza' | 'alerta' | 'perigo'> = {
  fora: 'cinza',
  sem_datas: 'alerta',
  sem_email: 'perigo',
  a_enviar: 'alerta',
  enviado: 'verde',
  alterado: 'perigo',
  manual: 'verde',
  aguardando: 'alerta',
  confirmado: 'verde',
  outra_data: 'perigo',
}

export type ItemSituacao = DiasDaUnidade & {
  incluido: boolean
  horario: string | null
  enviado_em: string | null
  datas_enviadas: string[] | null
  horario_enviado: string | null
  aviso_manual_em: string | null
  /** Serviço de contrato: o e-mail pergunta se a data serve. */
  pede_confirmacao?: boolean
  resposta?: string | null
}

const iguais = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i])

/**
 * Em que pé está a unidade. `temEmail`: o cliente tem e-mail principal (ou de
 * contato) no cadastro agora — sem ele, nem tenta enviar.
 */
export function situacaoDoItem(
  item: ItemSituacao,
  rota: { datas: readonly string[]; horario: string | null },
  temEmail: boolean,
): Situacao {
  if (!item.incluido) return 'fora'
  const datas = datasDaUnidade(item, rota.datas)
  if (datas.length === 0) return 'sem_datas'
  const resposta: Situacao | null =
    item.resposta === 'confirmado'
      ? 'confirmado'
      : item.resposta === 'outra_data'
        ? 'outra_data'
        : null
  if (item.enviado_em) {
    const mesmoHorario =
      (item.horario_enviado ?? null) === (horarioDaUnidade(item, rota.horario) ?? null)
    if (!iguais(datas, item.datas_enviadas ?? []) || !mesmoHorario) return 'alterado'
    if (!item.pede_confirmacao) return 'enviado'
    return resposta ?? 'aguardando'
  }
  if (item.aviso_manual_em) return item.pede_confirmacao ? (resposta ?? 'aguardando') : 'manual'
  return temEmail ? 'a_enviar' : 'sem_email'
}

/** Quem entra no botão "Enviar": nunca enviado ou com datas alteradas, e com e-mail. */
export function precisaEnviar(s: Situacao): boolean {
  return s === 'a_enviar' || s === 'alterado'
}

/** Ainda falta algo do SAC (enviar, avisar à mão, cobrar a resposta, remarcar). */
export function pendente(s: Situacao): boolean {
  return ['a_enviar', 'alterado', 'sem_email', 'sem_datas', 'aguardando', 'outra_data'].includes(s)
}

export type ModeloDaRota = {
  ordem: number
  modelo: {
    ativo: boolean
    descricao: string | null
    cliente: { id: string } | null
    endereco: { id: string } | null
    tipo: { nome: string } | null
  } | null
}

export type UnidadeDaRota = {
  cliente_id: string
  endereco_id: string | null
  servicos: string[]
  ordem: number
}

/**
 * As O.S salvas da rota viram unidades (cliente + endereço), na ordem da rota; duas
 * O.S do mesmo local (pragas e outro serviço) ficam numa unidade só.
 */
export function unidadesDaRota(itens: readonly ModeloDaRota[]): UnidadeDaRota[] {
  const porLocal = new Map<string, UnidadeDaRota>()
  for (const it of [...itens].sort((a, b) => a.ordem - b.ordem)) {
    const m = it.modelo
    if (!m?.ativo || !m.cliente) continue
    const chave = `${m.cliente.id}|${m.endereco?.id ?? ''}`
    const servico = (m.tipo?.nome || m.descricao || '').trim()
    const atual = porLocal.get(chave)
    if (atual) {
      if (servico && !atual.servicos.includes(servico)) atual.servicos.push(servico)
    } else {
      porLocal.set(chave, {
        cliente_id: m.cliente.id,
        endereco_id: m.endereco?.id ?? null,
        servicos: servico ? [servico] : [],
        ordem: porLocal.size,
      })
    }
  }
  return [...porLocal.values()]
}
