import { ArrowLeftRight, CalendarPlus, ClipboardList, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'
import { useValorAtrasado } from '@/lib/useValorAtrasado'

import { useCliente } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import {
  useCriarModelo,
  useModelo,
  useModeloPorId,
  useListaModelos,
  useOperadores,
  useSalvarModelo,
  useVeiculos,
  type CategoriaOs,
  type ModeloCompleto,
} from './api'
import { contagemPontos, linkAgendar, nomeCliente, nomeUnidade } from './modelosUtil'
import { RotasLista } from './RotasPages'
import { SeletorCategoria } from './SeletorCategoria'
import { nomeVeiculo } from './nomeVeiculo'
import { EscopoBebedouro } from './EscopoBebedouro'
import { EscopoCoifa } from './EscopoCoifa'
import { EscopoPragas } from './EscopoPragas'

/*
 * O.S de contrato: o modelo de um local (cliente + unidade + serviço) montado pelo
 * escritório, com os porta-iscas, as armadilhas e as coifas. Cada visita agendada
 * copia este modelo; o operador só anota a execução.
 */

type Aba = CategoriaOs | 'rotas'
const ABAS: { valor: Aba; nome: string }[] = [
  { valor: 'contrato', nome: 'O.S de contrato' },
  { valor: 'avulsa', nome: 'O.S avulsas' },
  { valor: 'rotas', nome: 'Rotas' },
]

export function ModelosOsPage() {
  const [parametros, setParametros] = useSearchParams()
  const aba: Aba = ABAS.find((a) => a.valor === parametros.get('aba'))?.valor ?? 'contrato'

  return (
    <>
      <PageHeader
        titulo="O.S salvas"
        descricao="Procure o cliente pelo nome fantasia, razão social ou CNPJ e agende a próxima visita a partir da O.S dele."
        acoes={
          aba !== 'rotas' && (
            <Link to={`/os/modelos/novo?categoria=${aba}`}>
              <Button>
                <Plus className="size-5" aria-hidden /> Montar O.S
              </Button>
            </Link>
          )
        }
      />
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            role="tab"
            aria-selected={aba === a.valor}
            onClick={() => setParametros({ aba: a.valor }, { replace: true })}
            className={`min-h-10 flex-1 rounded-lg px-3 font-semibold whitespace-nowrap ${
              aba === a.valor ? 'bg-verde text-white' : 'text-texto-suave hover:text-verde-escuro'
            }`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      {aba === 'rotas' ? <RotasLista /> : <ListaModelos key={aba} categoria={aba} />}
    </>
  )
}

function ListaModelos({ categoria }: { categoria: CategoriaOs }) {
  const [busca, setBusca] = useState('')
  const termo = useValorAtrasado(busca.trim())
  const modelos = useListaModelos(categoria, termo)
  const lista = modelos.data?.pages.flat() ?? []

  // Quando o fim da lista aparece na tela, já pede as próximas 20.
  const fimDaLista = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = modelos
  useEffect(() => {
    const alvo = fimDaLista.current
    if (!alvo || !hasNextPage) return
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '400px' },
    )
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <>
      <input
        aria-label="Buscar"
        placeholder="Buscar por nome fantasia, razão social, CNPJ ou serviço…"
        className="mb-4 min-h-11 w-full rounded-xl border border-borda bg-white px-3"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {modelos.isPending && <Carregando />}
      {modelos.isError && <Aviso tipo="erro">{mensagemDeErro(modelos.error)}</Aviso>}
      {modelos.isSuccess && lista.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          {busca
            ? 'Nada encontrado.'
            : `Nenhuma O.S ${categoria === 'contrato' ? 'de contrato' : 'avulsa'} salva.`}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {lista.map((m) => {
          const contagem = contagemPontos(m.contagem)
          return (
            <li key={m.id} className="flex items-stretch gap-2">
              <Link
                to={`/os/modelos/${m.id}`}
                className="flex min-w-0 flex-1 flex-col gap-1 rounded-2xl border border-borda bg-white p-4 hover:border-verde"
              >
                <p className="font-semibold text-verde-escuro">
                  {nomeCliente(m.cliente)}
                  {nomeUnidade(m.endereco) && ` · ${nomeUnidade(m.endereco)}`}
                </p>
                <p className="text-sm text-texto-suave">
                  {m.tipo?.nome}
                  {contagem.length > 0 && ` · ${contagem.join(' · ')}`}
                </p>
              </Link>
              <Link
                to={linkAgendar({
                  categoria: m.categoria,
                  cliente_id: m.cliente?.id,
                  endereco_id: m.endereco?.id ?? null,
                  tipo_servico_id: m.tipo?.id,
                })}
                title="Agendar nova visita com esta O.S"
                className="grid w-14 shrink-0 place-items-center rounded-2xl border border-borda bg-white text-verde hover:border-verde"
              >
                <CalendarPlus className="size-5" aria-hidden />
                <span className="sr-only">Agendar nova visita</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div ref={fimDaLista} />
      {isFetchingNextPage && <Carregando />}
    </>
  )
}

/** Escolhe cliente → unidade → serviço e cria o modelo, sem agendar visita. */
export function ModeloNovoPage() {
  const navigate = useNavigate()
  const [parametros] = useSearchParams()
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null)
  const [enderecoId, setEnderecoId] = useState(parametros.get('unidade') ?? '')
  const [tipoId, setTipoId] = useState(parametros.get('tipo') ?? '')
  const [categoria, setCategoria] = useState<CategoriaOs | ''>(
    (['contrato', 'avulsa'] as const).find((c) => c === parametros.get('categoria')) ?? '',
  )
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const tipos = useTiposServico()
  const criar = useCriarModelo()

  const clienteId = cliente?.id ?? parametros.get('cliente') ?? ''
  const dadosCliente = useCliente(clienteId)
  const enderecos = dadosCliente.data?.enderecos.filter((e) => e.ativo) ?? []
  const unidade = enderecoId || (enderecos.length === 1 ? enderecos[0].id : '')
  const existente = useModelo(clienteId, unidade || null, tipoId, categoria)
  const pronto = !!categoria && !!clienteId && !!tipoId && (enderecos.length === 0 || !!unidade)

  async function montar() {
    setErro(null)
    if (!categoria) return
    try {
      const id = await criar.mutateAsync({
        categoria,
        clienteId,
        enderecoId: unidade || null,
        tipoId,
        descricao: descricao.trim(),
      })
      navigate(`/os/modelos/${id}`, { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <>
      <PageHeader
        titulo="Montar O.S"
        descricao="Para clientes que já têm a O.S pronta: cadastre aqui os pontos e agende as visitas depois."
      />
      <Card className="flex flex-col gap-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Campo rotulo="Tipo da O.S" htmlFor="mod-categoria" obrigatorio>
          <SeletorCategoria id="mod-categoria" valor={categoria} aoMudar={setCategoria} />
        </Campo>
        <Campo rotulo="Cliente" htmlFor="mod-cliente" obrigatorio>
          {clienteId && !cliente && dadosCliente.data ? (
            <p className="flex min-h-11 items-center font-semibold">{dadosCliente.data.nome}</p>
          ) : (
            <ClienteSeletor
              id="mod-cliente"
              valor={cliente}
              aoMudar={(c) => {
                setCliente(c)
                setEnderecoId('')
              }}
            />
          )}
        </Campo>
        {clienteId && (
          <Campo
            rotulo="Unidade"
            htmlFor="mod-unidade"
            dica={enderecos.length === 0 ? 'O cliente não tem endereço cadastrado.' : undefined}
          >
            <Select
              id="mod-unidade"
              value={unidade}
              onChange={(e) => setEnderecoId(e.target.value)}
            >
              {enderecos.length !== 1 && <option value="">Escolha…</option>}
              {enderecos.map((e) => (
                <option key={e.id} value={e.id}>
                  {[e.apelido, `${e.logradouro}, ${e.numero ?? 's/n'}`, e.cidade]
                    .filter(Boolean)
                    .join(' · ')}
                </option>
              ))}
            </Select>
          </Campo>
        )}
        <Campo rotulo="Serviço" htmlFor="mod-tipo" obrigatorio>
          <Select id="mod-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
            <option value="">Escolha…</option>
            {tipos.data
              ?.filter((t) => t.ativo)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
          </Select>
        </Campo>

        {pronto && existente.isPending && <Carregando />}
        {pronto && existente.data && (
          <Aviso tipo="info">
            Este local já tem uma O.S {categoria === 'contrato' ? 'de contrato' : 'avulsa'} para
            este serviço.{' '}
            <Link className="font-semibold underline" to={`/os/modelos/${existente.data.id}`}>
              Abrir
            </Link>
          </Aviso>
        )}
        {pronto && existente.isSuccess && !existente.data && (
          <>
            <Campo
              rotulo="Descrição do serviço"
              htmlFor="mod-descricao"
              dica='Ex.: "Monitoramento de pragas, insetos e roedores (semanal)".'
            >
              <Textarea
                id="mod-descricao"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </Campo>
            <Button disabled={criar.isPending} onClick={() => void montar()}>
              <ClipboardList className="size-5" aria-hidden />
              {criar.isPending ? 'Criando…' : 'Montar O.S'}
            </Button>
          </>
        )}
      </Card>
    </>
  )
}

export function ModeloOsPage() {
  const { id = '' } = useParams()
  const modelo = useModeloPorId(id)

  if (modelo.isPending) return <Carregando />
  if (modelo.isError) return <Aviso tipo="erro">{mensagemDeErro(modelo.error)}</Aviso>
  if (!modelo.data) return <Aviso tipo="erro">O.S de contrato não encontrada.</Aviso>

  const m = modelo.data
  const alvo = { modeloId: m.id, escopo: m.escopo, antesDeComecar: false }
  return (
    <>
      <PageHeader
        titulo={nomeCliente(m.cliente)}
        descricao={[
          nomeUnidade(m.endereco),
          m.tipo?.nome,
          m.categoria === 'contrato' ? 'O.S de contrato' : 'O.S avulsa',
        ]
          .filter(Boolean)
          .join(' · ')}
        acoes={
          <Link to={linkAgendar(m)}>
            <Button>
              <CalendarPlus className="size-5" aria-hidden /> Agendar visita
            </Button>
          </Link>
        }
      />
      <Aviso tipo="info">
        O que for cadastrado aqui vale para as próximas visitas agendadas. Uma OS que já está
        agendada recebe os pontos novos quando você mexer no escopo dela.
      </Aviso>
      <TrocarCategoria modelo={m} />
      <div className="mt-4">
        <DadosPadrao key={m.id} modelo={m} />
      </div>
      {m.tipo?.formulario_os === 'pragas' && (
        <div className="mt-4">
          <EscopoPragas alvo={alvo} />
        </div>
      )}
      {m.tipo?.formulario_os === 'coifa' && (
        <div className="mt-4">
          <EscopoCoifa alvo={alvo} />
        </div>
      )}
      {m.tipo?.formulario_os === 'telas' && (
        <div className="mt-4">
          <EscopoCoifa alvo={alvo} entregaTelas />
        </div>
      )}
      {m.tipo?.formulario_os === 'bebedouro' && (
        <div className="mt-4">
          <EscopoBebedouro alvo={alvo} />
        </div>
      )}
    </>
  )
}

/** Descrição, observações, operadores e veículo que cada visita nova já traz. */
function DadosPadrao({ modelo }: { modelo: ModeloCompleto }) {
  const operadores = useOperadores()
  const veiculos = useVeiculos()
  const salvar = useSalvarModelo(modelo.id)
  const [descricao, setDescricao] = useState(modelo.descricao ?? '')
  const [observacoes, setObservacoes] = useState(modelo.observacoes_adm_padrao ?? '')
  const [escolhidos, setEscolhidos] = useState<string[]>(modelo.operadores_padrao)
  const [veiculoId, setVeiculoId] = useState(modelo.veiculo_padrao_id ?? '')
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  async function enviar() {
    setAviso(null)
    try {
      await salvar.mutateAsync({
        descricao: descricao.trim() || null,
        observacoes_adm_padrao: observacoes.trim() || null,
        operadores_padrao: escolhidos,
        veiculo_padrao_id: veiculoId || null,
      })
      setAviso({ tipo: 'sucesso', texto: 'Salvo. As próximas OS já saem assim.' })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) })
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">
        Informações fixas das próximas OS
      </h2>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <Campo rotulo="Descrição do serviço" htmlFor="pad-descricao">
        <Textarea
          id="pad-descricao"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </Campo>
      <Campo
        rotulo="Observações ADM fixas"
        htmlFor="pad-observacoes"
        dica="Saem em todas as próximas OS: contato, responsável, horário da portaria, avisos."
      >
        <Textarea
          id="pad-observacoes"
          rows={4}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </Campo>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">Operadores de costume</legend>
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
      <Campo rotulo="Veículo de costume" htmlFor="pad-veiculo">
        <Select id="pad-veiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
          <option value="">Sem veículo definido</option>
          {veiculos.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {nomeVeiculo(v)}
            </option>
          ))}
        </Select>
      </Campo>
      <Button variante="secundario" disabled={salvar.isPending} onClick={() => void enviar()}>
        Salvar para as próximas OS
      </Button>
    </Card>
  )
}

/** Corrige uma O.S que ficou na aba errada (contrato ↔ avulsa). */
function TrocarCategoria({ modelo }: { modelo: ModeloCompleto }) {
  const salvar = useSalvarModelo(modelo.id)
  const [erro, setErro] = useState<string | null>(null)
  const outra: CategoriaOs = modelo.categoria === 'contrato' ? 'avulsa' : 'contrato'

  async function trocar() {
    setErro(null)
    try {
      await salvar.mutateAsync({ categoria: outra })
    } catch (e) {
      const msg = mensagemDeErro(e)
      setErro(
        /um_modelo_por_local/.test(msg)
          ? `Este local já tem uma O.S ${outra === 'contrato' ? 'de contrato' : 'avulsa'} deste serviço.`
          : msg,
      )
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button variante="fantasma" disabled={salvar.isPending} onClick={() => void trocar()}>
        <ArrowLeftRight className="size-4" aria-hidden /> Passar para{' '}
        {outra === 'contrato' ? 'contrato' : 'avulsa'}
      </Button>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  )
}
