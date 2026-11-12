import { formatarCep, formatarDocumento, formatarTelefone } from '@/lib/documentos'
import { formatarData } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'

import {
  assuntoDosItens,
  introducaoPadrao,
  juntarLinhas,
  juntarMetodologias,
  nomeFrequencia,
  sufixoCobranca,
  textoAtendimento,
  textoPagamento,
  tituloComFrequencia,
  valorComExtenso,
} from '../modelos'

/*
 * Junta a proposta (do formulário, para a prévia, ou do banco, para o PDF final),
 * o cliente e o vendedor no que o PDF precisa. Não desenha nada: dá para testar.
 */

export type ItemBase = {
  modelo: string | null
  titulo: string | null
  escopo: string | null
  metodologia: string | null
  recursos: string | null
  descricao: string
  quantidade: number
  valor_unitario: number
  periodicidade_meses: number | null
  /** "semanal" / "quinzenal" (aí periodicidade_meses fica vazio). */
  frequencia: string | null
  cobranca: string | null
  /** Ex.: "Adicional para trabalho ao domingo". Somam uma vez no valor do serviço. */
  taxas_adicionais?: TaxaBase[]
}

export type TaxaBase = { descricao: string; valor: number }

export type PropostaBase = {
  numero?: string | null
  /** Contrato: valor anual (vazio = soma dos serviços) pago em parcelas mensais. */
  tipo?: 'avulsa' | 'contrato' | string | null
  contrato_valor_anual?: number | null
  contrato_parcelas?: number | null
  data_envio: string
  validade: string | null
  contato_nome: string | null
  contato_telefone: string | null
  contato_email: string | null
  introducao: string | null
  acrescimo_fora_horario: number | null
  custos_detalhados: boolean
  prazo_pagamento_dias: number | null
  condicao_pagamento: string | null
  observacoes: string | null
  itens: ItemBase[]
}

type EnderecoBase = {
  id: string
  logradouro: string
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string
  uf: string
  cep: string | null
  razao_social: string | null
  cnpj: string | null
  principal: boolean
}

export type ClienteBase = {
  nome: string
  nome_fantasia: string | null
  cpf_cnpj: string | null
  tipo_pessoa: string
  email: string | null
  telefone: string | null
  enderecos?: EnderecoBase[] | null
}

export type VendedorBase = { nome: string; telefone: string | null; email: string | null }

export type LinhaCusto = { tipo: 'linha' | 'paragrafo' | 'marcador' | 'espaco'; texto: string }

export type DadosPdfProposta = {
  numero: string | null
  rascunho: boolean
  data: string
  cliente: { nome: string; linhas: string[] }
  introducao: string
  itens: { titulo: string; escopo: string }[]
  metodologia: string[]
  recursos: string[]
  custos: LinhaCusto[]
  vendedor: VendedorBase
}

const centavos = (v: number) => Math.round(v * 100)
/** Só quantidade × valor, sem as taxas. */
const valorBase = (i: ItemBase) => centavos(i.quantidade * i.valor_unitario) / 100
/** Valor do serviço com as taxas adicionais. */
const valorItem = (i: ItemBase) =>
  (centavos(i.quantidade * i.valor_unitario) +
    (i.taxas_adicionais ?? []).reduce((s, t) => s + centavos(t.valor), 0)) /
  100

