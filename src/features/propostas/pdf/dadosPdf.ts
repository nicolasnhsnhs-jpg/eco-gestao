import { formatarCep, formatarDocumento, formatarTelefone } from '@/lib/documentos'
import { formatarData } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'

import {
  assuntoDosItens,
  introducaoPadrao,
  juntarLinhas,
  juntarMetodologias,
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
  cobranca: string | null
}

export type PropostaBase = {
  numero?: string | null
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

const valorItem = (i: ItemBase) => Math.round(i.quantidade * i.valor_unitario * 100) / 100

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
      titulo: novo ? tituloComFrequencia(base, i.periodicidade_meses) : base,
      escopo: i.escopo ?? '',
    }
  })
  const metodologia = juntarMetodologias(p.itens.map((i) => i.metodologia))
  const recursos = juntarLinhas(p.itens.map((i) => i.recursos)).map((l) =>
    l.replace(/^[-•]\s*/, ''),
  )

  // ---- Custos ----
  const custos: LinhaCusto[] = []
  const total = p.itens.reduce((s, i) => s + valorItem(i), 0)
  const cobrancas = new Set(p.itens.map((i) => i.cobranca || 'unica'))
  const sufixoTotal = cobrancas.size === 1 ? sufixoCobranca([...cobrancas][0]) : ''
  const variosItens = p.itens.length > 1
  if (p.custos_detalhados && variosItens) {
    custos.push({ tipo: 'linha', texto: '**Valor dos serviços conforme segue abaixo:**' })
    for (const i of p.itens) {
      const qtd =
        i.quantidade !== 1
          ? ` (${i.quantidade.toLocaleString('pt-BR')} × ${formatarReais(i.valor_unitario)})`
          : ''
      custos.push({
        tipo: 'marcador',
        texto: `${i.descricao}${qtd} - **${formatarReais(valorItem(i))}${sufixoCobranca(i.cobranca)}**`,
      })
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
      !variosItens && p.itens[0] && p.itens[0].quantidade !== 1
        ? ` (${p.itens[0].quantidade.toLocaleString('pt-BR')} × ${formatarReais(p.itens[0].valor_unitario)})`
        : ''
    custos.push({ tipo: 'linha', texto: `${rotulo}${qtd}:` })
    custos.push({ tipo: 'linha', texto: `**${valorComExtenso(total)}${sufixoTotal}**.` })
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

const minusculaInicial = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
