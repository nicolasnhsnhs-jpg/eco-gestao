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
import { useTiposServico } from '../servicos/api'
import {
  COR_STATUS_OS,
  fichaDaOs,
  NOME_STATUS_OS,
  useOperadores,
  useOrdensServico,
  type CategoriaOs,
  type FiltroOs,
  type OsResumo,
  type StatusOs,
} from './api'
import { Veiculos } from './Veiculos'

type Periodo = 'hoje' | 'semana' | 'proximas' | 'passadas'

/**
 * As datas escolhidas valem mais que o período. Só uma das duas preenchida:
 * aquele dia. As duas: do "de" ao "até" (trocadas se vierem ao contrário).
 */
function datasEscolhidas(de: string, ate: string): { de: string; ate: string } | null {
  if (!de && !ate) return null
  if (!de || !ate) return { de: de || ate, ate: de || ate }
  return de <= ate ? { de, ate } : { de: ate, ate: de }
}

function filtroDoPeriodo(periodo: Periodo, datas: { de: string; ate: string } | null): FiltroOs {
  // Um período escolhido pode ter muitas OS: traz até 1000.
  if (datas) return { ...datas, limite: datas.de === datas.ate ? 200 : 1000 }
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
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [status, setStatus] = useState<StatusOs | ''>('')
  const [busca, setBusca] = useState('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [operadorId, setOperadorId] = useState('')
  const [categoria, setCategoria] = useState<CategoriaOs | ''>('')
  const [veiculosAberto, setVeiculosAberto] = useState(false)
  const operadores = useOperadores()
  const tipos = useTiposServico()
  const datas = datasEscolhidas(dataDe, dataAte)
  const dia = !!datas
  const lista = useOrdensServico({
    ...filtroDoPeriodo(periodo, datas),
    tipoId: tipoId || undefined,
    status: status || undefined,
    categoria: categoria || undefined,
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

  // Quantas OS cada operador tem no que está na tela (para escolher um e ver as dele).
  const porOperador = useMemo(() => {
    const contagem = new Map<string, { nome: string; qtd: number }>()
    for (const os of filtradas) {
      for (const o of os.operadores) {
        if (!o.operador) continue
        const linha = contagem.get(o.operador.id) ?? { nome: o.operador.nome, qtd: 0 }
        linha.qtd += 1
        contagem.set(o.operador.id, linha)
      }
    }
    return [...contagem].sort((a, b) => b[1].qtd - a[1].qtd || a[1].nome.localeCompare(b[1].nome))
  }, [filtradas])
  const nomeOperador = operadores.data?.find((o) => o.id === operadorId)?.nome
  const NOME_PERIODO: Record<Periodo, string> = {
    hoje: 'hoje',
    semana: 'nos próximos 7 dias',
    proximas: 'nas próximas datas',
    passadas: 'nas datas anteriores',
  }

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
        <Select
          aria-label="Contrato ou avulso"
          className="sm:w-auto"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaOs | '')}
        >
          <option value="">Contrato e avulso</option>
          <option value="contrato">Serviço de contrato</option>
          <option value="avulsa">Serviço avulso</option>
        </Select>
        <Select
          aria-label="Tipo de serviço"
          className="sm:w-auto"
          value={tipoId}
          onChange={(e) => setTipoId(e.target.value)}
        >
          <option value="">Todos os serviços</option>
          {tipos.data
            ?.filter((t) => t.ativo || t.id === tipoId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
        </Select>
        <label className="col-span-2 flex items-center gap-2 text-sm text-texto-suave sm:col-span-1">
          De
          <Input
            aria-label="Do dia"
            title="Primeiro dia (sozinho, mostra só esse dia; vale mais que o período)"
            className="min-w-0 flex-1 sm:w-auto sm:flex-none"
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
          />
          até
          <Input
            aria-label="Até o dia"
            title="Último dia do período"
            className="min-w-0 flex-1 sm:w-auto sm:flex-none"
            type="date"
            value={dataAte}
            min={dataDe || undefined}
            onChange={(e) => setDataAte(e.target.value)}
          />
        </label>
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
        {(filtrando || dia || categoria || tipoId) && (
          <Button
            variante="fantasma"
            onClick={() => {
              setBusca('')
              setDataDe('')
              setDataAte('')
              setTipoId('')
              setOperadorId('')
              setCategoria('')
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {lista.isPending && <Carregando />}
      {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}
      {lista.isSuccess && filtradas.length > 0 && (
        <div className="mb-3 flex flex-col gap-1 rounded-2xl border border-borda bg-white p-4">
          <p>
            <strong className="text-lg text-verde-escuro">{filtradas.length}</strong>{' '}
            {filtradas.length === 1 ? 'OS emitida' : 'OS emitidas'}
            {nomeOperador && (
              <>
                {' '}
                para <strong>{nomeOperador}</strong>
              </>
            )}{' '}
            {datas ? (
              datas.de === datas.ate ? (
                <>
                  em <strong>{formatarData(datas.de)}</strong>
                </>
              ) : (
                <>
                  de <strong>{formatarData(datas.de)}</strong> a{' '}
                  <strong>{formatarData(datas.ate)}</strong>
                </>
              )
            ) : (
              NOME_PERIODO[periodo]
            )}
            {tipoId && ` · ${tipos.data?.find((t) => t.id === tipoId)?.nome ?? ''}`}
            {status && ` · ${NOME_STATUS_OS[status]}`}
            {categoria &&
              ` · ${categoria === 'contrato' ? 'serviço de contrato' : 'serviço avulso'}`}
          </p>
          {!operadorId && porOperador.length > 1 && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-texto-suave">
              {porOperador.map(([id, o]) => (
                <button
                  key={id}
                  type="button"
                  className="underline hover:text-verde"
                  onClick={() => setOperadorId(id)}
                >
                  {o.nome}: <strong className="text-texto">{o.qtd}</strong>
                </button>
              ))}
            </p>
          )}
        </div>
      )}
      {lista.isSuccess && filtradas.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          {filtrando || categoria || tipoId
            ? 'Nenhuma OS encontrada com esses filtros.'
            : datas
              ? datas.de === datas.ate
                ? 'Nenhuma OS neste dia.'
                : 'Nenhuma OS neste período.'
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
        {os.implantacao && <Etiqueta cor="verde">Implantação</Etiqueta>}
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