export function montarDadosPdf(
  p: PropostaBase,
  cliente: ClienteBase | null | undefined,
  enderecoId: string | null | undefined,
  vendedor: VendedorBase | null | undefined,
): DadosPdfProposta {
  // ---- Cliente ----
  const enderecos = cliente?.enderecos ?? []
  const end =
    enderecos.find((e) => e.id === enderecoId) ??
    enderecos.find((e) => e.principal) ??
    enderecos[0] ??
    null
  const nome = end?.razao_social?.trim() || cliente?.nome || 'Cliente'
  const doc = end?.cnpj || cliente?.cpf_cnpj
  const tipoDoc = (doc ?? '').length === 11 ? 'PF' : 'PJ'
  const linhas: string[] = []
  if (doc) linhas.push(`${tipoDoc === 'PF' ? 'CPF' : 'CNPJ'}: ${formatarDocumento(doc, tipoDoc)}`)
  if (end) {
    const rua = [`${end.logradouro}, ${end.numero || 's/n'}`, end.complemento]
      .filter(Boolean)
      .join(' ')
    linhas.push(`Endereço: ${[rua, end.bairro].filter(Boolean).join(' - ')}`)
    linhas.push(
      `Município: ${end.cidade}/${end.uf}${end.cep ? ` - CEP ${formatarCep(end.cep)}` : ''}`,
    )
  }
  if (p.contato_nome?.trim()) linhas.push(`A/C: ${p.contato_nome.trim()}`)
  const fone = p.contato_telefone?.trim() || formatarTelefone(cliente?.telefone)
  if (fone) linhas.push(`Fone: ${fone}`)
  const email = p.contato_email?.trim() || cliente?.email
  if (email) linhas.push(`E-mail: ${email}`)

  // ---- Seções ----
  const itens = p.itens.map((i) => {
    const novo = !!i.modelo
    const base = i.titulo?.trim() || i.descricao
    return {
      titulo: novo ? tituloComFrequencia(base, i.frequencia ?? i.periodicidade_meses) : base,
      escopo: i.escopo ?? '',
    }
  })
  const metodologia = juntarMetodologias(p.itens.map((i) => i.metodologia))
  const recursos = juntarLinhas(p.itens.map((i) => i.recursos)).map((l) =>
    l.replace(/^[-•]\s*/, ''),
  )

  // ---- Custos ----
  const custos: LinhaCusto[] = []
  const total = p.itens.reduce((s, i) => s + centavos(valorItem(i)), 0) / 100
  const cobrancas = new Set(p.itens.map((i) => i.cobranca || 'unica'))
  const sufixoTotal = cobrancas.size === 1 ? sufixoCobranca([...cobrancas][0]) : ''
  const variosItens = p.itens.length > 1
  const comTaxas = p.itens.some((i) => (i.taxas_adicionais ?? []).length > 0)
  const contrato = p.tipo === 'contrato'
  if (contrato) {
    custos.push(...custosDoContrato(p))
  } else if (p.custos_detalhados && (variosItens || comTaxas)) {
    custos.push({ tipo: 'linha', texto: '**Valor dos serviços conforme segue abaixo:**' })
    for (const i of p.itens) {
      const qtd =
        i.quantidade !== 1
          ? ` (${i.quantidade.toLocaleString('pt-BR')} × ${formatarReais(i.valor_unitario)})`
          : ''
      custos.push({
        tipo: 'marcador',
        texto: `${i.descricao}${qtd} - **${formatarReais(valorBase(i))}${sufixoCobranca(i.cobranca)}**`,
      })
      for (const t of i.taxas_adicionais ?? []) {
        custos.push({
          tipo: 'marcador',
          texto: `${t.descricao} - **${formatarReais(t.valor)}${sufixoCobranca(i.cobranca)}**`,
        })
      }
    }
    if (cobrancas.size === 1) {
      custos.push({ tipo: 'espaco', texto: '' })
      custos.push({
        tipo: 'linha',
        texto: `Valor total: **${valorComExtenso(total)}${sufixoTotal}**.`,
      })
    }
  } else {
    const rotulo = variosItens
      ? 'Valor total para execução dos serviços'
      : `Valor para ${minusculaInicial(p.itens[0]?.descricao || 'o serviço')}`
    const qtd =
      !variosItens && !comTaxas && p.itens[0] && p.itens[0].quantidade !== 1
        ? ` (${p.itens[0].quantidade.toLocaleString('pt-BR')} × ${formatarReais(p.itens[0].valor_unitario)})`
        : ''
    custos.push({ tipo: 'linha', texto: `${rotulo}${qtd}:` })
    custos.push({ tipo: 'linha', texto: `**${valorComExtenso(total)}${sufixoTotal}**.` })
  }
  if (!contrato) {
    custos.push({ tipo: 'espaco', texto: '' })
    custos.push({
      tipo: 'linha',
      texto: `Forma de pagamento: ${textoPagamento(p.prazo_pagamento_dias, p.condicao_pagamento)}.`,
    })
  }
  if (p.observacoes?.trim()) {
    custos.push({ tipo: 'espaco', texto: '' })
    for (const l of p.observacoes.split('\n').filter((x) => x.trim())) {
      custos.push({ tipo: 'paragrafo', texto: l.trim() })
    }
  }
  custos.push({ tipo: 'espaco', texto: '' })
  custos.push({ tipo: 'paragrafo', texto: textoAtendimento(p.acrescimo_fora_horario) })
  if (p.validade) {
    custos.push({ tipo: 'espaco', texto: '' })
    custos.push({ tipo: 'linha', texto: `Proposta válida até **${formatarData(p.validade)}**.` })
  }

  const nomeApresentacao = cliente?.nome_fantasia?.trim() || nome
  return {
    numero: p.numero || null,
    rascunho: !p.numero,
    data: p.data_envio,
    cliente: { nome, linhas },
    introducao:
      p.introducao?.trim() || introducaoPadrao(nomeApresentacao, assuntoDosItens(p.itens)),
    itens,
    metodologia,
    recursos,
    custos,
    vendedor: vendedor ?? { nome: '', telefone: null, email: null },
  }
}

