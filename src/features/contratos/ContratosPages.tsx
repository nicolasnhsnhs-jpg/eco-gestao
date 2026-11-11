import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronRight,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, formatarMes } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL, veValorDeContrato } from '@/lib/papeis'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { useNotasFiscais } from '../financeiro/notasApi'
import { LinhaNota } from '../financeiro/NotasFiscaisPage'
import { COR_SITUACAO, NOME_FORMA, NOME_SITUACAO, type Situacao } from '../financeiro/rotulos'
import {
  COR_STATUS_CONTRATO,
  NOME_STATUS_CONTRATO,
  useAtualizarContrato,
  useContrato,
  useContratos,
  useGerarCobrancas,
  useMensalidades,
  type ContratoResumo,
  type StatusContrato,
} from './api'

// -----------------------------------------------------------------------------
// Lista
// -----------------------------------------------------------------------------

export function ContratosPage() {
  const perfil = usePerfil()
  const acessoTotal = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const contratos = useContratos()
  const gerar = useGerarCobrancas()
  const verValor = veValorDeContrato(perfil.papel)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [parametros, setParametros] = useSearchParams()
  const termo = parametros.get('q') ?? ''
  const busca = semAcento(termo.trim())
  const encontrados = busca
    ? (contratos.data ?? []).filter((c) =>
        semAcento(
          [c.descricao, c.cliente?.nome_fantasia, c.cliente?.nome].filter(Boolean).join(' '),
        ).includes(busca),
      )
    : (contratos.data ?? [])

  const ativos = (contratos.data ?? []).filter((c) => c.status === 'ativo')
  const totalMensal = ativos.reduce((s, c) => s + Number(c.valor_mensal), 0)

  async function gerarAgora() {
    setMensagem(null)
    try {
      const n = await gerar.mutateAsync()
      setMensagem(
        n ? `${n} mensalidade(s) criada(s).` : 'Nada a criar: as mensalidades já estavam em dia.',
      )
    } catch (e) {
      setMensagem(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Contratos</h1>
        <div className="flex flex-wrap gap-2">
          {acessoTotal && (
            <Button
              variante="secundario"
              onClick={() => void gerarAgora()}
              disabled={gerar.isPending}
            >
              <RefreshCw className={cn('size-4', gerar.isPending && 'animate-spin')} aria-hidden />
              Gerar cobranças agora
            </Button>
          )}
          <Link
            to="/contratos/novo"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden /> Novo contrato
          </Link>
        </div>
      </div>

      {mensagem && <Aviso>{mensagem}</Aviso>}
      {verValor && contratos.isSuccess && ativos.length > 0 && (
        <p className="text-sm text-texto-suave">
          {ativos.length} contrato(s) ativo(s) somando{' '}
          <strong className="text-texto">{formatarReais(totalMensal)}</strong> por mês. As
          mensalidades são criadas sozinhas, todo dia de madrugada, para o mês atual e o próximo.
        </p>
      )}

      {!!contratos.data?.length && (
        <label className="relative">
          <span className="sr-only">Buscar contrato</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Buscar pelo nome do contrato ou do cliente"
            className="pl-10"
            value={termo}
            onChange={(e) =>
              setParametros(e.target.value ? { q: e.target.value } : {}, { replace: true })
            }
          />
        </label>
      )}

      {contratos.isPending && <Carregando />}
      {contratos.isError && <Aviso tipo="erro">{mensagemDeErro(contratos.error)}</Aviso>}
      {contratos.data?.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">Nenhum contrato cadastrado.</Card>
      )}
      {!!contratos.data?.length && encontrados.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhum contrato encontrado para “{termo.trim()}”.
        </Card>
      )}
      {encontrados.length > 0 && <ListaContratos contratos={encontrados} mostrarCliente />}
    </div>
  )
}

