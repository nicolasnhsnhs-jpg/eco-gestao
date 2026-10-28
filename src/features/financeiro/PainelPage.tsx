import { AlertTriangle, Landmark } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarMes, hojeISO } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useGerarAvisosAoAbrir } from '../avisos/api'
import {
  useContas,
  useLancamentos,
  usePainel,
  useResumoMensal,
  type LancamentoCompleto,
} from './api'
import { ConfirmarModal } from './ConfirmarModal'
import { LinhaLancamento } from './LancamentosPage'

/** Visão geral do dinheiro: saldo, o que entra, o que sai e o que está atrasado. */
export function PainelPage() {
  const painel = usePainel()
  const contas = useContas()
  const resumo = useResumoMensal()
  // Vencidos e de hoje, para confirmar direto daqui.
  const doDia = useLancamentos({ tipo: 'todos', situacao: 'em_aberto', mes: '', busca: '' })
  const [confirmando, setConfirmando] = useState<LancamentoCompleto | null>(null)

  // Gera na hora os avisos de cobrança (sem esperar a tarefa da madrugada).
  useGerarAvisosAoAbrir()

  if (painel.isPending) return <Carregando />
  if (painel.isError) return <Aviso tipo="erro">{mensagemDeErro(painel.error)}</Aviso>
  const p = painel.data
  const projetado = p.saldo_atual + p.a_receber - p.a_pagar
  const hoje = hojeISO()
  const urgentes = (doDia.data ?? []).filter((l) => (l.vencimento ?? '') <= hoje)
  const contasAtivas = (contas.data ?? []).filter((c) => c.ativo)

  return (
    <div className="flex flex-col gap-5">
      {contas.isSuccess && contasAtivas.length === 0 && (
        <Aviso>
          Comece cadastrando as contas bancárias (e o caixa) com o saldo de hoje.{' '}
          <Link to="/financeiro/cadastros" className="font-semibold underline">
            Ir para cadastros
          </Link>
        </Aviso>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Saldo atual" valor={p.saldo_atual} destaque />
        <Indicador
          titulo="A receber (em aberto)"
          valor={p.a_receber}
          detalhe={`${formatarReais(p.receber_30_dias)} nos próximos 30 dias`}
          link="/financeiro/lancamentos?tipo=entrada"
        />
        <Indicador
          titulo="A pagar (em aberto)"
          valor={p.a_pagar}
          detalhe={`${formatarReais(p.pagar_30_dias)} nos próximos 30 dias`}
          link="/financeiro/lancamentos?tipo=saida"
          negativo
        />
        <Indicador
          titulo="Saldo projetado"
          valor={projetado}
          detalhe="Saldo + a receber − a pagar"
        />
      </div>

      {(p.receber_atrasado > 0 || p.pagar_atrasado > 0) && (
        <Link
          to="/financeiro/lancamentos?situacao=atrasado"
          className="flex items-center gap-3 rounded-2xl border border-perigo/30 bg-red-50 p-4 text-perigo hover:bg-red-100"
        >
          <AlertTriangle className="size-6 shrink-0" aria-hidden />
          <span>
            <strong>Atrasados:</strong> {formatarReais(p.receber_atrasado)} a receber ·{' '}
            {formatarReais(p.pagar_atrasado)} a pagar. Ver lista →
          </span>
        </Link>
      )}

      {urgentes.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Vencidos e de hoje: confirmar</h2>
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
            {urgentes.map((l) => (
              <LinhaLancamento key={l.id} l={l} aoConfirmar={() => setConfirmando(l)} />
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 text-lg font-bold">Contas</h2>
          {contasAtivas.length === 0 && (
            <p className="text-sm text-texto-suave">Nenhuma conta cadastrada.</p>
          )}
          <ul className="flex flex-col gap-2">
            {contasAtivas.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <Landmark className="size-5 shrink-0 text-verde" aria-hidden />
                <span className="flex-1 truncate">{c.nome}</span>
                <strong className={cn(Number(c.saldo_atual) < 0 && 'text-perigo')}>
                  {formatarReais(c.saldo_atual)}
                </strong>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-x-auto lg:col-span-2">
          <h2 className="mb-1 text-lg font-bold">Resumo mensal</h2>
          <p className="mb-3 text-sm text-texto-suave">
            Faturamento e despesas pela competência; recebido, pago e saldo pela data em que o
            dinheiro mexeu.
          </p>
          {resumo.isPending && <Carregando />}
          {resumo.data && (
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead>
                <tr className="border-b border-borda text-texto-suave">
                  <th className="py-2 text-left font-semibold">Mês</th>
                  <th className="font-semibold">Faturamento</th>
                  <th className="font-semibold">Despesas</th>
                  <th className="font-semibold">Recebido</th>
                  <th className="font-semibold">Pago</th>
                  <th className="font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {resumo.data.map((m) => {
                  const atual = m.mes.slice(0, 7) === hoje.slice(0, 7)
                  return (
                    <tr
                      key={m.mes}
                      className={cn(
                        'border-b border-borda last:border-0',
                        atual && 'bg-lima-claro font-semibold',
                      )}
                    >
                      <td className="py-2 text-left">{formatarMes(m.mes)}</td>
                      <td>{formatarReais(m.faturamento)}</td>
                      <td>{formatarReais(m.despesas)}</td>
                      <td className="text-verde">{formatarReais(m.recebido)}</td>
                      <td className="text-perigo">{formatarReais(m.pago)}</td>
                      <td className={cn(Number(m.saldo_acumulado) < 0 && 'text-perigo')}>
                        {formatarReais(m.saldo_acumulado)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <ConfirmarModal lancamento={confirmando} aoFechar={() => setConfirmando(null)} />
    </div>
  )
}

function Indicador({
  titulo,
  valor,
  detalhe,
  destaque,
  negativo,
  link,
}: {
  titulo: string
  valor: number
  detalhe?: ReactNode
  destaque?: boolean
  negativo?: boolean
  link?: string
}) {
  const conteudo = (
    <>
      <p className={cn('text-sm', destaque ? 'text-white/80' : 'text-texto-suave')}>{titulo}</p>
      <p
        className={cn(
          'mt-1 font-titulo text-2xl font-bold',
          destaque ? 'text-white' : negativo ? 'text-perigo' : 'text-verde-escuro',
          valor < 0 && !destaque && 'text-perigo',
        )}
      >
        {formatarReais(valor)}
      </p>
      {detalhe && (
        <p className={cn('mt-1 text-xs', destaque ? 'text-white/80' : 'text-texto-suave')}>
          {detalhe}
        </p>
      )}
    </>
  )
  const estilo = cn(
    'rounded-2xl border p-5 shadow-sm',
    destaque ? 'border-verde bg-verde' : 'border-borda bg-white',
    link && 'hover:border-verde',
  )
  return link ? (
    <Link to={link} className={estilo}>
      {conteudo}
    </Link>
  ) : (
    <div className={estilo}>{conteudo}</div>
  )
}
