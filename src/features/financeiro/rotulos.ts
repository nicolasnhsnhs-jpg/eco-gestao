import type { Database } from '@/lib/database.types'

type Enums = Database['public']['Enums']
export type FormaPagamento = Enums['forma_pagamento']
export type StatusLancamento = Enums['status_lancamento']
export type TipoLancamento = Enums['tipo_lancamento']
export type TipoConta = Enums['tipo_conta']
/** Status + "atrasado", que é calculado pelo banco. */
export type Situacao = StatusLancamento | 'atrasado'

export const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'PIX' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'debito_automatico', rotulo: 'Débito automático' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const NOME_FORMA = Object.fromEntries(FORMAS.map((f) => [f.valor, f.rotulo])) as Record<
  FormaPagamento,
  string
>

export const NOME_SITUACAO: Record<Situacao, string> = {
  pendente: 'Pendente',
  agendado: 'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  atrasado: 'Atrasado',
}

export const COR_SITUACAO = {
  pendente: 'cinza',
  agendado: 'verde',
  realizado: 'verde',
  cancelado: 'cinza',
  atrasado: 'perigo',
} as const satisfies Record<Situacao, string>

export const EXPLICACAO_STATUS: Record<StatusLancamento, string> = {
  pendente: 'Ainda não foi pago nem agendado. Alguém precisa agir no dia.',
  agendado: 'Já está programado no banco (Pix agendado, débito automático).',
  realizado: 'O dinheiro já entrou ou saiu. Só este status altera o saldo.',
  cancelado: 'Não vale mais. O lançamento fica guardado no histórico.',
}

export const NOME_TIPO_CONTA: Record<TipoConta, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa (dinheiro)',
  outro: 'Outro',
}
