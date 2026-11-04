import { FileText, Plus, Search, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, formatarMes } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { useValorAtrasado } from '@/lib/useValorAtrasado'
import { cn } from '@/lib/utils'

import { textoEmissao } from './notas'
import {
  NOME_TIPO_NOTA,
  useAmbienteNfse,
  useEmitirNota,
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
  const ambiente = useAmbienteNfse()
  // Na lista de rascunhos, com a emissão ligada: marcar várias e emitir de uma vez.
  const emLote = filtro.status === 'rascunho' && ambiente.data === 'producao'
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())

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
          <option value="rascunho">Rascunhos (a emitir)</option>
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

      <RascunhosDoMes />

      {notas.isError && <Aviso tipo="erro">{mensagemDeErro(notas.error)}</Aviso>}
      {notas.isPending && <Carregando />}

      {notas.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhuma nota fiscal com estes filtros.
        </Card>
      )}

      {lista.length > 0 && (
        <>
          {emLote && <EmitirMarcadas lista={lista} marcadas={marcadas} aoMarcar={setMarcadas} />}
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
            {lista.map((n) => (
              <LinhaNota
                key={n.id}
                n={n}
                marcada={emLote ? marcadas.has(n.id) : undefined}
                aoMarcar={(sim) => {
                  const novas = new Set(marcadas)
                  if (sim) novas.add(n.id)
                  else novas.delete(n.id)
                  setMarcadas(novas)
                }}
              />
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

export function LinhaNota({
  n,
  marcada,
  aoMarcar,
}: {
  n: NotaFiscalCompleta
  /** Com valor, a linha ganha a caixa de marcar (emissão em lote). */
  marcada?: boolean
  aoMarcar?: (sim: boolean) => void
}) {
  const cancelada = n.status === 'cancelada'
  const rascunho = n.status === 'rascunho'
  const envioPendente = n.status === 'emitida' && !!n.pdf && !n.enviada_em
  return (
    <li className="flex items-center">
      {marcada !== undefined && (
        <label className="flex min-h-11 cursor-pointer items-center self-stretch pl-4">
          <span className="sr-only">Marcar para emitir</span>
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={marcada}
            onChange={(e) => aoMarcar?.(e.target.checked)}
          />
        </label>
      )}
      <Link
        to={`/financeiro/notas/${n.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-fundo-suave"
      >
        <FileText
          className={cn(
            'size-6 shrink-0',
            cancelada ? 'text-texto-suave' : rascunho ? 'text-alerta' : 'text-verde',
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold', cancelada && 'line-through')}>
            {rascunho ? 'Rascunho' : n.numero ? `NF ${n.numero}` : 'NF sem número'} ·{' '}
            {n.cliente?.nome_fantasia || n.cliente?.nome}
          </p>
          <p className="truncate text-sm text-texto-suave">
            {[
              !rascunho && `Emitida ${formatarData(n.data_emissao)}`,
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
            {rascunho && n.erro_emissao && <Etiqueta cor="perigo">Erro na emissão</Etiqueta>}
            {rascunho && <Etiqueta cor="alerta">A emitir</Etiqueta>}
            {envioPendente && <Etiqueta cor="perigo">Envio pendente</Etiqueta>}
            {n.enviada_em && <Etiqueta cor="cinza">Enviada</Etiqueta>}
            <Etiqueta cor={n.tipo === 'contrato' ? 'verde' : 'alerta'}>
              {NOME_TIPO_NOTA[n.tipo]}
            </Etiqueta>
          </span>
        </div>
      </Link>
    </li>
  )
}

/** Aviso no topo: notas do mês montadas pelo sistema que ainda não foram emitidas. */
function RascunhosDoMes() {
  const [parametros, setParametros] = useSearchParams()
  const rascunhos = useNotasFiscais({ mes: '', tipo: 'todos', status: 'rascunho', busca: '' })
  const total = rascunhos.data?.length ?? 0
  if (total === 0 || parametros.get('status') === 'rascunho') return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-alerta/30 bg-amber-50 px-4 py-3 text-sm">
      <span>
        <strong>{total}</strong> nota(s) de contrato em rascunho, prontas para conferir e emitir.
      </span>
      <button
        type="button"
        className="font-semibold text-verde-escuro underline"
        onClick={() => setParametros({ status: 'rascunho' }, { replace: true })}
      >
        Ver rascunhos
      </button>
    </div>
  )
}

type Progresso = {
  feitas: number
  total: number
  linhas: { id: string; nome: string; ok: boolean; texto: string }[]
}

/** Barra acima da lista de rascunhos: marca todas e emite as marcadas, uma a uma. */
function EmitirMarcadas({
  lista,
  marcadas,
  aoMarcar,
}: {
  lista: NotaFiscalCompleta[]
  marcadas: Set<string>
  aoMarcar: (s: Set<string>) => void
}) {
  const emitir = useEmitirNota()
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const rodando = !!progresso && progresso.feitas < progresso.total
  const escolhidas = lista.filter((n) => marcadas.has(n.id))
  const todas = escolhidas.length === lista.length

  async function emitirTodas() {
    if (
      !window.confirm(
        `Emitir ${escolhidas.length} nota(s) agora? Elas vão para o Sistema Nacional NFS-e e o PDF segue a cada cliente.`,
      )
    )
      return
    const p: Progresso = { feitas: 0, total: escolhidas.length, linhas: [] }
    setProgresso({ ...p })
    // Uma de cada vez: a Sefin recusa pedidos demais seguidos, e o erro de uma não para as outras.
    for (const n of escolhidas) {
      const nome = n.cliente?.nome_fantasia || n.cliente?.nome || ''
      try {
        const r = await emitir.mutateAsync(n.id)
        p.linhas.push({ id: n.id, nome, ok: true, texto: textoEmissao(r) })
      } catch (erro) {
        p.linhas.push({ id: n.id, nome, ok: false, texto: mensagemDeErro(erro) })
      }
      p.feitas++
      setProgresso({ ...p, linhas: [...p.linhas] })
    }
    aoMarcar(new Set())
  }

  const comErro = progresso?.linhas.filter((l) => !l.ok) ?? []
  return (
    <Card className="mb-3 flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={todas}
            disabled={rodando}
            onChange={() => aoMarcar(todas ? new Set() : new Set(lista.map((n) => n.id)))}
          />
          Marcar todas ({lista.length})
        </label>
        <Button disabled={rodando || escolhidas.length === 0} onClick={() => void emitirTodas()}>
          <Send className="size-4" aria-hidden />
          {rodando
            ? `Emitindo ${progresso.feitas + 1} de ${progresso.total}…`
            : `Emitir marcadas (${escolhidas.length})`}
        </Button>
      </div>
      {progresso && (
        <>
          <div
            className="h-2 overflow-hidden rounded-full bg-fundo-suave"
            role="progressbar"
            aria-label="Notas emitidas"
            aria-valuenow={progresso.feitas}
            aria-valuemax={progresso.total}
          >
            <div
              className="h-full bg-verde transition-all"
              style={{ width: `${(progresso.feitas / progresso.total) * 100}%` }}
            />
          </div>
          {!rodando && (
            <Aviso tipo={comErro.length ? 'erro' : 'sucesso'}>
              {progresso.total - comErro.length} de {progresso.total} emitida(s).
              {comErro.length > 0 && ' As que deram erro continuam na lista como rascunho.'}
            </Aviso>
          )}
          {progresso.linhas.length > 0 && (
            <ul className="max-h-64 overflow-y-auto text-sm">
              {progresso.linhas.map((l) => (
                <li key={l.id} className={cn('py-1', l.ok ? 'text-verde-escuro' : 'text-perigo')}>
                  <strong>{l.nome}:</strong> {l.texto}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}
