import { CalendarPlus, ChevronRight, Pencil, Plus, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import {
  COR_STATUS_SERVICO,
  NOME_STATUS_SERVICO,
  useSalvarTipoServico,
  useServicos,
  useTiposServico,
  useVencimentos,
  type ServicoResumo,
  type TipoServico,
} from './api'
import { ListaVencimentos } from './Vencimentos'

/** Abas da área de serviços. */
export function ServicosLayout() {
  const perfil = usePerfil()
  const abas = [
    { rotulo: 'Agenda', caminho: '/servicos', fim: true },
    { rotulo: 'Vencimentos', caminho: '/servicos/vencimentos', fim: false },
    ...(PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
      ? [{ rotulo: 'Tipos de serviço', caminho: '/servicos/tipos', fim: false }]
      : []),
  ]
  return (
    <>
      <nav
        aria-label="Serviços"
        className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1"
      >
        {abas.map((aba) => (
          <NavLink
            key={aba.caminho}
            to={aba.caminho}
            end={aba.fim}
            className={({ isActive }) =>
              cn(
                'flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap',
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

// -----------------------------------------------------------------------------
// Agenda
// -----------------------------------------------------------------------------

export function AgendaPage() {
  const hoje = hojeISO()
  const agendados = useServicos({ status: 'agendado' })
  const feitos = useServicos({ status: 'realizado', de: somarDias(hoje, -60) })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Serviços</h1>
        <div className="flex gap-2">
          <Link
            to="/servicos/novo"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden /> Registrar feito
          </Link>
          <Link
            to="/servicos/novo?status=agendado"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <CalendarPlus className="size-5" aria-hidden /> Agendar
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold">Agendados</h2>
        {agendados.isPending && <Carregando />}
        {agendados.isError && <Aviso tipo="erro">{mensagemDeErro(agendados.error)}</Aviso>}
        {agendados.data?.length === 0 && (
          <Card className="text-sm text-texto-suave">Nenhum serviço agendado.</Card>
        )}
        {!!agendados.data?.length && <ListaServicos servicos={agendados.data} mostrarCliente />}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Feitos nos últimos 60 dias</h2>
        {feitos.isPending && <Carregando />}
        {feitos.data?.length === 0 && (
          <Card className="text-sm text-texto-suave">Nenhum serviço registrado no período.</Card>
        )}
        {!!feitos.data?.length && <ListaServicos servicos={feitos.data} mostrarCliente />}
      </section>
    </div>
  )
}

/** Lista de serviços (agenda, ficha do cliente e proposta). */
export function ListaServicos({
  servicos,
  mostrarCliente,
  semBorda,
}: {
  servicos: ServicoResumo[]
  mostrarCliente?: boolean
  semBorda?: boolean
}) {
  const hoje = hojeISO()
  return (
    <ul
      className={cn(
        'divide-y divide-borda overflow-hidden bg-white',
        !semBorda && 'rounded-2xl border border-borda',
      )}
    >
      {servicos.map((s) => (
        <li key={s.id}>
          <Link
            to={`/servicos/${s.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-fundo-suave"
          >
            <Wrench className="size-5 shrink-0 text-verde" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {s.tipo?.nome}
                {mostrarCliente && ` · ${s.cliente?.nome_fantasia || s.cliente?.nome}`}
              </p>
              <p className="truncate text-sm text-texto-suave">
                {[
                  formatarData(s.data_execucao) +
                    (s.status === 'agendado' && s.data_execucao < hoje ? ' (passou da data)' : ''),
                  s.endereco?.apelido || s.endereco?.cidade,
                  s.numero_certificado && `cert. ${s.numero_certificado}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {s.valor != null && <strong className="text-sm">{formatarReais(s.valor)}</strong>}
              <Etiqueta cor={COR_STATUS_SERVICO[s.status]}>
                {NOME_STATUS_SERVICO[s.status]}
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
// Vencimentos
// -----------------------------------------------------------------------------

const JANELAS = [
  { valor: '30', rotulo: 'Vencidos e próximos 30 dias' },
  { valor: '90', rotulo: 'Até 90 dias' },
  { valor: 'todos', rotulo: 'Todos' },
]

export function VencimentosPage() {
  const [janela, setJanela] = useState('30')
  const vencimentos = useVencimentos({ ateDias: janela === 'todos' ? undefined : Number(janela) })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Vencimentos</h1>
        <Select
          aria-label="Período"
          className="w-auto"
          value={janela}
          onChange={(e) => setJanela(e.target.value)}
        >
          {JANELAS.map((j) => (
            <option key={j.valor} value={j.valor}>
              {j.rotulo}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-texto-suave">
        Calculados a partir do último serviço feito em cada endereço. Os vendedores recebem um aviso
        antes de vencer, para entrar em contato com o cliente.
      </p>
      {vencimentos.isPending && <Carregando />}
      {vencimentos.isError && <Aviso tipo="erro">{mensagemDeErro(vencimentos.error)}</Aviso>}
      {vencimentos.data?.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">Nenhum vencimento neste período.</Card>
      )}
      {!!vencimentos.data?.length && (
        <Card className="py-1">
          <ListaVencimentos vencimentos={vencimentos.data} mostrarCliente />
        </Card>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Tipos de serviço (catálogo)
// -----------------------------------------------------------------------------

export function TiposServicoPage() {
  const tipos = useTiposServico()
  const [editando, setEditando] = useState<TipoServico | null | undefined>(undefined)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tipos de serviço</h1>
        <Button variante="secundario" onClick={() => setEditando(null)}>
          <Plus className="size-4" aria-hidden /> Novo tipo
        </Button>
      </div>
      <p className="text-sm text-texto-suave">
        A periodicidade daqui é o padrão. Cada cliente pode ter a sua, ajustada na ficha dele.
      </p>
      {tipos.isPending && <Carregando />}
      <Card className="py-1">
        <ul className="divide-y divide-borda">
          {tipos.data?.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {t.nome}
                  {!t.ativo && <Etiqueta>Inativo</Etiqueta>}
                </p>
                <p className="text-sm text-texto-suave">
                  {t.periodicidade_meses_padrao
                    ? `A cada ${t.periodicidade_meses_padrao} meses · ${
                        t.tipo_vencimento === 'certificado' ? 'certificado vence' : 'recomendação'
                      } · avisa ${t.antecedencia_aviso_dias_padrao} dias antes`
                    : 'Sem repetição'}
                </p>
              </div>
              <BotaoIcone rotulo={`Editar ${t.nome}`} onClick={() => setEditando(t)}>
                <Pencil className="size-4" />
              </BotaoIcone>
            </li>
          ))}
        </ul>
      </Card>
      <Modal
        aberto={editando !== undefined}
        aoFechar={() => setEditando(undefined)}
        titulo={editando ? `Editar ${editando.nome}` : 'Novo tipo de serviço'}
      >
        <FormTipo tipo={editando ?? null} aoTerminar={() => setEditando(undefined)} />
      </Modal>
    </div>
  )
}

function FormTipo({ tipo, aoTerminar }: { tipo: TipoServico | null; aoTerminar: () => void }) {
  const salvar = useSalvarTipoServico()
  const [nome, setNome] = useState(tipo?.nome ?? '')
  const [periodicidade, setPeriodicidade] = useState(
    tipo?.periodicidade_meses_padrao?.toString() ?? '',
  )
  const [tipoVencimento, setTipoVencimento] = useState(tipo?.tipo_vencimento ?? 'certificado')
  const [antecedencia, setAntecedencia] = useState(
    String(tipo?.antecedencia_aviso_dias_padrao ?? 30),
  )
  const [ativo, setAtivo] = useState(tipo?.ativo ?? true)
  const repete = periodicidade.trim() !== ''
  const valido =
    nome.trim().length >= 2 &&
    (!repete || (/^\d+$/.test(periodicidade) && +periodicidade >= 1 && +periodicidade <= 60)) &&
    /^\d+$/.test(antecedencia)

  async function enviar() {
    try {
      await salvar.mutateAsync({
        id: tipo?.id,
        dados: {
          nome: nome.trim(),
          periodicidade_meses_padrao: repete ? Number(periodicidade) : null,
          tipo_vencimento: repete ? tipoVencimento : null,
          antecedencia_aviso_dias_padrao: Number(antecedencia),
          ativo,
        },
      })
      aoTerminar()
    } catch {
      // Mostrado abaixo.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
      <Campo rotulo="Nome" htmlFor="tipo-nome" obrigatorio>
        <Input id="tipo-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Repetir a cada (meses)" htmlFor="tipo-periodo" dica="Vazio = não se repete.">
          <Input
            id="tipo-periodo"
            inputMode="numeric"
            value={periodicidade}
            onChange={(e) => setPeriodicidade(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Avisar dias antes" htmlFor="tipo-antes">
          <Input
            id="tipo-antes"
            inputMode="numeric"
            value={antecedencia}
            onChange={(e) => setAntecedencia(e.target.value)}
          />
        </Campo>
      </div>
      {repete && (
        <Campo rotulo="Tipo de vencimento" htmlFor="tipo-venc">
          <Select
            id="tipo-venc"
            value={tipoVencimento}
            onChange={(e) => setTipoVencimento(e.target.value as 'certificado' | 'recomendacao')}
          >
            <option value="certificado">O certificado vence</option>
            <option value="recomendacao">Recomendação de refazer</option>
          </Select>
        </Campo>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-verde"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        Ativo
      </label>
      <Button disabled={!valido || salvar.isPending} onClick={() => void enviar()}>
        {salvar.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </div>
  )
}
