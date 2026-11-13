import { z } from 'zod'

import { lerValor, paraCentavos } from '@/lib/dinheiro'

import { ehCartao, ehFrequenciaCurta, separarFrequencia } from './modelos'
import type { PropostaBase } from './pdf/dadosPdf'

const inteiroOpcional = (min: number, max: number, mensagem: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && +v >= min && +v <= max), mensagem)

const textoAte = (max: number) => z.string().max(max, `Até ${max} caracteres.`)

/** Taxa adicional de um serviço. Ex.: "Adicional para trabalho ao domingo". */
export const esquemaTaxa = z.object({
  descricao: z.string().trim().min(2, 'Escreva o que é a taxa.').max(200, 'Até 200 caracteres.'),
  valor: z.string().refine((v) => (lerValor(v) ?? 0) > 0, 'Informe o valor.'),
})

export const esquemaItem = z.object({
  modelo: z.string(),
  tipo_servico_id: z.string(),
  titulo: textoAte(200),
  escopo: textoAte(4000),
  metodologia: textoAte(4000),
  recursos: textoAte(4000),
  descricao: z.string().trim().min(2, 'Descreva o serviço.').max(300, 'Até 300 caracteres.'),
  quantidade: z
    .string()
    .trim()
    .refine((v) => Number(v.replace(',', '.')) > 0, 'Quantidade inválida.'),
  valor_unitario: z.string().refine((v) => lerValor(v) !== null, 'Informe o valor.'),
  /** Meses (1 a 60) ou "semanal"/"quinzenal"; vazio = avulso. */
  periodicidade_meses: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || ehFrequenciaCurta(v) || (/^\d+$/.test(v) && +v >= 1 && +v <= 60),
      'Entre 1 e 60 meses.',
    ),
  cobranca: z.enum(['unica', 'mensal', 'por_visita']),
  taxas_adicionais: z.array(esquemaTaxa),
  /** Texto do serviço no contrato completo (vazio = padrão do modelo). */
  texto_contrato: textoAte(12000),
})

export const esquemaProposta = z
  .object({
    /** Serviço avulso ou contrato (valor anual pago em parcelas mensais). */
    tipo: z.enum(['avulsa', 'contrato']),
    contrato_valor_anual: z
      .string()
      .refine((v) => v.trim() === '' || lerValor(v) !== null, 'Valor inválido.'),
    contrato_parcelas: inteiroOpcional(1, 60, 'Entre 1 e 60 meses.'),
    /** Contrato tradicional (valor anual + parcelas) ou completo (memorial descritivo). */
    contrato_modelo: z.enum(['tradicional', 'completo']),
    cliente_id: z.string().min(1, 'Escolha o cliente.'),
    cliente_nome: z.string(),
    endereco_id: z.string(),
    vendedor_id: z.string().min(1, 'Escolha o vendedor.'),
    data_envio: z.string().min(1, 'Informe a data.'),
    validade: z.string(),
    contato_nome: textoAte(120),
    contato_telefone: textoAte(120),
    contato_email: textoAte(300),
    introducao: textoAte(2000),
    prazo_pagamento_dias: inteiroOpcional(0, 365, 'Entre 0 e 365 dias.'),
    condicao_pagamento: z.string().trim(),
    /** Cartão de crédito: em quantas vezes e se tem juros. */
    cartao_parcelas: inteiroOpcional(1, 24, 'Entre 1 e 24 vezes.'),
    cartao_juros: z.boolean(),
    /** Pagamento vira o padrão das próximas propostas do cliente. */
    pagamento_fixo: z.boolean(),
    acrescimo_fora_horario: z
      .string()
      .refine((v) => v.trim() === '' || lerValor(v) !== null, 'Valor inválido.'),
    custos_detalhados: z.boolean(),
    observacoes: z.string().trim(),
    itens: z.array(esquemaItem).min(1, 'Adicione pelo menos um serviço.'),
  })
  .refine((d) => !d.validade || d.validade >= d.data_envio, {
    path: ['validade'],
    message: 'A validade não pode ser antes do envio.',
  })

export type FormProposta = z.infer<typeof esquemaProposta>
export type FormItem = z.infer<typeof esquemaItem>
export type FormTaxa = z.infer<typeof esquemaTaxa>

export const TAXA_VAZIA: FormTaxa = { descricao: '', valor: '' }

export const ITEM_VAZIO: FormItem = {
  modelo: '',
  tipo_servico_id: '',
  titulo: '',
  escopo: '',
  metodologia: '',
  recursos: '',
  descricao: '',
  quantidade: '1',
  valor_unitario: '',
  periodicidade_meses: '',
  cobranca: 'unica',
  taxas_adicionais: [],
  texto_contrato: '',
}

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())

/** Campos do contrato: só valem na proposta de contrato. */
function camposContrato(f: Partial<FormProposta>) {
  const contrato = f.tipo === 'contrato'
  const anual = f.contrato_valor_anual?.trim() ? lerValor(f.contrato_valor_anual) : null
  return {
    tipo: contrato ? ('contrato' as const) : ('avulsa' as const),
    contrato_valor_anual: contrato ? anual : null,
    contrato_parcelas: contrato ? Number(f.contrato_parcelas) || 12 : null,
    contrato_modelo: contrato ? (f.contrato_modelo ?? 'tradicional') : null,
  }
}

export function quantidadeDe(texto: string): number {
  return Number(texto.replace(',', '.')) || 0
}

type ItemParaTotal = Pick<FormItem, 'quantidade' | 'valor_unitario'> & {
  taxas_adicionais?: Partial<FormTaxa>[]
}

