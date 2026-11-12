import type { Json, Tables } from '@/lib/database.types'

/*
 * Regras da agenda do dia (sem tela nem banco), para dar para testar.
 */

export type AgendaDia = Tables<'agenda_dias'>
export type AgendaItem = Tables<'agenda_itens'>
/** Volta para almoçar na empresa? (verde volta, vermelho não dá, traço não se aplica) */
export type Almoco = 'volta' | 'fica' | 'nao_se_aplica'
export type Escala = { inicio: string; fim: string; tecnicos: number[] }
export type Tecnico = Tables<'agenda_tecnicos'>
export type Veiculo = Tables<'agenda_veiculos'>

/** Ordem em que o almoço muda a cada clique. */
const CICLO_ALMOCO: Almoco[] = ['fica', 'volta', 'nao_se_aplica']

export function proximoAlmoco(a: string): Almoco {
  const i = CICLO_ALMOCO.indexOf(a as Almoco)
  return CICLO_ALMOCO[(i + 1) % CICLO_ALMOCO.length]
}

/** Linha nova: de manhã começa "não volta"; à tarde não se aplica. */
export function almocoPadrao(hora: string): Almoco {
  return hora < '12:00' ? 'fica' : 'nao_se_aplica'
}

export const NOME_ALMOCO: Record<Almoco, string> = {
  volta: 'Volta para almoçar',
  fica: 'Não volta para almoçar',
  nao_se_aplica: 'Almoço não se aplica',
}

/**
 * "SUSEPE 14 e 20: Rota / Santa Maria" → [["SUSEPE 14 e 20", "Rota / Santa Maria"]]
 * "GHC: LR / IBIS Aeroporto: CI aptos" → [["GHC", "LR"], ["IBIS Aeroporto", "CI aptos"]]
 * Só separa no " / " quando o pedaço seguinte também tem "Empresa:".
 * Sem nenhum ":", cada barra separa um cliente: "GHC / IBIS / Unimed" → 3 clientes
 * (menos a barra de data, como em 09/11).
 */
export function partesDaDescricao(descricao: string): [string, string][] {
  const separador = descricao.includes(':') ? /\s+\/\s+(?=[^/]*:)/ : /\s*(?<!\d)\/(?!\d)\s*/
  return descricao
    .split(separador)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(':')
      return i < 0 ? [p, ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    })
}

/**
 * De qual cliente da linha é a observação, o horário ou a taxa. Com um cliente só,
 * ou se o escolhido saiu do texto, vale para a linha toda (null).
 */
export function parteDaLinha(parte: number | null, qtd: number): number | null {
  return parte !== null && qtd > 1 && parte >= 0 && parte < qtd ? parte : null
}

/** Taxas que mais aparecem (sugestões do campo). */
export const TAXAS_COMUNS = [
  'Deslocamento',
  'Sábado',
  'Domingo',
  'Feriado',
  'Noturno',
  'Após o horário',
  'Urgência',
]

/**
 * "Deslocamento" + "não realizado" → "Taxa de deslocamento: não realizado"
 * "Após o horário" → "Taxa após o horário"
 */
export function textoDaTaxa(taxa: string, motivo: string): string {
  const t = taxa.trim()
  const m = motivo.trim()
  if (!t && !m) return ''
  const minusculo = `${t.charAt(0).toLowerCase()}${t.slice(1)}`
  const nome = !t
    ? 'Taxa'
    : /^taxa\b/i.test(t)
      ? t
      : /^(ap[oó]s|fora|antes)\b/i.test(t)
        ? `Taxa ${minusculo}`
        : `Taxa de ${minusculo}`
  return m ? `${nome}: ${m}` : nome
}

/** Liga ou desliga o avulso do cliente na posição i da linha. */
export function alternarAvulso(partes: readonly number[], i: number): number[] {
  return partes.includes(i) ? partes.filter((p) => p !== i) : [...partes, i].sort((a, b) => a - b)
}

/** "3, 4 e 13" → [3, 4, 13] (sem repetir). */
export function lerTecnicos(texto: string): number[] {
  return [...new Set((texto.match(/\d+/g) ?? []).map(Number))]
}

export function escreverTecnicos(tecnicos: readonly number[]): string {
  return tecnicos.join(', ')
}

