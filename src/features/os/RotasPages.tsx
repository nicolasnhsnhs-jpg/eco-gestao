import { ArrowDown, ArrowUp, CalendarPlus, Plus, Route, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import {
  useAgendarRota,
  useCriarRota,
  useModelos,
  useOperadores,
  usePorNaRota,
  useRota,
  useRotas,
  useTirarDaRota,
  useTrocarOrdemRota,
  useVeiculos,
  type RotaCompleta,
} from './api'
import { contagemPontos, filtrarModelos, nomeCliente, nomeUnidade } from './modelosUtil'
import { nomeVeiculo } from './nomeVeiculo'

/*
 * Rotas: as O.S de contrato agrupadas por rota de visita (ex.: "Gravataí A"), em
 * ordem. Quem agenda escolhe o dia, confere cada uma, põe as observações e gera
 * todas as visitas de uma vez.
 */

/** Aba "Rotas" da tela de O.S salvas. */
export function RotasLista() {
  const rotas = useRotas()
  const criar = useCriarRota()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const termo = busca.trim().toLowerCase()
  const lista = rotas.data?.filter((r) => !termo || r.nome.toLowerCase().includes(termo)) ?? []

  async function nova(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      const id = await criar.mutateAsync(nome.trim())
      navigate(`/os/rotas/${id}`)
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <>
      <form onSubmit={nova} className="mb-4 flex gap-2">
        <Input
          aria-label="Nome da nova rota"
          placeholder="Nova rota (ex.: Gravataí A)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Button type="submit" disabled={!nome.trim() || criar.isPending}>
          <Plus className="size-5" aria-hidden /> Criar
        </Button>
      </form>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <input
        aria-label="Buscar rota"
        placeholder="Buscar rota…"
        className="mb-4 min-h-11 w-full rounded-xl border border-borda bg-white px-3"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {rotas.isPending && <Carregando />}
      {rotas.isError && <Aviso tipo="erro">{mensagemDeErro(rotas.error)}</Aviso>}
      {rotas.isSuccess && lista.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          Nenhuma rota.
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {lista.map((r) => (
          <li key={r.id}>
            <Link
              to={`/os/rotas/${r.id}`}
              className="flex items-center gap-3 rounded-2xl border border-borda bg-white p-4 hover:border-verde"
            >
              <Route className="size-5 shrink-0 text-verde" aria-hidden />
              <span className="font-semibold text-verde-escuro">{r.nome}</span>
              <span className="ml-auto text-sm text-texto-suave">{r.itens.length} O.S</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

export function RotaPage() {
  const { id = '' } = useParams()
  const rota = useRota(id)

  if (rota.isPending) return <Carregando />
  if (rota.isError) return <Aviso tipo="erro">{mensagemDeErro(rota.error)}</Aviso>
  if (!rota.data) return <Aviso tipo="erro">Rota não encontrada.</Aviso>
  return <Rota key={rota.data.id} rota={rota.data} />
}

function Rota({ rota }: { rota: RotaCompleta }) {
  const itens = rota.itens.filter((i) => i.modelo?.ativo)
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(itens.map((i) => i.modelo!.id)),
  )
  const [obs, setObs] = useState<Record<string, string>>({})
  const tirar = useTirarDaRota()
  const trocar = useTrocarOrdemRota()
  const [erro, setErro] = useState<string | null>(null)

  const alternar = (modeloId: string, sim: boolean) =>
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (sim) novo.add(modeloId)
      else novo.delete(modeloId)
      return novo
    })

  async function acao(f: () => Promise<unknown>) {
    setErro(null)
    try {
      await f()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <>
      <PageHeader
        titulo={rota.nome}
        descricao={`Rota · ${itens.length} O.S de contrato`}
        acoes={
          <Link to="/os/modelos?aba=rotas">
            <Button variante="secundario">Todas as rotas</Button>
          </Link>
        }
      />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-titulo text-lg font-bold text-verde-escuro">O.S da rota</h2>
              {itens.length > 0 && (
                <Button
                  variante="fantasma"
                  className="min-h-9"
                  onClick={() =>
                    setMarcados(
                      marcados.size === itens.length
                        ? new Set()
                        : new Set(itens.map((i) => i.modelo!.id)),
                    )
                  }
                >
                  {marcados.size === itens.length ? 'Desmarcar todas' : 'Marcar todas'}
                </Button>
              )}
            </div>
            {itens.length === 0 && (
              <p className="text-texto-suave">Nenhuma O.S nesta rota ainda. Adicione abaixo.</p>
            )}
            <ol className="flex flex-col gap-2">
              {itens.map((item, i) => {
                const m = item.modelo!
                const contagem = contagemPontos(m.pontos)
                const marcado = marcados.has(m.id)
                return (
                  <li
                    key={item.id}
                    className={`flex flex-col gap-2 rounded-xl border p-3 ${marcado ? 'border-verde' : 'border-borda opacity-70'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Agendar ${nomeCliente(m.cliente)}`}
                        className="mt-1 size-5 shrink-0 accent-verde"
                        checked={marcado}
                        onChange={(e) => alternar(m.id, e.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/os/modelos/${m.id}`}
                          className="font-semibold text-verde-escuro hover:underline"
                        >
                          {i + 1}. {nomeCliente(m.cliente)}
                          {nomeUnidade(m.endereco) && ` · ${nomeUnidade(m.endereco)}`}
                        </Link>
                        <p className="text-sm text-texto-suave">
                          {m.tipo?.nome}
                          {contagem.length > 0 && ` · ${contagem.join(' · ')}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variante="fantasma"
                          className="min-h-9 px-2"
                          title="Subir"
                          disabled={i === 0 || trocar.isPending}
                          onClick={() => void acao(() => trocar.mutateAsync([item, itens[i - 1]]))}
                        >
                          <ArrowUp className="size-4" aria-hidden />
                          <span className="sr-only">Subir</span>
                        </Button>
                        <Button
                          variante="fantasma"
                          className="min-h-9 px-2"
                          title="Descer"
                          disabled={i === itens.length - 1 || trocar.isPending}
                          onClick={() => void acao(() => trocar.mutateAsync([item, itens[i + 1]]))}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                          <span className="sr-only">Descer</span>
                        </Button>
                        <Button
                          variante="fantasma"
                          className="min-h-9 px-2"
                          title="Tirar da rota"
                          disabled={tirar.isPending}
                          onClick={() => {
                            if (confirm(`Tirar ${nomeCliente(m.cliente)} desta rota?`))
                              void acao(() => tirar.mutateAsync(item.id))
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only">Tirar da rota</span>
                        </Button>
                      </div>
                    </div>
                    {marcado && (
                      <Textarea
                        aria-label={`Observações para ${nomeCliente(m.cliente)}`}
                        rows={2}
                        placeholder={
                          m.observacoes_adm_padrao
                            ? 'Observação a mais só desta visita (as fixas já vão junto)'
                            : 'Observações desta visita (opcional)'
                        }
                        value={obs[m.id] ?? ''}
                        onChange={(e) => setObs((o) => ({ ...o, [m.id]: e.target.value }))}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </Card>
          <AdicionarNaRota rota={rota} />
        </div>

        <AgendarRota
          modelos={itens
            .filter((i) => marcados.has(i.modelo!.id))
            .map((i) => ({ id: i.modelo!.id, fixas: i.modelo!.observacoes_adm_padrao }))}
          obs={obs}
        />
      </div>
    </>
  )
}

function AdicionarNaRota({ rota }: { rota: RotaCompleta }) {
  const modelos = useModelos('contrato')
  const por = usePorNaRota(rota.id)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const naRota = new Set(rota.itens.map((i) => i.modelo?.id))
  const proxima = Math.max(0, ...rota.itens.map((i) => i.ordem)) + 1
  const lista = busca.trim()
    ? filtrarModelos(modelos.data ?? [], busca)
        .filter((m) => !naRota.has(m.id))
        .slice(0, 15)
    : []

  async function adicionar(modeloId: string) {
    setErro(null)
    try {
      await por.mutateAsync({ modeloId, ordem: proxima })
      setBusca('')
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">Adicionar O.S na rota</h2>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Input
        aria-label="Buscar O.S de contrato"
        placeholder="Nome fantasia, razão social ou CNPJ…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {modelos.isPending && busca && <Carregando />}
      <ul className="flex flex-col gap-1">
        {lista.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={por.isPending}
              onClick={() => void adicionar(m.id)}
              className="flex w-full items-center gap-2 rounded-xl border border-borda bg-white p-3 text-left hover:border-verde"
            >
              <Plus className="size-4 shrink-0 text-verde" aria-hidden />
              <span className="min-w-0">
                <span className="font-semibold">{nomeCliente(m.cliente)}</span>
                {nomeUnidade(m.endereco) && ` · ${nomeUnidade(m.endereco)}`}
                <span className="block text-sm text-texto-suave">{m.tipo?.nome}</span>
              </span>
            </button>
          </li>
        ))}
        {busca.trim() && modelos.isSuccess && lista.length === 0 && (
          <li className="text-sm text-texto-suave">Nenhuma O.S de contrato encontrada.</li>
        )}
      </ul>
    </Card>
  )
}

function AgendarRota({
  modelos,
  obs,
}: {
  modelos: { id: string; fixas: string | null }[]
  obs: Record<string, string>
}) {
  const operadores = useOperadores()
  const veiculos = useVeiculos()
  const agendar = useAgendarRota()
  const [data, setData] = useState(hojeISO())
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [veiculoId, setVeiculoId] = useState('')
  const [resultado, setResultado] = useState<{ criadas: number; erros: string[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar() {
    setErro(null)
    setResultado(null)
    if (
      !confirm(
        `Agendar ${modelos.length} visita${modelos.length === 1 ? '' : 's'} para ${data.split('-').reverse().join('/')}?`,
      )
    )
      return
    try {
      const r = await agendar.mutateAsync({
        data,
        operadores: escolhidos,
        veiculoId: veiculoId || null,
        // Observações da visita entram junto com as fixas do cliente.
        itens: modelos.map((m) => ({
          modeloId: m.id,
          observacoesAdm: [m.fixas?.trim(), obs[m.id]?.trim()].filter(Boolean).join('\n'),
        })),
      })
      setResultado({ criadas: r.criadas.length, erros: r.erros })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <Card className="flex flex-col gap-4 lg:sticky lg:top-4">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">Agendar a rota</h2>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {resultado && (
        <Aviso tipo={resultado.erros.length ? 'erro' : 'sucesso'}>
          {resultado.criadas} OS agendada{resultado.criadas === 1 ? '' : 's'}.{' '}
          <Link className="font-semibold underline" to="/os">
            Ver agenda
          </Link>
          {resultado.erros.length > 0 && (
            <span className="mt-1 block">
              {resultado.erros.length} não saíram: {resultado.erros.join(' · ')}
            </span>
          )}
        </Aviso>
      )}
      <Campo rotulo="Data" htmlFor="rota-data" obrigatorio>
        <Input id="rota-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">Operadores</legend>
        <p className="mb-1 text-sm text-texto-suave">
          Nenhum marcado: cada O.S sai com os operadores de costume dela.
        </p>
        {operadores.data?.map((o) => (
          <label key={o.id} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-verde"
              checked={escolhidos.includes(o.id)}
              onChange={(e) =>
                setEscolhidos((atual) =>
                  e.target.checked ? [...atual, o.id] : atual.filter((x) => x !== o.id),
                )
              }
            />
            {o.nome}
          </label>
        ))}
      </fieldset>
      <Campo rotulo="Veículo" htmlFor="rota-veiculo">
        <Select id="rota-veiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
          <option value="">O de costume de cada O.S</option>
          {veiculos.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {nomeVeiculo(v)}
            </option>
          ))}
        </Select>
      </Campo>
      <Button
        disabled={modelos.length === 0 || !data || agendar.isPending}
        onClick={() => void enviar()}
      >
        <CalendarPlus className="size-5" aria-hidden />
        {agendar.isPending ? 'Agendando…' : `Agendar ${modelos.length} O.S`}
      </Button>
    </Card>
  )
}