/** Valor de um serviço em centavos: quantidade × valor + taxas adicionais. */
function centavosDoItem(i: ItemParaTotal): number {
  const taxas = (i.taxas_adicionais ?? []).reduce(
    (s, t) => s + paraCentavos(lerValor(t.valor ?? '') ?? 0),
    0,
  )
  return (
    Math.round(
      quantidadeDe(i.quantidade ?? '') * paraCentavos(lerValor(i.valor_unitario ?? '') ?? 0),
    ) + taxas
  )
}

/** Valor de um serviço (com as taxas adicionais), em reais. */
export function totalDoItem(i: ItemParaTotal): number {
  return centavosDoItem(i) / 100
}

/** Total em reais, somando em centavos para não errar o arredondamento. */
export function totalDosItens(itens: ItemParaTotal[]): number {
  return itens.reduce((soma, i) => soma + centavosDoItem(i), 0) / 100
}

const taxasParaBase = (taxas: Partial<FormTaxa>[] | undefined) =>
  (taxas ?? [])
    .map((t) => ({ descricao: (t.descricao ?? '').trim(), valor: lerValor(t.valor ?? '') ?? 0 }))
    .filter((t) => t.descricao || t.valor)

/** Parcelas e juros só valem quando a forma de pagamento é cartão. */
export function camposCartao(condicao: string, parcelas: string, juros: boolean) {
  if (!ehCartao(condicao) || !parcelas.trim()) return { cartao_parcelas: null, cartao_juros: null }
  const n = Number(parcelas)
  return { cartao_parcelas: n, cartao_juros: n > 1 ? juros : null }
}

export function propostaParaBanco(f: FormProposta) {
  const acrescimo = f.acrescimo_fora_horario.trim() ? lerValor(f.acrescimo_fora_horario) : null
  return {
    dados: {
      ...camposContrato(f),
      cliente_id: f.cliente_id,
      endereco_id: ouNulo(f.endereco_id),
      vendedor_id: f.vendedor_id,
      data_envio: f.data_envio,
      validade: ouNulo(f.validade),
      contato_nome: ouNulo(f.contato_nome),
      contato_telefone: ouNulo(f.contato_telefone),
      contato_email: ouNulo(f.contato_email),
      introducao: ouNulo(f.introducao),
      prazo_pagamento_dias: f.prazo_pagamento_dias ? Number(f.prazo_pagamento_dias) : null,
      condicao_pagamento: ouNulo(f.condicao_pagamento),
      ...camposCartao(f.condicao_pagamento, f.cartao_parcelas, f.cartao_juros),
      pagamento_fixo: f.pagamento_fixo,
      acrescimo_fora_horario: acrescimo,
      custos_detalhados: f.custos_detalhados,
      observacoes: ouNulo(f.observacoes),
    },
    itens: f.itens.map((i) => ({
      modelo: ouNulo(i.modelo),
      tipo_servico_id: ouNulo(i.tipo_servico_id),
      titulo: ouNulo(i.titulo),
      escopo: ouNulo(i.escopo),
      metodologia: ouNulo(i.metodologia),
      recursos: ouNulo(i.recursos),
      descricao: i.descricao.trim(),
      quantidade: quantidadeDe(i.quantidade),
      valor_unitario: lerValor(i.valor_unitario)!,
      ...separarFrequencia(i.periodicidade_meses),
      cobranca: i.cobranca,
      taxas_adicionais: taxasParaBase(i.taxas_adicionais),
      texto_contrato: ouNulo(i.texto_contrato),
    })),
  }
}

/**
 * O que está no formulário, do jeito que o PDF usa (para a prévia). Tolera campos
 * ainda incompletos: valor vazio conta como zero.
 */
export function formParaBase(f: FormProposta, numero?: string | null): PropostaBase {
  const acrescimo = f.acrescimo_fora_horario?.trim() ? lerValor(f.acrescimo_fora_horario) : null
  return {
    numero: numero ?? null,
    ...camposContrato(f),
    data_envio: f.data_envio || new Date().toISOString().slice(0, 10),
    validade: ouNulo(f.validade ?? ''),
    contato_nome: ouNulo(f.contato_nome ?? ''),
    contato_telefone: ouNulo(f.contato_telefone ?? ''),
    contato_email: ouNulo(f.contato_email ?? ''),
    introducao: ouNulo(f.introducao ?? ''),
    acrescimo_fora_horario: acrescimo,
    custos_detalhados: f.custos_detalhados ?? true,
    prazo_pagamento_dias: f.prazo_pagamento_dias ? Number(f.prazo_pagamento_dias) : null,
    condicao_pagamento: ouNulo(f.condicao_pagamento ?? ''),
    ...camposCartao(f.condicao_pagamento ?? '', f.cartao_parcelas ?? '', f.cartao_juros ?? false),
    observacoes: ouNulo(f.observacoes ?? ''),
    itens: (f.itens ?? []).map((i) => ({
      modelo: ouNulo(i.modelo ?? ''),
      titulo: ouNulo(i.titulo ?? ''),
      escopo: ouNulo(i.escopo ?? ''),
      metodologia: ouNulo(i.metodologia ?? ''),
      recursos: ouNulo(i.recursos ?? ''),
      descricao: i.descricao?.trim() || 'Serviço',
      quantidade: quantidadeDe(i.quantidade ?? '1') || 1,
      valor_unitario: lerValor(i.valor_unitario ?? '') ?? 0,
      ...separarFrequencia(i.periodicidade_meses),
      cobranca: i.cobranca ?? 'unica',
      texto_contrato: ouNulo(i.texto_contrato ?? ''),
      taxas_adicionais: taxasParaBase(i.taxas_adicionais).map((t) => ({
        descricao: t.descricao || 'Taxa adicional',
        valor: t.valor,
      })),
    })),
  }
}
