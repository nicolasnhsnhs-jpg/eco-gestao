import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { paraCentavos } from '@/lib/dinheiro'

import type { FormaPagamento } from './rotulos'

/*
 * Nota fiscal a partir da OS (Financeiro > A faturar > Abrir OS > Emitir nota): o
 * sistema monta a nota com o que está na proposta de onde a OS saiu, e o financeiro
 * confere ao lado, com a proposta resumida.
 */

export type ItemProposta = {
  id: string
  ordem: number
  descricao: string
  quantidade: number
  valor_unitario: number
  tipo_servico_id: string | null
}

export type PropostaDaOs = {
  id: string
  numero: string | null
  valor_total: number
  prazo_pagamento_dias: number | null
  prazos_pagamento: number[] | null
  condicao_pagamento: string | null
  itens: ItemProposta[]
}

export type OsParaNota = {
  numero: string
  data_agendada: string | null
  tipo_servico_id: string | null
  proposta: PropostaDaOs | null
  pedidoCompra: string | null
  /** Serviço feito a mais, fora da proposta (anotado pelo escritório na conferência). */
  adicional?: { descricao: string; valor: number } | null
}

/** Itens da proposta que são do serviço desta OS (todos, se nenhum bater). */
export function itensDaOs(os: Pick<OsParaNota, 'tipo_servico_id' | 'proposta'>) {
  const p = os.proposta
  if (!p) return []
  const itens = [...p.itens].sort((a, b) => a.ordem - b.ordem)
  const doServico = itens.filter((i) => i.tipo_servico_id === os.tipo_servico_id)
  return doServico.length > 0 ? doServico : itens
}

/**
 * Valor a faturar: os itens do mesmo serviço da OS ou, se nenhum bater (ou todos
 * forem dele), o total da proposta. Igual ao "Usar este valor" do faturar na OS.
 */
export function valorDaProposta(os: Pick<OsParaNota, 'tipo_servico_id' | 'proposta'>) {
  const p = os.proposta
  if (!p) return null
  const itens = itensDaOs(os)
  if (itens.length === p.itens.length) return Number(p.valor_total)
  return itens.reduce((s, i) => s + paraCentavos(i.quantidade * i.valor_unitario), 0) / 100
}

/** Valor da nota da OS: o da proposta mais o serviço adicional, quando houver. */
export function valorDaOs(os: Pick<OsParaNota, 'tipo_servico_id' | 'proposta' | 'adicional'>) {
  const proposta = valorDaProposta(os)
  const adicional = os.adicional?.valor ?? 0
  if (proposta == null) return adicional > 0 ? adicional : null
  return (paraCentavos(proposta) + paraCentavos(adicional)) / 100
}

/** Forma de pagamento da nota pelo que a proposta diz (boleto, se não disser). */
export function formaDaProposta(condicao: string | null | undefined): FormaPagamento {
  const c = (condicao ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/\bpix\b/.test(c)) return 'pix'
  if (/cart[aã]o|credito|debito/.test(c)) return 'cartao'
  if (/transfer|deposito|ted\b/.test(c)) return 'transferencia'
  if (/dinheiro|especie/.test(c)) return 'dinheiro'
  return 'boleto'
}

/** Vencimento: o primeiro prazo da proposta contado de hoje; sem prazo, 10 dias. */
export function vencimentoDaProposta(p: PropostaDaOs | null, hoje = hojeISO()) {
  const prazo = p?.prazos_pagamento?.[0] ?? p?.prazo_pagamento_dias
  return somarDias(hoje, prazo != null && prazo > 0 ? prazo : 10)
}

/**
 * Descrição da nota: os serviços da proposta, a data e a OS, a proposta e o pedido
 * de compra (quando tiver).
 */
export function descricaoDaOs(os: OsParaNota) {
  const servicos = itensDaOs(os)
    .map((i) =>
      i.descricao
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.;]+$/, ''),
    )
    .filter(Boolean)
  const partes: string[] = []
  if (servicos.length) partes.push(`${servicos.join('; ')}.`)
  const quando = os.data_agendada ? ` em ${formatarData(os.data_agendada)}` : ''
  const proposta = os.proposta?.numero ? `, conforme proposta nº ${os.proposta.numero}` : ''
  partes.push(`Serviço realizado${quando} (${os.numero})${proposta}.`)
  const adicional = os.adicional?.descricao
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;]+$/, '')
  if (adicional) partes.push(`Serviço adicional: ${adicional}.`)
  if (os.pedidoCompra?.trim()) partes.push(`Pedido de compra nº ${os.pedidoCompra.trim()}.`)
  return partes.join(' ')
}
