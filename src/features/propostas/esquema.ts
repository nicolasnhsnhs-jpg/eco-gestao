import { z } from 'zod'

import { lerValor, paraCentavos } from '@/lib/dinheiro'

import type { PropostaBase } from './pdf/dadosPdf'

const inteiroOpcional = (min: number, max: number, mensagem: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && +v >= min && +v <= max), mensagem)

const textoAte = (max: number) => z.string().max(max, `Até ${max} caracteres.`)

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
  periodicidade_meses: inteiroOpcional(1, 60, 'Entre 1 e 60 meses.'),
  cobranca: z.enum(['unica', 'mensal', 'por_visita']),
})

export const esquemaProposta = z
  .object({
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
}

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())

export function quantidadeDe(texto: string): number {
  return Number(texto.replace(',', '.')) || 0
}

/** Total em reais, somando em centavos para não errar o arredondamento. */
export function totalDosItens(itens: Pick<FormItem, 'quantidade' | 'valor_unitario'>[]): number {
  const centavos = itens.reduce(
    (soma, i) =>
      soma + Math.round(quantidadeDe(i.quantidade) * paraCentavos(lerValor(i.valor_unitario) ?? 0)),
    0,
  )
  return centavos / 100
}

export function propostaParaBanco(f: FormProposta) {
  const acrescimo = f.acrescimo_fora_horario.trim() ? lerValor(f.acrescimo_fora_horario) : null
  return {
    dados: {
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
      periodicidade_meses: i.periodicidade_meses ? Number(i.periodicidade_meses) : null,
      cobranca: i.cobranca,
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
      periodicidade_meses: i.periodicidade_meses ? Number(i.periodicidade_meses) : null,
      cobranca: i.cobranca ?? 'unica',
    })),
  }
}