/** "S3, ON14 g16" → ["S3", "ON14", "G16"] */
export function lerPlacas(texto: string): string[] {
  return [
    ...new Set(
      texto
        .split(/[\s,;]+/)
        .map((p) => p.trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
}

/** As escalas gravadas no banco (jsonb), conferidas. */
export function lerEscalas(valor: Json | null | undefined): Escala[] {
  if (!Array.isArray(valor)) return []
  return valor.flatMap((e) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return []
    const tecnicos = Array.isArray(e.tecnicos)
      ? e.tecnicos.filter((n): n is number => typeof n === 'number')
      : []
    return [{ inicio: String(e.inicio ?? ''), fim: String(e.fim ?? ''), tecnicos }]
  })
}

/** Em qual escala o técnico está (índice), ou -1. */
export function escalaDoTecnico(n: number, escalas: readonly Escala[]): number {
  return escalas.findIndex((e) => e.tecnicos.includes(n))
}

export type CorEscala = 'padrao' | 'escura' | 'verde'

/**
 * Cor das bolinhas de cada escala. A escala com mais técnicos (ou a única) é a
 * padrão: branca com borda escura. As outras (horários diferentes, com menos gente)
 * ficam escuras e, se houver uma terceira, verdes.
 */
export function coresDasEscalas(escalas: readonly Escala[]): CorEscala[] {
  let maior = 0
  escalas.forEach((e, i) => {
    if (e.tecnicos.length > escalas[maior].tecnicos.length) maior = i
  })
  const outras: CorEscala[] = ['escura', 'verde']
  let k = 0
  return escalas.map((_, i) => (i === maior ? 'padrao' : (outras[Math.min(k++, 1)] as CorEscala)))
}

/** Pela hora, depois pela ordem escolhida e, por fim, pela criação. */
export function ordenarItens<T extends Pick<AgendaItem, 'hora' | 'ordem' | 'criado_em'>>(
  itens: readonly T[],
): T[] {
  return [...itens].sort(
    (a, b) =>
      a.hora.localeCompare(b.hora) || a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em),
  )
}

export function turnoDe(hora: string): 'Manhã' | 'Tarde' {
  return hora < '12:00' ? 'Manhã' : 'Tarde'
}

/** Linhas que aparecem no quadro (as sem descrição ficam de fora). */
export function itensDoQuadro<T extends AgendaItem>(itens: readonly T[]): T[] {
  return ordenarItens(itens.filter((i) => i.descricao.trim()))
}

export function resumoDoDia(itens: readonly AgendaItem[]) {
  const visiveis = itensDoQuadro(itens)
  return {
    servicos: visiveis.length,
    tecnicos: new Set(visiveis.flatMap((i) => i.tecnicos)).size,
    veiculos: new Set(visiveis.map((i) => i.veiculo.trim().toUpperCase()).filter(Boolean)).size,
  }
}

/** Horário escrito no texto: "às 6h", "14h", "9h30", "09:00". */
const HORARIO = /(?<![\p{L}\d])(?:[aàá]s\s+)?\d{1,2}(?:h(?:\d{2})?|:\d{2}h?)(?![\p{L}\d])/giu

/** "às", "ás" ou "as" antes do horário (escrevem de vários jeitos). */
const PREFIXO = /^[aàá]s\s+/i

/** Separa o texto em pedaços, marcando os horários (que aparecem brilhando com estrela). */
export function trechosComHorario(texto: string): { texto: string; horario: boolean }[] {
  const saida: { texto: string; horario: boolean }[] = []
  let desde = 0
  for (const m of texto.matchAll(HORARIO)) {
    const i = m.index ?? 0
    if (i > desde) saida.push({ texto: texto.slice(desde, i), horario: false })
    saida.push({ texto: m[0].replace(PREFIXO, 'às '), horario: true })
    desde = i + m[0].length
  }
  if (desde < texto.length) saida.push({ texto: texto.slice(desde), horario: false })
  return saida
}

/** "9h" → "às 9h". */
export function textoHorarioCliente(chegada: string): string {
  const h = chegada.trim()
  return !h ? '' : `às ${h.replace(PREFIXO, '')}`
}

/** Horário do campo que ainda não está escrito no texto (vira selo ao lado do cliente). */
export function horarioForaDoTexto(descricao: string, chegada: string): string {
  const h = chegada.trim().replace(PREFIXO, '').toLowerCase()
  if (!h) return ''
  const noTexto = trechosComHorario(descricao)
    .filter((t) => t.horario)
    .some((t) => t.texto.replace(PREFIXO, '').toLowerCase() === h)
  return noTexto ? '' : textoHorarioCliente(chegada)
}

/** O valor (horário ou observação) do cliente i da linha ('' = nada). */
export function valorDaParte(horarios: readonly string[], i: number): string {
  return (horarios[i] ?? '').trim()
}

/** Troca o valor do cliente i (sem deixar vazios sobrando no fim da lista). */
export function comValorNaParte(horarios: readonly string[], i: number, valor: string): string[] {
  const nova = [...horarios]
  while (nova.length <= i) nova.push('')
  nova[i] = valor.trim()
  while (nova.length && !nova.at(-1)) nova.pop()
  return nova
}

/** Quantas linhas cabem confortáveis; acima disso o quadro aperta. */
export function densidade(qtd: number): 'normal' | 'compacta' | 'apertada' {
  return qtd <= 13 ? 'normal' : qtd <= 18 ? 'compacta' : 'apertada'
}

export function nomeDaImagem(data: string): string {
  return `agenda-${data}.png`
}

/** Códigos dos veículos ativos que não têm Sem Parar (vão no cartão amarelo). */
export function veiculosSemSemParar(veiculos: readonly Veiculo[]): string[] {
  return veiculos
    .filter((v) => v.ativo && !v.tem_sem_parar)
    .map((v) => v.codigo)
    .sort(compararVeiculos)
}

/**
 * O que não bate com o cadastro numa linha: técnicos e veículo que não existem
 * (ou estão inativos). Com o cadastro vazio, não reclama de nada.
 */
export function conferirComCadastro(
  item: Pick<AgendaItem, 'tecnicos' | 'veiculo'>,
  tecnicos: readonly Tecnico[],
  veiculos: readonly Veiculo[],
) {
  const ativos = new Set(tecnicos.filter((t) => t.ativo).map((t) => t.numero))
  const carros = new Set(veiculos.filter((v) => v.ativo).map((v) => v.codigo))
  const veiculo = item.veiculo.trim().toUpperCase()
  return {
    tecnicosDesconhecidos: ativos.size ? item.tecnicos.filter((n) => !ativos.has(n)) : [],
    veiculoDesconhecido: carros.size > 0 && veiculo !== '' && !carros.has(veiculo),
  }
}

/** Número do código do veículo: "ON14" → 14 (sem número vai para o fim). */
function numeroDoVeiculo(codigo: string): number {
  const m = codigo.match(/\d+/)
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY
}

/** Veículos pela numeração do código: ON4, GO6, ON7, CM8, ON9, CM10... (empate: pelas letras). */
export function compararVeiculos(a: string, b: string): number {
  return numeroDoVeiculo(a) - numeroDoVeiculo(b) || a.localeCompare(b, 'pt-BR')
}

// -----------------------------------------------------------------------------
// Falta e folga
// -----------------------------------------------------------------------------

export type Ausencia = 'falta' | 'folga'

/** Quem faltou e quem está de folga no dia. */
export function ausentesDoDia(dia: Pick<AgendaDia, 'faltas' | 'folgas'>) {
  return { faltas: dia.faltas ?? [], folgas: dia.folgas ?? [] }
}

/**
 * A escala que vale no dia: sem quem está na falta ou na folga. (Eles continuam
 * gravados na escala para o dia seguinte começar com todo mundo.)
 */
export function escalasDoDia(
  escalas: readonly Escala[],
  dia: Pick<AgendaDia, 'faltas' | 'folgas'>,
): Escala[] {
  const { faltas, folgas } = ausentesDoDia(dia)
  const fora = new Set([...faltas, ...folgas])
  return escalas.map((e) => ({ ...e, tecnicos: e.tecnicos.filter((n) => !fora.has(n)) }))
}

/**
 * Põe os técnicos na falta ou na folga (e tira da outra lista, se estavam lá).
 * Devolve as duas listas novas.
 */
export function marcarAusencia(
  dia: Pick<AgendaDia, 'faltas' | 'folgas'>,
  tipo: Ausencia,
  tecnicos: readonly number[],
): { faltas: number[]; folgas: number[] } {
  const { faltas, folgas } = ausentesDoDia(dia)
  const novos = [...new Set(tecnicos)]
  const outra = (tipo === 'falta' ? folgas : faltas).filter((n) => !novos.includes(n))
  return tipo === 'falta' ? { faltas: novos, folgas: outra } : { faltas: outra, folgas: novos }
}

export type Presenca = {
  numero: number
  nome: string
  presencas: number
  faltas: number
  folgas: number
  /** Dias da agenda em que o técnico não estava em escala, falta nem folga. */
  semRegistro: number
  /** Datas de cada falta e folga, para conferir. */
  diasFalta: string[]
  diasFolga: string[]
}

/**
 * Contagem do mês por técnico, a partir dos dias que têm agenda:
 * presença = estava numa escala (e não faltou nem folgou).
 */
export function presencaDoMes(
  dias: readonly Pick<AgendaDia, 'data' | 'escalas' | 'faltas' | 'folgas'>[],
  tecnicos: readonly Pick<Tecnico, 'numero' | 'nome' | 'ativo'>[],
): Presenca[] {
  const por = new Map<number, Presenca>()
  const linha = (n: number) => {
    let p = por.get(n)
    if (!p) {
      const t = tecnicos.find((x) => x.numero === n)
      p = {
        numero: n,
        nome: t?.nome ?? '',
        presencas: 0,
        faltas: 0,
        folgas: 0,
        semRegistro: 0,
        diasFalta: [],
        diasFolga: [],
      }
      por.set(n, p)
    }
    return p
  }
  for (const t of tecnicos) if (t.ativo) linha(t.numero)

  const ordenados = [...dias].sort((a, b) => a.data.localeCompare(b.data))
  for (const d of ordenados) {
    const { faltas, folgas } = ausentesDoDia(d)
    const naEscala = new Set(lerEscalas(d.escalas).flatMap((e) => e.tecnicos))
    const vistos = new Set<number>()
    for (const n of faltas) {
      const p = linha(n)
      p.faltas++
      p.diasFalta.push(d.data)
      vistos.add(n)
    }
    for (const n of folgas) {
      if (vistos.has(n)) continue
      const p = linha(n)
      p.folgas++
      p.diasFolga.push(d.data)
      vistos.add(n)
    }
    for (const n of naEscala) {
      if (vistos.has(n)) continue
      linha(n).presencas++
      vistos.add(n)
    }
    for (const p of por.values()) if (!vistos.has(p.numero)) p.semRegistro++
  }
  return [...por.values()].sort((a, b) => a.numero - b.numero)
}
