import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { useValorAtrasado } from '@/lib/useValorAtrasado'
import { cn } from '@/lib/utils'

import { useLancamentos, type FiltroLancamentos, type LancamentoCompleto } from './api'
import { ConfirmarModal } from './ConfirmarModal'
import { COR_SITUACAO, NOME_SITUACAO, type Situacao } from './rotulos'

const SITUACOES: { valor: FiltroLancamentos['situacao']; rotulo: string }[] = [
  { valor: 'em_aberto', rotulo: 'Em aberto' },
  { valor: 'atrasado', rotulo: 'Atrasados' },
  { valor: 'realizado', rotulo: 'Realizados' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
  { valor: 'todos', rotulo: 'Todos' },
]

export function LancamentosPage() {
  // Os filtros ficam no endereço (?tipo=entrada&situacao=atrasado…): "voltar" mantém tudo.
  const [parametros, setParametros] = useSearchParams()
  const filtro: FiltroLancamentos = {
    tipo: (parametros.get('tipo') as FiltroLancamentos['tipo']) ?? 'todos',
    situacao: (parametros.get('situacao') as FiltroLancamentos['situacao']) ?? 'em_aberto',
    mes: parametros.get('mes') ?? '',
    busca: parametros.get('q') ?? '',
  }
  const buscaAtrasada = useValorAtrasado(filtro.busca)
  const lancamentos = useLancamentos({ ...filtro, busca: buscaAtrasada })
  const [confirmando, setConfirmando] = useState<LancamentoCompleto | null>(null)

  function mudar(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros)
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    setParametros(novos, { replace: true })
  }

  const lista = lancamentos.data ?? []
  const somar = (tipo: 'entrada' | 'saida') =>
    lista.filter((l) => l.tipo === tipo).reduce((s, l) => s + Number(l.valor), 0)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <div className="flex gap-2">
          <Link
            to="/financeiro/lancamentos/novo?tipo=entrada"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden /> A receber
          </Link>
          <Link
            to="/financeiro/lancamentos/novo?tipo=saida"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Plus className="size-5" aria-hidden /> A pagar
          </Link>
        </div>
      </div>

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar na descrição ou nota fiscal</span>
          <Search
            className="pointer-events-none absolute top-3 left-3 size-5 text-texto-suave"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Descrição ou nº da NF"
            className="pl-10"
            value={filtro.busca}
            onChange={(e) => mudar('q', e.target.value)}
          />
        </label>
        <Select
          aria-label="Tipo"
          value={filtro.tipo}
          onChange={(e) => mudar('tipo', e.target.value === 'todos' ? '' : e.target.value)}
        >
          <option value="todos">Entradas e saídas</option>
          <option value="entrada">Só a receber (entradas)</option>
          <option value="saida">Só a pagar (saídas)</option>
        </Select>
        <Select
          aria-label="Situação"
          value={filtro.situacao}
          onChange={(e) => mudar('situacao', e.target.value === 'em_aberto' ? '' : e.target.value)}
        >
          {SITUACOES.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </Select>
        <Input
          type="month"
          aria-label="Mês do vencimento"
          title="Mês do vencimento (vazio = todos)"
          value={filtro.mes}
          onChange={(e) => mudar('mes', e.target.value)}
        />
      </Card>

      {lancamentos.isError && <Aviso tipo="erro">{mensagemDeErro(lancamentos.error)}</Aviso>}
      {lancamentos.isPending && <Carregando />}

      {lancamentos.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhum lançamento com estes filtros.
        </Card>
      )}

      {lista.length > 0 && (
        <>
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
            {lista.map((l) => (
              <LinhaLancamento key={l.id} l={l} aoConfirmar={() => setConfirmando(l)} />
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
            <span>
              {lista.length} lançamento(s) · Entradas:{' '}
              <strong className="text-verde">{formatarReais(somar('entrada'))}</strong>
            </span>
            <span>
              Saídas: <strong className="text-perigo">{formatarReais(somar('saida'))}</strong>
            </span>
          </div>
        </>
      )}

      <ConfirmarModal lancamento={confirmando} aoFechar={() => setConfirmando(null)} />
    </>
  )
}

export function LinhaLancamento({
  l,
  aoConfirmar,
}: {
  l: LancamentoCompleto
  aoConfirmar?: () => void
}) {
  const entrada = l.tipo === 'entrada'
  const situacao = (l.situacao ?? l.status) as Situacao
  const emAberto = l.status === 'pendente' || l.status === 'agendado'
  const Icone = entrada ? ArrowDownCircle : ArrowUpCircle
  const contraparte = l.cliente?.nome_fantasia || l.cliente?.nome || l.fornecedor?.nome

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icone
        className={cn('size-6 shrink-0', entrada ? 'text-verde' : 'text-perigo')}
        aria-label={entrada ? 'Entrada' : 'Saída'}
      />
      <Link to={`/financeiro/lancamentos/${l.id}`} className="min-w-0 flex-1 hover:underline">
        <p className="truncate font-semibold">
          {l.descricao}
          {l.parcela_numero && (
            <span className="font-normal text-texto-suave">
              {' '}
              ({l.parcela_numero}/{l.parcela_total})
            </span>
          )}
        </p>
        <p className="truncate text-sm text-texto-suave">
          {[
            `Venc. ${formatarData(l.vencimento)}`,
            contraparte,
            l.categoria?.nome,
            l.numero_nota_fiscal && `NF ${l.numero_nota_fiscal}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('font-bold', entrada ? 'text-verde' : 'text-perigo')}>
          {entrada ? '' : '− '}
          {formatarReais(l.status === 'realizado' ? l.valor_pago : l.valor)}
        </span>
        <Etiqueta cor={COR_SITUACAO[situacao]}>{NOME_SITUACAO[situacao]}</Etiqueta>
      </div>
      {aoConfirmar && (
        <div className="w-11 shrink-0">
          {emAberto && (
            <Button
              variante="fantasma"
              className="px-2"
              onClick={aoConfirmar}
              aria-label={entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
              title={entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
            >
              <CheckCircle2 className="size-6" aria-hidden />
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
