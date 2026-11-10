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
 */
export function partesDaDescricao(descricao: string): [string, string][] {
  return descricao
    .split(/\s+\/\s+(?=[^/]*:)/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(':')
      return i < 0 ? [p, ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    })
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

/** Texto do selo da estrela. */
export function textoHorarioCliente(chegada: string): string {
  const h = chegada.trim()
  return h ? `Chegar ${/^às\s/i.test(h) ? h : `às ${h}`} · ver OS` : 'Horário do cliente · ver OS'
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
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
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
