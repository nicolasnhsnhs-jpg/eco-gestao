import { ChevronRight, FileText, Plus, Search } from 'lucide-react'
import { Link, NavLink, Outlet, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, hojeISO } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'

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

/** Filtros das aprovadas pelo dia da execução (para o vendedor acompanhar). */
const FILTROS_EXECUCAO = {
  agendadas: {
    nome: 'Agendadas (a executar)',
    aceita: (p: PropostaResumo, hoje: string) =>
      p.status === 'aprovada' && !!p.execucao_data && p.execucao_data >= hoje,
  },
  executadas: {
    nome: 'Agendadas já passadas',
    aceita: (p: PropostaResumo, hoje: string) =>
      p.status === 'aprovada' && !!p.execucao_data && p.execucao_data < hoje,
  },
  sem_data: {
    nome: 'Aprovadas sem agendamento',
    aceita: (p: PropostaResumo) => p.status === 'aprovada' && !p.execucao_data,
  },
}
type FiltroExecucao = keyof typeof FILTROS_EXECUCAO

/** Abas: as propostas já criadas e a criação de uma nova. */
export function PropostasLayout() {
  const abas = [
    { rotulo: 'Propostas criadas', caminho: '/propostas', fim: true },
    { rotulo: 'Agendadas', caminho: '/propostas/agendadas', fim: true },
    { rotulo: 'Nova proposta', caminho: '/propostas/nova', fim: true },
  ]
  return (
    <>
      <nav
        aria-label="Propostas"
        className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1"
      >
        {abas.map((aba) => (
          <NavLink
            key={aba.caminho}
            to={aba.caminho}
            end={aba.fim}
            className={({ isActive }) =>
              cn(
                'flex min-h-10 flex-1 items-center justify-center rounded-lg px-2 text-center text-sm leading-tight font-semibold sm:px-3 sm:whitespace-nowrap',
                isActive ? 'bg-verde text-white' : 'text-texto-suave hover:bg-lima-claro',
              )
            }
          >
            {aba.rotulo}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}

export function PropostasPage() {
  const [parametros, setParametros] = useSearchParams()
  const situacao = parametros.get('situacao') ?? 'todas'
  const busca = parametros.get('q') ?? ''
  const propostas = usePropostas()
  const perfil = usePerfil()

  function mudar(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros)
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    setParametros(novos, { replace: true })
  }

  // O vendedor, ao abrir Propostas, vê só as que ele mesmo fez. Quando pesquisa,
  // aparecem todas as que ele pode ver (o banco ainda limita às da carteira dele).
  const pesquisando = busca.trim() !== ''
  const soAsDele = perfil.papel === 'vendedor' && !pesquisando
  const todas = (propostas.data ?? []).filter((p) => !soAsDele || p.vendedor_id === perfil.id)
  const hoje = hojeISO()
  const filtradas = todas.filter((p) => {
    if (situacao in FILTROS_EXECUCAO) {
      if (!FILTROS_EXECUCAO[situacao as FiltroExecucao].aceita(p, hoje)) return false
    } else if (situacao !== 'todas' && p.situacao !== situacao) return false
    if (!busca.trim()) return true
    const alvo = sem(
      [p.numero, p.cliente?.nome, p.cliente?.nome_fantasia, p.vendedor?.nome].join(' '),
    )
    return alvo.includes(sem(busca.trim()))
  })
  // Agendadas: na ordem do dia da execução (as próximas primeiro).
  if (situacao in FILTROS_EXECUCAO) {
    filtradas.sort(
      (a, b) =>
        `${a.execucao_data ?? ''} ${a.execucao_hora ?? ''}`.localeCompare(
          `${b.execucao_data ?? ''} ${b.execucao_hora ?? ''}`,
        ) * (situacao === 'executadas' ? -1 : 1),
    )
  }

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

      {soAsDele && propostas.isSuccess && (
        <p className="mb-2 text-sm text-texto-suave">
          Mostrando só as suas propostas. Pesquise para encontrar as de outro vendedor.
        </p>
      )}

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
          <optgroup label="Aprovadas">
            {(Object.keys(FILTROS_EXECUCAO) as FiltroExecucao[]).map((f) => (
              <option key={f} value={f}>
                {FILTROS_EXECUCAO[f].nome}
              </option>
            ))}
          </optgroup>
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
                    p.status === 'aprovada' && p.execucao_data
                      ? `Execução ${formatarData(p.execucao_data)}${p.execucao_hora ? ` ${p.execucao_hora.slice(0, 5)}` : ''}`
                      : null,
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
