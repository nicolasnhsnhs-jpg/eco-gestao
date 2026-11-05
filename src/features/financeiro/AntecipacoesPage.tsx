import { ArrowLeft, HandCoins } from 'lucide-react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { usePerfil } from '../auth/useAuth'
import { porcentagemDoDesconto } from './antecipacao'
import { useAntecipacoes, useDesfazerAntecipacao, type AntecipacaoCompleta } from './api'

/** Histórico das antecipações: quanto foi antecipado, o desconto e os vencimentos dos clientes. */
export function AntecipacoesPage() {
  const antecipacoes = useAntecipacoes()
  const lista = antecipacoes.data ?? []

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Antecipações</h1>
        <Link
          to="/financeiro/lancamentos?antecipar=1"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
        >
          <HandCoins className="size-5" aria-hidden /> Nova antecipação
        </Link>
      </div>

      <Link
        to="/financeiro/lancamentos"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-verde-escuro hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> Lançamentos
      </Link>

      {antecipacoes.isError && <Aviso tipo="erro">{mensagemDeErro(antecipacoes.error)}</Aviso>}
      {antecipacoes.isPending && <Carregando />}
      {antecipacoes.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">Nenhuma antecipação ainda.</Card>
      )}

      <div className="flex flex-col gap-4">
        {lista.map((a) => (
          <CartaoAntecipacao key={a.id} a={a} />
        ))}
      </div>
    </>
  )
}

function CartaoAntecipacao({ a }: { a: AntecipacaoCompleta }) {
  const perfil = usePerfil()
  const desfazer = useDesfazerAntecipacao()
  const contas = [...(a.lancamentos ?? [])].sort((x, y) => x.vencimento.localeCompare(y.vencimento))

  function aoDesfazer() {
    if (
      !window.confirm(
        'Desfazer esta antecipação? As contas voltam a ficar a receber e o valor sai do saldo.',
      )
    )
      return
    desfazer.mutate(a.id)
  }

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borda p-4">
        <div>
          <p className="font-semibold">
            {a.instituicao} · {formatarData(a.data)}
            {a.desfeita && (
              <span className="ml-2">
                <Etiqueta>Desfeita</Etiqueta>
              </span>
            )}
          </p>
          <p className="text-sm text-texto-suave">
            Caiu em {a.conta?.nome}
            {a.observacoes && ` · ${a.observacoes}`}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-right text-sm">
          <div>
            <dt className="text-texto-suave">Total</dt>
            <dd className="font-bold">{formatarReais(a.valor_bruto)}</dd>
          </div>
          <div>
            <dt className="text-texto-suave">
              Desconto ({porcentagemDoDesconto(a.valor_bruto, a.desconto).toLocaleString('pt-BR')}
              %)
            </dt>
            <dd className="font-bold text-perigo">− {formatarReais(a.desconto)}</dd>
          </div>
          <div>
            <dt className="text-texto-suave">Líquido</dt>
            <dd className="font-bold text-verde">{formatarReais(a.valor_liquido)}</dd>
          </div>
        </dl>
      </div>

      {contas.length > 0 && (
        <ul className="divide-y divide-borda text-sm">
          {contas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <Link to={`/financeiro/lancamentos/${l.id}`} className="min-w-0 hover:underline">
                <span className="block truncate font-semibold">{l.descricao}</span>
                <span className="block truncate text-texto-suave">
                  {[
                    `Cliente vence ${formatarData(l.vencimento)}`,
                    l.cliente?.nome_fantasia || l.cliente?.nome,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
              <span className="shrink-0 text-right">
                {formatarReais(l.valor)}
                <span className="block text-xs text-texto-suave">
                  recebido {formatarReais(l.valor_pago)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!a.desfeita && perfil.papel === 'admin' && (
        <div className="flex items-center justify-end gap-3 border-t border-borda p-3">
          {desfazer.isError && (
            <span className="text-sm text-perigo">{mensagemDeErro(desfazer.error)}</span>
          )}
          <Button variante="fantasma" onClick={aoDesfazer} disabled={desfazer.isPending}>
            {desfazer.isPending ? 'Desfazendo…' : 'Desfazer'}
          </Button>
        </div>
      )}
    </Card>
  )
}
