import { formatarCep, formatarDocumento, formatarTelefone } from '@/lib/documentos'
import { formatarData } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'

import {
  introducaoContrato,
  preencherMarcas,
  secoesFixas,
  textoContratoPadrao,
  textoInvestimento,
  textoTaxaContrato,
} from '../contratual'
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
  /** Texto do serviço no contrato completo (vazio = texto padrão do modelo). */
  texto_contrato?: string | null
}

export type TaxaBase = { descricao: string; valor: number }

export type PropostaBase = {
  numero?: string | null
  /** Contrato: valor anual (vazio = soma dos serviços) pago em parcelas mensais. */
  tipo?: 'avulsa' | 'contrato' | string | null
  contrato_valor_anual?: number | null
  contrato_parcelas?: number | null
  /** Contrato "completo" = memorial descritivo no molde das propostas contratuais. */
  contrato_modelo?: 'tradicional' | 'completo' | string | null
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

export type LinhaCusto = {
  /** "destaque" sai centralizado, como os valores do investimento no contrato completo. */
  tipo: 'linha' | 'paragrafo' | 'marcador' | 'espaco' | 'destaque'
  texto: string
}

export type DadosPdfProposta = {
  numero: string | null
  /** "PROPOSTA Nº" ou "MEMORIAL DESCRITIVO Nº". */
  rotuloNumero: string
  /** Título da última seção: "Custos" ou "Investimento". */
  tituloCustos: string
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

  const nomeApresentacao = cliente?.nome_fantasia?.trim() || nome
  const comum = {
    numero: p.numero || null,
    rascunho: !p.numero,
    data: p.data_envio,
    cliente: { nome, linhas },
    vendedor: vendedor ?? { nome: '', telefone: null, email: null },
  }
  if (p.tipo === 'contrato' && p.contrato_modelo === 'completo') {
    return { ...comum, ...memorialDescritivo(p, nomeApresentacao) }
  }

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

  return {
    ...comum,
    rotuloNumero: 'PROPOSTA Nº',
    tituloCustos: 'Custos',
    introducao:
      p.introducao?.trim() || introducaoPadrao(nomeApresentacao, assuntoDosItens(p.itens)),
    itens,
    metodologia,
    recursos,
    custos,
  }
}

const freqDe = (i: ItemBase) => i.frequencia ?? i.periodicidade_meses

/**
 * Proposta contratual completa: uma seção por serviço com o texto técnico dele,
 * as seções fixas (atendimento, corpo técnico...) e o investimento mensal.
 */
function memorialDescritivo(p: PropostaBase, cliente: string) {
  const itens = p.itens.map((i) => {
    const base = i.titulo?.trim() || i.descricao
    const texto = i.texto_contrato?.trim() || textoContratoPadrao(i.modelo, i.metodologia)
    return {
      titulo: freqDe(i) ? tituloComFrequencia(base, freqDe(i)) : base,
      escopo: preencherMarcas(texto, { cliente, escopo: i.escopo ?? '', frequencia: freqDe(i) }),
    }
  })
  itens.push(...secoesFixas(p.itens, cliente))

  const custos: LinhaCusto[] = []
  const meses = p.contrato_parcelas && p.contrato_parcelas > 0 ? p.contrato_parcelas : 12
  custos.push({ tipo: 'paragrafo', texto: textoInvestimento(meses) })
  custos.push({ tipo: 'espaco', texto: '' })

  const cobrancas = new Set(p.itens.map((i) => i.cobranca || 'unica'))
  const todosMensais = cobrancas.size === 1 && cobrancas.has('mensal')
  const total = p.itens.reduce((s, i) => s + centavos(valorItem(i)), 0) / 100
  const nomeServico = (i: ItemBase) => {
    const f = freqDe(i)
    return `${minusculaInicial(i.descricao)}${f ? ` / ${minusculaInicial(nomeFrequencia(f))}` : ''}`
  }
  const valorCom = (v: number, cobranca: string | null) =>
    `${valorComExtenso(v)}${
      cobranca === 'mensal'
        ? ', mensais'
        : cobranca === 'por_visita'
          ? ', por visita'
          : ', por execução'
    }.`

  if (!p.custos_detalhados && todosMensais && p.itens.length > 1) {
    custos.push({
      tipo: 'destaque',
      texto: `**Valor total mensal dos serviços de ${juntarComE(p.itens.map(nomeServico))}:**`,
    })
    custos.push({ tipo: 'destaque', texto: valorCom(total, 'mensal') })
  } else {
    for (const i of p.itens) {
      const rotulo =
        i.cobranca === 'mensal'
          ? 'Valor mensal dos serviços de'
          : i.cobranca === 'por_visita'
            ? 'Valor por visita dos serviços de'
            : 'Valor dos serviços de'
      custos.push({ tipo: 'destaque', texto: `**${rotulo} ${nomeServico(i)}:**` })
      custos.push({ tipo: 'destaque', texto: valorCom(valorBase(i), i.cobranca) })
      for (const t of i.taxas_adicionais ?? []) {
        custos.push({ tipo: 'destaque', texto: `${t.descricao}: ${valorCom(t.valor, i.cobranca)}` })
      }
    }
    if (todosMensais && p.itens.length > 1) {
      custos.push({ tipo: 'espaco', texto: '' })
      custos.push({
        tipo: 'destaque',
        texto: `**Totalizando o valor mensal de ${formatarReais(total)}.**`,
      })
    }
  }
  custos.push({ tipo: 'espaco', texto: '' })
  custos.push({
    tipo: 'linha',
    texto: `Forma de pagamento: ${textoPagamento(p.prazo_pagamento_dias, p.condicao_pagamento)}.`,
  })
  if (p.observacoes?.trim()) {
    custos.push({ tipo: 'espaco', texto: '' })
    for (const l of p.observacoes.split('\n').filter((x) => x.trim())) {
      custos.push({ tipo: 'paragrafo', texto: l.trim() })
    }
  }
  if (p.acrescimo_fora_horario != null) {
    custos.push({ tipo: 'espaco', texto: '' })
    custos.push({ tipo: 'paragrafo', texto: textoTaxaContrato(p.acrescimo_fora_horario) })
  }
  custos.push({ tipo: 'espaco', texto: '' })
  custos.push({ tipo: 'linha', texto: 'Prazo de entrega: **imediato**.' })
  if (p.validade) {
    custos.push({ tipo: 'linha', texto: `Proposta válida até **${formatarData(p.validade)}**.` })
  }

  return {
    rotuloNumero: 'MEMORIAL DESCRITIVO Nº',
    tituloCustos: 'Investimento',
    introducao: p.introducao?.trim() || introducaoContrato(cliente),
    itens,
    metodologia: [],
    recursos: [],
    custos,
  }
}

const juntarComE = (l: string[]) =>
  l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`

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