/** Minúsculas e sem acento, para a busca achar "joao" em "João". */
function semAcento(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function ListaContratos({
  contratos,
  mostrarCliente,
  semBorda,
}: {
  contratos: ContratoResumo[]
  mostrarCliente?: boolean
  semBorda?: boolean
}) {
  const verValor = veValorDeContrato(usePerfil().papel)
  return (
    <ul
      className={cn(
        'divide-y divide-borda overflow-hidden bg-white',
        !semBorda && 'rounded-2xl border border-borda',
      )}
    >
      {contratos.map((c) => (
        <li key={c.id}>
          <Link
            to={`/contratos/${c.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-fundo-suave"
          >
            <BriefcaseBusiness className="size-5 shrink-0 text-verde" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {c.descricao}
                {mostrarCliente && ` · ${c.cliente?.nome_fantasia || c.cliente?.nome}`}
              </p>
              <p className="truncate text-sm text-texto-suave">
                {[
                  `desde ${formatarData(c.data_inicio)}`,
                  c.data_fim && `até ${formatarData(c.data_fim)}`,
                  c.vendedor?.nome,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {verValor && <strong className="text-sm">{formatarReais(c.valor_mensal)}/mês</strong>}
              <Etiqueta cor={COR_STATUS_CONTRATO[c.status]}>
                {NOME_STATUS_CONTRATO[c.status]}
              </Etiqueta>
            </div>
            <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

// -----------------------------------------------------------------------------
// Detalhe
// -----------------------------------------------------------------------------

export function ContratoPage() {
  const { id } = useParams()
  const contrato = useContrato(id)
  if (contrato.isPending) return <Carregando />
  if (contrato.isError) return <Aviso tipo="erro">{mensagemDeErro(contrato.error)}</Aviso>
  if (!contrato.data) return <Aviso tipo="erro">Contrato não encontrado ou sem permissão.</Aviso>
  return <Detalhe c={contrato.data} />
}

function Detalhe({ c }: { c: ContratoResumo }) {
  const perfil = usePerfil()
  const acessoTotal = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const atualizar = useAtualizarContrato(c.id)
  const mensalidades = useMensalidades(c.id, acessoTotal)
  const [erro, setErro] = useState<string | null>(null)

  async function mudar(status: StatusContrato, pergunta: string) {
    if (!window.confirm(pergunta)) return
    setErro(null)
    try {
      await atualizar.mutateAsync({ status })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/contratos"
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Contratos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{c.descricao}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <Etiqueta cor={COR_STATUS_CONTRATO[c.status]}>
              {NOME_STATUS_CONTRATO[c.status]}
            </Etiqueta>
            {veValorDeContrato(perfil.papel) && (
              <strong>{formatarReais(c.valor_mensal)}/mês</strong>
            )}
            <Link to={`/clientes/${c.cliente_id}`} className="font-semibold text-verde underline">
              {c.cliente?.nome_fantasia || c.cliente?.nome}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === 'ativo' && (
            <Button
              variante="secundario"
              onClick={() =>
                void mudar(
                  'suspenso',
                  'Suspender o contrato? As mensalidades futuras em aberto são canceladas.',
                )
              }
            >
              <Pause className="size-4" aria-hidden /> Suspender
            </Button>
          )}
          {c.status === 'suspenso' && (
            <Button
              variante="secundario"
              onClick={() => void mudar('ativo', 'Reativar o contrato?')}
            >
              <Play className="size-4" aria-hidden /> Reativar
            </Button>
          )}
          {c.status !== 'encerrado' && (
            <Button
              variante="fantasma"
              onClick={() =>
                void mudar(
                  'encerrado',
                  'Encerrar o contrato? As mensalidades futuras em aberto são canceladas. Esta ação é para quando o cliente sai.',
                )
              }
            >
              <Square className="size-4" aria-hidden /> Encerrar
            </Button>
          )}
          <Link
            to={`/contratos/${c.id}/editar`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
        </div>
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Dados</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Dado rotulo="Início" valor={formatarData(c.data_inicio)} />
            <Dado rotulo="Fim" valor={c.data_fim ? formatarData(c.data_fim) : 'Sem data'} />
            <Dado rotulo="Vencimento" valor={textoVencimento(c)} />
            {c.forma_pagamento && <Dado rotulo="Pagamento" valor={NOME_FORMA[c.forma_pagamento]} />}
            <Dado rotulo="Vendedor" valor={c.vendedor?.nome ?? '—'} />
            {c.endereco && (
              <Dado
                rotulo="Endereço"
                valor={[
                  c.endereco.apelido,
                  `${c.endereco.logradouro}, ${c.endereco.numero ?? 's/n'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )}
            {c.proposta && (
              <div>
                <dt className="text-texto-suave">Proposta</dt>
                <dd>
                  <Link
                    to={`/propostas/${c.proposta.id}`}
                    className="font-semibold text-verde underline"
                  >
                    {c.proposta.numero}
                  </Link>
                </dd>
              </div>
            )}
            {c.observacoes && <Dado rotulo="Observações" valor={c.observacoes} />}
          </dl>
        </Card>

        {acessoTotal && (
          <Card className="lg:col-span-2">
            <h2 className="mb-3 text-lg font-bold">Mensalidades</h2>
            {mensalidades.isPending && <Carregando />}
            {mensalidades.data?.length === 0 && (
              <p className="text-sm text-texto-suave">
                Nenhuma ainda. Elas aparecem sozinhas de madrugada, ou pelo botão “Gerar cobranças
                agora” na lista de contratos.
              </p>
            )}
            <ul className="divide-y divide-borda">
              {mensalidades.data?.map((m) => {
                const situacao = (m.situacao ?? m.status) as Situacao
                return (
                  <li key={m.id}>
                    <Link
                      to={`/financeiro/lancamentos/${m.id}`}
                      className="flex items-center justify-between gap-3 py-2 hover:bg-fundo-suave"
                    >
                      <span>
                        <strong>{formatarMes(m.competencia)}</strong>{' '}
                        <span className="text-sm text-texto-suave">
                          vence {formatarData(m.vencimento)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {formatarReais(m.status === 'realizado' ? m.valor_pago : m.valor)}
                        <Etiqueta cor={COR_SITUACAO[situacao]}>{NOME_SITUACAO[situacao]}</Etiqueta>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {acessoTotal && <NotasDoContrato c={c} />}
      </div>
    </div>
  )
}

function textoVencimento(c: {
  dia_vencimento: number | null
  vence_mes_seguinte: boolean
  dia_util_cobranca: number | null
}): string {
  if (c.dia_vencimento)
    return `Todo dia ${c.dia_vencimento}${c.vence_mes_seguinte ? ' do mês seguinte' : ''}`
  return c.dia_util_cobranca
    ? `${c.dia_util_cobranca}º dia útil do mês`
    : 'Dia útil padrão da empresa'
}

function NotasDoContrato({ c }: { c: ContratoResumo }) {
  const notas = useNotasFiscais({
    mes: '',
    tipo: 'todos',
    status: 'todos',
    busca: '',
    contratoId: c.id,
  })
  const novaNota = `/financeiro/notas/nova?${new URLSearchParams({
    tipo: 'contrato',
    cliente: c.cliente_id,
    cliente_nome: c.cliente?.nome_fantasia || c.cliente?.nome || '',
    contrato: c.id,
  })}`
  return (
    <Card className="lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Notas fiscais</h2>
        <Link
          to={novaNota}
          className="inline-flex items-center gap-1 text-sm font-semibold text-verde"
        >
          <Plus className="size-4" aria-hidden /> Registrar nota deste contrato
        </Link>
      </div>
      {notas.isPending && <Carregando />}
      {notas.data?.length === 0 && (
        <p className="text-sm text-texto-suave">Nenhuma nota registrada para este contrato.</p>
      )}
      {!!notas.data?.length && (
        <ul className="-mx-4 divide-y divide-borda">
          {notas.data.map((n) => (
            <LinhaNota key={n.id} n={n} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="font-semibold whitespace-pre-line">{valor}</dd>
    </div>
  )
}
