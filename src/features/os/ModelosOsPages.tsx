import { CalendarPlus, ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import { useCliente } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import {
  useCriarModelo,
  useModelo,
  useModeloPorId,
  useModelos,
  useOperadores,
  useSalvarModelo,
  useVeiculos,
  type ModeloCompleto,
  type ModeloResumo,
} from './api'
import { nomeVeiculo } from './nomeVeiculo'
import { EscopoBebedouro } from './EscopoBebedouro'
import { EscopoCoifa } from './EscopoCoifa'
import { EscopoPragas } from './EscopoPragas'

/*
 * O.S de contrato: o modelo de um local (cliente + unidade + serviço) montado pelo
 * escritório, com os porta-iscas, as armadilhas e as coifas. Cada visita agendada
 * copia este modelo; o operador só anota a execução.
 */

const nomeCliente = (c: { nome: string; nome_fantasia: string | null } | null) =>
  c?.nome_fantasia || c?.nome || '—'

const nomeUnidade = (e: ModeloResumo['endereco']) =>
  e ? e.apelido || `${e.logradouro}, ${e.numero ?? 's/n'} · ${e.cidade}/${e.uf}` : null

const linkAgendar = (m: {
  cliente_id?: string
  endereco_id?: string | null
  tipo_servico_id?: string
}) =>
  `/os/nova?${new URLSearchParams({
    cliente: m.cliente_id ?? '',
    unidade: m.endereco_id ?? '',
    tipo: m.tipo_servico_id ?? '',
  })}`

export function ModelosOsPage() {
  const modelos = useModelos()
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const lista =
    modelos.data?.filter(
      (m) =>
        !termo ||
        [m.cliente?.nome, m.cliente?.nome_fantasia, m.endereco?.apelido, m.tipo?.nome]
          .filter(Boolean)
          .some((t) => t!.toLowerCase().includes(termo)),
    ) ?? []

  return (
    <>
      <PageHeader
        titulo="O.S de contrato"
        descricao="Monte a O.S de cada cliente uma vez (porta-iscas, armadilhas, coifas). Cada visita agendada sai pronta dela."
        acoes={
          <Link to="/os/modelos/novo">
            <Button>
              <Plus className="size-5" aria-hidden /> Montar O.S
            </Button>
          </Link>
        }
      />
      <input
        aria-label="Buscar"
        placeholder="Buscar cliente, unidade ou serviço…"
        className="mb-4 min-h-11 w-full rounded-xl border border-borda bg-white px-3"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {modelos.isPending && <Carregando />}
      {modelos.isError && <Aviso tipo="erro">{mensagemDeErro(modelos.error)}</Aviso>}
      {modelos.isSuccess && lista.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          Nenhuma O.S de contrato montada.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {lista.map((m) => {
          const ativos = m.pontos.filter((p) => p.ativo)
          const iscas = ativos.filter((p) => p.tipo === 'porta_isca').length
          const armadilhas = ativos.filter((p) => p.tipo === 'armadilha_luminosa').length
          const coifas = ativos.filter((p) => p.tipo === 'coifa').length
          const bebedouros = ativos.filter(
            (p) => p.tipo === 'bebedouro' || p.tipo === 'bebedouro_garrafao',
          ).length
          const contagem = [
            iscas && `${iscas} porta-iscas`,
            armadilhas && `${armadilhas} armadilhas`,
            coifas && `${coifas} coifas`,
            bebedouros && `${bebedouros} bebedouros`,
          ].filter(Boolean)
          return (
            <li key={m.id}>
              <Link
                to={`/os/modelos/${m.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-borda bg-white p-4 hover:border-verde"
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
            </li>
          )
        })}
      </ul>
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
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const tipos = useTiposServico()
  const criar = useCriarModelo()

  const clienteId = cliente?.id ?? parametros.get('cliente') ?? ''
  const dadosCliente = useCliente(clienteId)
  const enderecos = dadosCliente.data?.enderecos.filter((e) => e.ativo) ?? []
  const unidade = enderecoId || (enderecos.length === 1 ? enderecos[0].id : '')
  const existente = useModelo(clienteId, unidade || null, tipoId)
  const pronto = !!clienteId && !!tipoId && (enderecos.length === 0 || !!unidade)

  async function montar() {
    setErro(null)
    try {
      const id = await criar.mutateAsync({
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
        titulo="Montar O.S de contrato"
        descricao="Para clientes que já têm a O.S pronta: cadastre aqui os pontos e agende as visitas depois."
      />
      <Card className="flex flex-col gap-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
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
            Este local já tem uma O.S de contrato para este serviço.{' '}
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
        descricao={[nomeUnidade(m.endereco), m.tipo?.nome, 'O.S de contrato']
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
      setAviso({ tipo: 'sucesso', texto: 'Dados das visitas salvos.' })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: mensagemDeErro(e) })
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">Dados das visitas</h2>
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
        rotulo="Observações ADM"
        htmlFor="pad-observacoes"
        dica="Contatos, horário da portaria, o que o operador precisa saber."
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
        Salvar dados das visitas
      </Button>
    </Card>
  )
}
