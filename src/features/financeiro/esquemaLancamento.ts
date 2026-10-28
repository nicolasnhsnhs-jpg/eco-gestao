import { z } from 'zod'

import { lerValor } from '@/lib/dinheiro'

import { FORMAS, type FormaPagamento } from './rotulos'

/** Regras do formulário de lançamento. */
export const esquemaLancamento = z
  .object({
    tipo: z.enum(['entrada', 'saida']),
    descricao: z.string().trim().min(2, 'Descreva o lançamento.'),
    cliente_id: z.string(),
    cliente_nome: z.string(),
    fornecedor_id: z.string(),
    categoria_id: z.string().min(1, 'Escolha a categoria.'),
    valor: z.string().refine((v) => (lerValor(v) ?? 0) > 0, 'Informe o valor.'),
    vencimento: z.string().min(1, 'Informe o vencimento.'),
    competencia: z.string().min(1, 'Informe o mês de competência.'),
    status: z.enum(['pendente', 'agendado', 'realizado', 'cancelado']),
    data_pagamento: z.string(),
    conta_bancaria_id: z.string(),
    forma_pagamento: z.union([
      z.enum(FORMAS.map((f) => f.valor) as [FormaPagamento, ...FormaPagamento[]]),
      z.literal(''),
    ]),
    numero_nota_fiscal: z.string().trim(),
    parcelas: z.number().int('Use um número inteiro.').min(1).max(60, 'No máximo 60 parcelas.'),
    observacoes: z.string().trim(),
    /** Serviço que originou a conta a receber (vazio = nenhum). */
    servico_id: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.status !== 'realizado') return
    if (!d.data_pagamento) {
      ctx.addIssue({ code: 'custom', path: ['data_pagamento'], message: 'Informe a data.' })
    }
    if (!d.conta_bancaria_id) {
      ctx.addIssue({ code: 'custom', path: ['conta_bancaria_id'], message: 'Escolha a conta.' })
    }
    if (d.parcelas > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['parcelas'],
        message: 'Parcelas são lançadas em aberto; confirme cada uma quando entrar.',
      })
    }
  })

export type FormLancamento = z.infer<typeof esquemaLancamento>

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())

/** Converte o formulário para o formato do banco (sem as parcelas). */
export function lancamentoParaBanco(f: FormLancamento) {
  const realizado = f.status === 'realizado'
  return {
    tipo: f.tipo,
    descricao: f.descricao.trim(),
    cliente_id: f.tipo === 'entrada' ? ouNulo(f.cliente_id) : null,
    fornecedor_id: f.tipo === 'saida' ? ouNulo(f.fornecedor_id) : null,
    categoria_id: f.categoria_id,
    valor: lerValor(f.valor)!,
    vencimento: f.vencimento,
    competencia: `${f.competencia}-01`,
    status: f.status,
    data_pagamento: realizado ? f.data_pagamento : null,
    valor_pago: realizado ? lerValor(f.valor)! : null,
    conta_bancaria_id: ouNulo(f.conta_bancaria_id),
    forma_pagamento: f.forma_pagamento || null,
    numero_nota_fiscal: ouNulo(f.numero_nota_fiscal),
    observacoes: ouNulo(f.observacoes),
    servico_id: ouNulo(f.servico_id),
  }
}