/** Quantas vezes o serviço acontece no ano, pela frequência (avulso = 1). */
function vezesNoAno(i: ItemBase) {
  if (i.frequencia === 'semanal') return 52
  if (i.frequencia === 'quinzenal') return 26
  return i.periodicidade_meses ? Math.max(1, Math.round(12 / i.periodicidade_meses)) : 1
}

/**
 * Valor anual estimado pelos serviços: cobrança por mês × 12; por visita ou valor
 * do serviço × vezes no ano. É o que vale quando o valor anual fica em branco.
 */
export function valorAnualDosItens(itens: ItemBase[]) {
  return (
    itens.reduce((s, i) => {
      const vezes = i.cobranca === 'mensal' ? 12 : vezesNoAno(i)
      return s + centavos(valorItem(i)) * vezes
    }, 0) / 100
  )
}

/** Valor anual do contrato e das parcelas (em reais, a parcela arredondada nos centavos). */
export function valoresDoContrato(p: PropostaBase) {
  const anual = p.contrato_valor_anual ?? valorAnualDosItens(p.itens)
  const parcelas = p.contrato_parcelas && p.contrato_parcelas > 0 ? p.contrato_parcelas : 12
  return { anual, parcelas, parcela: Math.round((anual * 100) / parcelas) / 100 }
}

/**
 * Custos da proposta de contrato:
 *   Valor anual do contrato: R$ 6.000,00 (...), contemplando:
 *   • Limpeza de reservatórios - semestral
 *   Forma de pagamento: 12 parcelas mensais de R$ 500,00 (...), boleto bancário.
 */
function custosDoContrato(p: PropostaBase): LinhaCusto[] {
  const { anual, parcelas, parcela } = valoresDoContrato(p)
  const linhas: LinhaCusto[] = [
    {
      tipo: 'linha',
      texto: `Valor anual do contrato: **${valorComExtenso(anual)}**, contemplando:`,
    },
  ]
  for (const i of p.itens) {
    const freq = i.frequencia ?? i.periodicidade_meses
    const textoFreq = freq ? ` - ${minusculaInicial(nomeFrequencia(freq))}` : ''
    const valor = p.custos_detalhados
      ? ` - **${formatarReais(valorItem(i))}${sufixoCobranca(i.cobranca)}**`
      : ''
    linhas.push({ tipo: 'marcador', texto: `${i.descricao}${textoFreq}${valor}` })
  }
  const condicao = p.condicao_pagamento?.trim() || 'boleto bancário'
  const comoPaga =
    parcelas === 1
      ? `pagamento único de **${valorComExtenso(parcela)}**`
      : `**${parcelas} parcelas mensais de ${valorComExtenso(parcela)}**`
  linhas.push({ tipo: 'espaco', texto: '' })
  linhas.push({ tipo: 'linha', texto: `Forma de pagamento: ${comoPaga}, ${condicao}.` })
  return linhas
}

const minusculaInicial = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
