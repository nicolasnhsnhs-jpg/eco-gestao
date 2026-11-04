import { FileText, Plus, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, formatarMes } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { useValorAtrasado } from '@/lib/useValorAtrasado'
import { cn } from '@/lib/utils'

import {
  NOME_TIPO_NOTA,
  useNotasFiscais,
  type FiltroNotas,
  type NotaFiscalCompleta,
} from './notasApi'

export function NotasFiscaisPage() {
  // Filtros no endereço (?mes=2026-11&tipo=contrato…): "voltar" mantém tudo.
  const [parametros, setParametros] = useSearchParams()
  const filtro: FiltroNotas = {
    mes: parametros.get('mes') ?? '',
    tipo: (parametros.get('tipo') as FiltroNotas['tipo']) ?? 'todos',
    status: (parametros.get('status') as FiltroNotas['status']) ?? 'emitida',
    busca: parametros.get('q') ?? '',
  }
  const buscaAtrasada = useValorAtrasado(filtro.busca)
  const notas = useNotasFiscais({ ...filtro, busca: buscaAtrasada })

  function mudar(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros)
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    setParametros(novos, { replace: true })
  }

  const lista = notas.data ?? []
  const somar = (lista: NotaFiscalCompleta[]) =>
    lista.reduce((s, n) => s + Number(n.valor_servico), 0)
  const deContrato = lista.filter((n) => n.tipo === 'contrato')
  const avulsas = lista.filter((n) => n.tipo === 'avulsa')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notas fiscais</h1>
        <div className="flex gap-2">
          <Link
            to="/financeiro/notas/nova?tipo=contrato"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden /> Nota de contrato
          </Link>
          <Link
            to="/financeiro/notas/nova?tipo=avulsa"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Plus className="size-5" aria-hidden /> Nota avulsa
          </Link>
        </div>
      </div>

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar pelo número ou descrição</span>
          <Search
            className="pointer-events-none absolute top-3 left-3 size-5 text-texto-suave"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Nº da nota ou descrição"
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
          <option value="todos">Contrato e avulsa</option>
          <option value="contrato">Só de contrato</option>
          <option value="avulsa">Só avulsas</option>
        </Select>
        <Select
          aria-label="Situação"
          value={filtro.status}
          onChange={(e) => mudar('status', e.target.value === 'emitida' ? '' : e.target.value)}
        >
          <option value="emitida">Emitidas</option>
          <option value="cancelada">Canceladas</option>
          <option value="todos">Todas</option>
        </Select>
        <Input
          type="month"
          aria-label="Mês de competência"
          title="Mês de competência (vazio = todos)"
          value={filtro.mes}
          onChange={(e) => mudar('mes', e.target.value)}
        />
      </Card>

      {notas.isError && <Aviso tipo="erro">{mensagemDeErro(notas.error)}</Aviso>}
      {notas.isPending && <Carregando />}

      {notas.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhuma nota fiscal com estes filtros.
        </Card>
      )}

      {lista.length > 0 && (
        <>
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
            {lista.map((n) => (
              <LinhaNota key={n.id} n={n} />
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
            <span>
              {deContrato.length} de contrato:{' '}
              <strong className="text-verde">{formatarReais(somar(deContrato))}</strong>
            </span>
            <span>
              {avulsas.length} avulsa(s):{' '}
              <strong className="text-verde">{formatarReais(somar(avulsas))}</strong>
            </span>
            <span>
              Total: <strong>{formatarReais(somar(lista))}</strong>
            </span>
          </div>
        </>
      )}
    </>
  )
}

export function LinhaNota({ n }: { n: NotaFiscalCompleta }) {
  const cancelada = n.status === 'cancelada'
  return (
    <li>
      <Link
        to={`/financeiro/notas/${n.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-fundo-suave"
      >
        <FileText
          className={cn('size-6 shrink-0', cancelada ? 'text-texto-suave' : 'text-verde')}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold', cancelada && 'line-through')}>
            {n.numero ? `NF ${n.numero}` : 'NF sem número'} ·{' '}
            {n.cliente?.nome_fantasia || n.cliente?.nome}
          </p>
          <p className="truncate text-sm text-texto-suave">
            {[
              `Emitida ${formatarData(n.data_emissao)}`,
              formatarMes(n.competencia),
              n.vencimento && `vence ${formatarData(n.vencimento)}`,
              n.contrato?.descricao,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <strong className="text-sm">{formatarReais(n.valor_servico)}</strong>
          <span className="flex gap-1">
            {cancelada && <Etiqueta cor="perigo">Cancelada</Etiqueta>}
            <Etiqueta cor={n.tipo === 'contrato' ? 'verde' : 'alerta'}>
              {NOME_TIPO_NOTA[n.tipo]}
            </Etiqueta>
          </span>
        </div>
      </Link>
    </li>
  )
}
