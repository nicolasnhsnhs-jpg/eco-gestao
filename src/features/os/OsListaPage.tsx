import { Car, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import {
  COR_STATUS_OS,
  fichaDaOs,
  NOME_STATUS_OS,
  useOrdensServico,
  type FiltroOs,
  type OsResumo,
  type StatusOs,
} from './api'
import { Veiculos } from './Veiculos'

type Periodo = 'hoje' | 'semana' | 'proximas' | 'passadas'

function filtroDoPeriodo(periodo: Periodo): FiltroOs {
  const hoje = hojeISO()
  if (periodo === 'hoje') return { de: hoje, ate: hoje }
  if (periodo === 'semana') return { de: hoje, ate: somarDias(hoje, 7) }
  if (periodo === 'proximas') return { de: hoje }
  return { ate: somarDias(hoje, -1) }
}

export function OsListaPage() {
  const perfil = usePerfil()
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [status, setStatus] = useState<StatusOs | ''>('')
  const [veiculosAberto, setVeiculosAberto] = useState(false)
  const lista = useOrdensServico({ ...filtroDoPeriodo(periodo), status: status || undefined })

  return (
    <>
      <PageHeader
        titulo="Ordens de serviço"
        descricao="Agende as visitas e acompanhe o que os operadores fizeram em campo."
        acoes={
          <>
            {PAPEIS_ACESSO_TOTAL.includes(perfil.papel) && (
              <Button variante="secundario" onClick={() => setVeiculosAberto(true)}>
                <Car className="size-5" aria-hidden /> Veículos
              </Button>
            )}
            <Link to="/os/nova">
              <Button>
                <Plus className="size-5" aria-hidden /> Nova OS
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex">
        <Select
          aria-label="Período"
          className="sm:w-auto"
          value={periodo}
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
      </div>

      {lista.isPending && <Carregando />}
      {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}
      {lista.data?.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          Nenhuma OS neste período.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {lista.data?.map((os) => (
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
