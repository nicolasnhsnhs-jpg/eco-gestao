import { Car, ClipboardList, GraduationCap, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_GESTAO } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import {
  COR_STATUS_OS,
  fichaDaOs,
  NOME_STATUS_OS,
  useOperadores,
  useOrdensServico,
  type FiltroOs,
  type OsResumo,
  type StatusOs,
} from './api'
import { Veiculos } from './Veiculos'

type Periodo = 'hoje' | 'semana' | 'proximas' | 'passadas'

function filtroDoPeriodo(periodo: Periodo, dia: string): FiltroOs {
  // Um dia escolhido vale mais que o período.
  if (dia) return { de: dia, ate: dia }
  const hoje = hojeISO()
  if (periodo === 'hoje') return { de: hoje, ate: hoje }
  if (periodo === 'semana') return { de: hoje, ate: somarDias(hoje, 7) }
  if (periodo === 'proximas') return { de: hoje }
  return { ate: somarDias(hoje, -1), recentesPrimeiro: true }
}

/** Sem acento e em minúsculas, para a busca pelo nome. */
const simplificar = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function OsListaPage() {
  const perfil = usePerfil()
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [status, setStatus] = useState<StatusOs | ''>('')
  const [busca, setBusca] = useState('')
  const [dia, setDia] = useState('')
  const [operadorId, setOperadorId] = useState('')
  const [veiculosAberto, setVeiculosAberto] = useState(false)
  const operadores = useOperadores()
  const lista = useOrdensServico({
    ...filtroDoPeriodo(periodo, dia),
    status: status || undefined,
    treinamento: false,
  })
  // Nome e operador filtram o que já veio do período (no máximo 200 OS).
  const filtradas = useMemo(() => {
    const termo = simplificar(busca.trim())
    return (lista.data ?? []).filter((os) => {
      if (operadorId && !os.operadores.some((o) => o.operador?.id === operadorId)) return false
      if (!termo) return true
      const ficha = fichaDaOs(os.ficha_cliente)
      return simplificar(
        [ficha.nome, ficha.nome_fantasia, ficha.unidade?.apelido, os.numero].join(' '),
      ).includes(termo)
    })
  }, [lista.data, busca, operadorId])
  const filtrando = !!busca.trim() || !!operadorId

  return (
    <>
      <PageHeader
        titulo="Ordens de serviço"
        descricao="Agende as visitas e acompanhe o que os operadores fizeram em campo."
        acoes={
          <>
            {PAPEIS_GESTAO.includes(perfil.papel) && (
              <Button variante="secundario" onClick={() => setVeiculosAberto(true)}>
                <Car className="size-5" aria-hidden /> Veículos
              </Button>
            )}
            {PAPEIS_GESTAO.includes(perfil.papel) && (
              <Link to="/os/treinamento">
                <Button variante="secundario">
                  <GraduationCap className="size-5" aria-hidden /> Treinamento
                </Button>
              </Link>
            )}
            <Link to="/os/modelos">
              <Button variante="secundario">
                <ClipboardList className="size-5" aria-hidden /> O.S salvas e rotas
              </Button>
            </Link>
            <Link to="/os/nova">
              <Button>
                <Plus className="size-5" aria-hidden /> Nova OS
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Input
          aria-label="Buscar pelo nome"
          className="col-span-2 sm:w-64"
          type="search"
          placeholder="Buscar pelo nome do cliente…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select
          aria-label="Período"
          className="sm:w-auto"
          value={periodo}
          disabled={!!dia}
          onChange={(e) => setPeriodo(e.target.value as Periodo)}
        >
          <option value="hoje">Hoje</option>
          <option value="semana">Próximos 7 dias</option>
          <option value="proximas">Todas as próximas</option>
          <option value="passadas">Anteriores</option>
        </Select>
        <Select
          aria-label="Situação"
          className="sm:w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusOs | '')}
        >
          <option value="">Todas as situações</option>
          {Object.entries(NOME_STATUS_OS).map(([valor, nome]) => (
            <option key={valor} value={valor}>
              {nome}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Dia"
          title="Dia da OS (vale mais que o período)"
          className="sm:w-auto"
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
        />
        <Select
          aria-label="Operador"
          className="sm:w-auto"
          value={operadorId}
          onChange={(e) => setOperadorId(e.target.value)}
        >
          <option value="">Todos os operadores</option>
          {operadores.data?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </Select>
        {(filtrando || dia) && (
          <Button
            variante="fantasma"
            onClick={() => {
              setBusca('')
              setDia('')
              setOperadorId('')
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {lista.isPending && <Carregando />}
      {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}
      {lista.isSuccess && filtradas.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          {filtrando
            ? 'Nenhuma OS encontrada com esses filtros.'
            : dia
              ? 'Nenhuma OS neste dia.'
              : 'Nenhuma OS neste período.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtradas.map((os) => (
          <li key={os.id}>
            <CartaoOs os={os} para={`/os/${os.id}`} />
          </li>
        ))}
      </ul>

      <Modal aberto={veiculosAberto} aoFechar={() => setVeiculosAberto(false)} titulo="Veículos">
        <Veiculos />
      </Modal>
    </>
  )
}

/** Cartão de uma OS na lista (usado também na tela do operador). */
export function CartaoOs({ os, para }: { os: OsResumo; para: string }) {
  const ficha = fichaDaOs(os.ficha_cliente)
  const operadores = os.operadores.map((o) => o.operador?.nome).filter(Boolean)
  return (
    <Link
      to={para}
      className="flex flex-col gap-1 rounded-2xl border border-borda bg-white p-4 hover:border-verde"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-verde-escuro">
          {formatarData(os.data_agendada)}
          {os.hora_agendada && ` às ${os.hora_agendada.slice(0, 5)}`}
        </span>
        <Etiqueta cor={COR_STATUS_OS[os.status]}>{NOME_STATUS_OS[os.status]}</Etiqueta>
        {os.treinamento && <Etiqueta cor="perigo">Teste (treinamento)</Etiqueta>}
        <EtiquetasConferencia os={os} />
        <span className="ml-auto text-sm text-texto-suave">{os.numero}</span>
      </div>
      <p className="font-semibold">
        {ficha.nome_fantasia || ficha.nome}
        {ficha.unidade?.apelido && ` · ${ficha.unidade.apelido}`}
      </p>
      <p className="text-sm text-texto-suave">
        {os.tipo?.nome}
        {operadores.length > 0 && ` · ${operadores.join(', ')}`}
      </p>
    </Link>
  )
}

/**
 * Controle interno do escritório ao lado da situação: o que já foi conferido
 * (certificado, cronograma, OK para o financeiro). O operador não recebe a
 * conferência do banco, então para ele não aparece nada.
 */
function EtiquetasConferencia({ os }: { os: OsResumo }) {
  const c = Array.isArray(os.conferencia) ? os.conferencia[0] : os.conferencia
  if (!c || (os.status !== 'concluida' && os.status !== 'conferida')) return null
  const sim = (valor: boolean | null, rotulo: string) =>
    valor == null ? null : (
      <Etiqueta cor={valor ? 'verde' : 'alerta'}>
        {rotulo} {valor ? 'ok' : 'não'}
      </Etiqueta>
    )
  return (
    <>
      {sim(c.cronograma, 'Cronograma')}
      {sim(c.certificado, 'Certificado')}
      {c.taxa_faturada ? (
        <Etiqueta cor="verde">Faturada</Etiqueta>
      ) : c.liberada_financeiro_em ? (
        <Etiqueta cor="verde">Enviado ao financeiro ok</Etiqueta>
      ) : null}
    </>
  )
}
