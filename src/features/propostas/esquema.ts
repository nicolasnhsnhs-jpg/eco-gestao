import { z } from 'zod'

import { lerValor, paraCentavos } from '@/lib/dinheiro'

const inteiroOpcional = (min: number, max: number, mensagem: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && +v >= min && +v <= max), mensagem)

export const esquemaItem = z.object({
  tipo_servico_id: z.string(),
  descricao: z.string().trim().min(2, 'Descreva o serviço.'),
  quantidade: z
    .string()
    .trim()
    .refine((v) => Number(v.replace(',', '.')) > 0, 'Quantidade inválida.'),
  valor_unitario: z.string().refine((v) => lerValor(v) !== null, 'Informe o valor.'),
  periodicidade_meses: inteiroOpcional(1, 60, 'Entre 1 e 60 meses.'),
})

export const esquemaProposta = z
  .object({
    cliente_id: z.string().min(1, 'Escolha o cliente.'),
    cliente_nome: z.string(),
    endereco_id: z.string(),
    vendedor_id: z.string().min(1, 'Escolha o vendedor.'),
    data_envio: z.string().min(1, 'Informe a data.'),
    validade: z.string(),
    prazo_pagamento_dias: inteiroOpcional(0, 365, 'Entre 0 e 365 dias.'),
    condicao_pagamento: z.string().trim(),
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
  tipo_servico_id: '',
  descricao: '',
  quantidade: '1',
  valor_unitario: '',
  periodicidade_meses: '',
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
  return {
    dados: {
      cliente_id: f.cliente_id,
      endereco_id: ouNulo(f.endereco_id),
      vendedor_id: f.vendedor_id,
      data_envio: f.data_envio,
      validade: ouNulo(f.validade),
      prazo_pagamento_dias: f.prazo_pagamento_dias ? Number(f.prazo_pagamento_dias) : null,
      condicao_pagamento: ouNulo(f.condicao_pagamento),
      observacoes: ouNulo(f.observacoes),
    },
    itens: f.itens.map((i) => ({
      tipo_servico_id: ouNulo(i.tipo_servico_id),
      descricao: i.descricao.trim(),
      quantidade: quantidadeDe(i.quantidade),
      valor_unitario: lerValor(i.valor_unitario)!,
      periodicidade_meses: i.periodicidade_meses ? Number(i.periodicidade_meses) : null,
    })),
  }
}
