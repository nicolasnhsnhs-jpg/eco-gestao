import { ChevronRight, FileText, Plus, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import {
  COR_SITUACAO_PROPOSTA,
  NOME_SITUACAO_PROPOSTA,
  usePropostas,
  type PropostaResumo,
  type SituacaoProposta,
} from './api'

const sem = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function PropostasPage() {
  const [parametros, setParametros] = useSearchParams()
  const situacao = parametros.get('situacao') ?? 'todas'
  const busca = parametros.get('q') ?? ''
  const propostas = usePropostas()

  function mudar(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros)
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    setParametros(novos, { replace: true })
  }

  const todas = propostas.data ?? []
  const filtradas = todas.filter((p) => {
    if (situacao !== 'todas' && p.situacao !== situacao) return false
    if (!busca.trim()) return true
    const alvo = sem(
      [p.numero, p.cliente?.nome, p.cliente?.nome_fantasia, p.vendedor?.nome].join(' '),
    )
    return alvo.includes(sem(busca.trim()))
  })

  const aguardando = todas.filter((p) => p.status === 'enviada')
  const somar = (lista: PropostaResumo[]) => lista.reduce((s, p) => s + Number(p.valor_total), 0)

  return (
    <>
      <PageHeader
        titulo="Propostas"
        acoes={
          <Link
            to="/propostas/nova"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden /> Nova proposta
          </Link>
        }
      />

      {propostas.isSuccess && aguardando.length > 0 && (
        <p className="mb-4 text-sm text-texto-suave">
          {aguardando.length} aguardando resposta, somando{' '}
          <strong className="text-texto">{formatarReais(somar(aguardando))}</strong>.
        </p>
      )}

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <label className="relative sm:col-span-2">
          <span className="sr-only">Buscar</span>
          <Search
            className="pointer-events-none absolute top-3 left-3 size-5 text-texto-suave"
            aria-hidden
          />
          <Input
            type="search"
            className="pl-10"
            placeholder="Número, cliente ou vendedor"
            value={busca}
            onChange={(e) => mudar('q', e.target.value)}
          />
        </label>
        <Select
          aria-label="Situação"
          value={situacao}
          onChange={(e) => mudar('situacao', e.target.value === 'todas' ? '' : e.target.value)}
        >
          <option value="todas">Todas</option>
          {(Object.keys(NOME_SITUACAO_PROPOSTA) as SituacaoProposta[]).map((s) => (
            <option key={s} value={s}>
              {NOME_SITUACAO_PROPOSTA[s]}
            </option>
          ))}
        </Select>
      </Card>

      {propostas.isError && <Aviso tipo="erro">{mensagemDeErro(propostas.error)}</Aviso>}
      {propostas.isPending && <Carregando />}
      {propostas.isSuccess && filtradas.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">Nenhuma proposta encontrada.</Card>
      )}

      {filtradas.length > 0 && <ListaPropostas propostas={filtradas} mostrarCliente />}
    </>
  )
}

/** Lista usada aqui e na ficha do cliente. */
export function ListaPropostas({
  propostas,
  mostrarCliente,
  semBorda,
}: {
  propostas: PropostaResumo[]
  mostrarCliente?: boolean
  semBorda?: boolean
}) {
  return (
    <ul
      className={cn(
        'divide-y divide-borda overflow-hidden bg-white',
        !semBorda && 'rounded-2xl border border-borda',
      )}
    >
      {propostas.map((p) => {
        const situacao = (p.situacao ?? p.status) as SituacaoProposta
        return (
          <li key={p.id}>
            <Link
              to={`/propostas/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-fundo-suave"
            >
              <FileText className="size-6 shrink-0 text-verde" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.numero}
                  {mostrarCliente && ` · ${p.cliente?.nome_fantasia || p.cliente?.nome}`}
                </p>
                <p className="truncate text-sm text-texto-suave">
                  {[
                    `Enviada ${formatarData(p.data_envio)}`,
                    p.vendedor?.nome,
                    p.status === 'enviada' && p.dias_sem_resposta
                      ? `${p.dias_sem_resposta} dia(s) sem resposta`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <strong>{formatarReais(p.valor_total)}</strong>
                <Etiqueta cor={COR_SITUACAO_PROPOSTA[situacao]}>
                  {NOME_SITUACAO_PROPOSTA[situacao]}
                </Etiqueta>
              </div>
              <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
