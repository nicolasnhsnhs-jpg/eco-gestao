import { FileSearch } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import type { Tables } from '@/lib/database.types'
import { hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_GESTAO } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import { useCliente } from '../clientes/api'
import { horaCurta, useProposta } from '../propostas/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import { useAgendarOs, useModelo, useOperadores, useVeiculos, type CategoriaOs } from './api'
import { nomeVeiculo } from './nomeVeiculo'
import { EscolherProposta, PainelProposta } from './PropostaParaOs'
import { SeletorCategoria } from './SeletorCategoria'

/**
 * Nova OS: escolhe cliente → unidade → serviço. Se já existe um modelo para esse
 * local e serviço, a OS vem preenchida com ele; senão, o modelo é criado agora.
 */
export function OsFormPage() {
  const [parametros] = useSearchParams()
  const perfil = usePerfil()
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null)
  const [enderecoId, setEnderecoId] = useState(parametros.get('unidade') ?? '')
  const [tipoId, setTipoId] = useState(parametros.get('tipo') ?? '')
  const [categoria, setCategoria] = useState<CategoriaOs | ''>(
    (['contrato', 'avulsa'] as const).find((c) => c === parametros.get('categoria')) ?? '',
  )
  const tipos = useTiposServico()

  // Proposta aprovada aberta ao lado (a recepção não vê propostas: têm valores).
  const podeVerPropostas = PAPEIS_GESTAO.includes(perfil.papel)
  const [propostaId, setPropostaId] = useState(parametros.get('proposta') ?? '')
  const [buscandoProposta, setBuscandoProposta] = useState(false)
  const proposta = useProposta(podeVerPropostas && propostaId ? propostaId : undefined)
  const p = propostaId ? proposta.data : null
  // Quando a proposta chega, puxa cliente, unidade e serviço dela (uma vez por proposta).
  const [aplicada, setAplicada] = useState('')
  if (p && aplicada !== p.id) {
    setAplicada(p.id!)
    setCliente({ id: p.cliente_id!, nome: p.cliente?.nome_fantasia || p.cliente?.nome || '' })
    setEnderecoId(p.endereco_id ?? '')
    const tipoDaProposta = p.itens.find((i) => i.tipo_servico_id)?.tipo_servico_id
    if (tipoDaProposta) setTipoId(tipoDaProposta)
  }
  const fecharProposta = () => {
    setPropostaId('')
    setAplicada('')
  }

  const clienteId = cliente?.id ?? parametros.get('cliente') ?? ''
  const dadosCliente = useCliente(clienteId)
  const enderecos = dadosCliente.data?.enderecos.filter((e) => e.ativo) ?? []
  // Cliente com uma única unidade: a OS fica nela.
  const unidade = enderecoId || (enderecos.length === 1 ? enderecos[0].id : '')
  const modelo = useModelo(clienteId, unidade || null, tipoId, categoria)

  return (
    <>
      <PageHeader titulo="Nova ordem de serviço" />
      <div
        className={
          p ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]' : undefined
        }
      >
        {p && (
          <aside className="max-h-[45dvh] overflow-y-auto rounded-2xl xl:sticky xl:top-4 xl:order-2 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
            <PainelProposta p={p} aoFechar={fecharProposta} />
          </aside>
        )}
        <div className="min-w-0">
          {podeVerPropostas && !p && (
            <Card className="mb-4 flex flex-col gap-3">
              {buscandoProposta || propostaId ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">Buscar proposta aprovada</p>
                    <Button
                      variante="fantasma"
                      className="min-h-9"
                      onClick={() => {
                        setBuscandoProposta(false)
                        fecharProposta()
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                  {propostaId ? (
                    proposta.isError ? (
                      <Aviso tipo="erro">{mensagemDeErro(proposta.error)}</Aviso>
                    ) : (
                      <Carregando />
                    )
                  ) : (
                    <EscolherProposta
                      aoEscolher={(escolhida) => {
                        setPropostaId(escolhida.id!)
                        setBuscandoProposta(false)
                      }}
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-texto-suave">
                    Vai fazer a OS de uma proposta aprovada? Abra a proposta ao lado e vá
                    preenchendo olhando para ela.
                  </p>
                  <Button variante="secundario" onClick={() => setBuscandoProposta(true)}>
                    <FileSearch className="size-4" aria-hidden /> Buscar proposta aprovada
                  </Button>
                </div>
              )}
            </Card>
          )}
          <Card className="flex flex-col gap-4">
            <Campo rotulo="Tipo da O.S" htmlFor="os-categoria" obrigatorio>
              <SeletorCategoria id="os-categoria" valor={categoria} aoMudar={setCategoria} />
            </Campo>

            <Campo rotulo="Cliente" htmlFor="os-cliente" obrigatorio>
              {clienteId && !cliente && dadosCliente.data ? (
                <p className="flex min-h-11 items-center font-semibold">{dadosCliente.data.nome}</p>
              ) : (
                <ClienteSeletor
                  id="os-cliente"
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
                htmlFor="os-unidade"
                dica={enderecos.length === 0 ? 'O cliente não tem endereço cadastrado.' : undefined}
              >
                <Select
                  id="os-unidade"
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

            <Campo rotulo="Serviço" htmlFor="os-tipo" obrigatorio>
              <Select id="os-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
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
          </Card>

          {clienteId && tipoId && categoria && (enderecos.length === 0 || unidade) && (
            <>
              {modelo.isPending && <Carregando />}
              {modelo.isError && <Aviso tipo="erro">{mensagemDeErro(modelo.error)}</Aviso>}
              {modelo.isSuccess && (
                <FormAgendamento
                  key={`${modelo.data?.id ?? 'novo'}:${p?.id ?? ''}:${categoria}`}
                  categoria={categoria}
                  clienteId={clienteId}
                  enderecoId={unidade || null}
                  tipoId={tipoId}
                  modelo={modelo.data}
                  sugestao={
                    p
                      ? {
                          data: p.execucao_data,
                          hora: p.execucao_hora ? horaCurta(p.execucao_hora) : null,
                          descricao:
                            p.itens.find((i) => i.tipo_servico_id === tipoId)?.descricao ?? null,
                        }
                      : undefined
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function FormAgendamento({
  categoria,
  clienteId,
  enderecoId,
  tipoId,
  modelo,
  sugestao,
}: {
  categoria: CategoriaOs
  clienteId: string
  enderecoId: string | null
  tipoId: string
  modelo: Tables<'os_modelos'> | null
  /** Da proposta aprovada aberta ao lado: dia/horário combinados e o serviço. */
  sugestao?: { data: string | null; hora: string | null; descricao: string | null }
}) {
  const navigate = useNavigate()
  const operadores = useOperadores()
  const veiculos = useVeiculos()
  const agendar = useAgendarOs()
  const [data, setData] = useState(sugestao?.data ?? hojeISO())
  const [hora, setHora] = useState(sugestao?.hora ?? '')
  const [escolhidos, setEscolhidos] = useState<string[]>(modelo?.operadores_padrao ?? [])
  const [veiculoId, setVeiculoId] = useState(modelo?.veiculo_padrao_id ?? '')
  const [descricao, setDescricao] = useState(modelo?.descricao || sugestao?.descricao || '')
  const [observacoes, setObservacoes] = useState(modelo?.observacoes_adm_padrao ?? '')
  const [ocorrencia, setOcorrencia] = useState('')
  const [salvarComoPadrao, setSalvarComoPadrao] = useState(!modelo)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (escolhidos.length === 0) {
      setErro('Escolha pelo menos um operador.')
      return
    }
    if (descricao.trim().length < 3) {
      setErro('Descreva o serviço a ser feito.')
      return
    }
    try {
      const id = await agendar.mutateAsync({
        categoria,
        clienteId,
        enderecoId,
        tipoId,
        data,
        hora: hora || null,
        operadores: escolhidos,
        veiculoId: veiculoId || null,
        descricao: descricao.trim(),
        observacoesAdm: observacoes.trim(),
        ocorrencia: ocorrencia.trim(),
        salvarComoPadrao,
      })
      navigate(`/os/${id}`)
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  return (
    <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        {modelo ? (
          <Aviso tipo="sucesso">
            {categoria === 'contrato'
              ? 'Este local já tem a O.S de contrato: a visita sai com os pontos dela.'
              : 'Este local já tem uma O.S avulsa deste serviço: a nova sai igual a ela.'}{' '}
            <Link className="font-semibold underline" to={`/os/modelos/${modelo.id}`}>
              Ver a O.S salva
            </Link>
          </Aviso>
        ) : (
          <Aviso tipo="info">
            Primeira OS deste serviço neste local. Se o cliente já tem a O.S pronta (porta-iscas,
            armadilhas), você pode{' '}
            <Link
              className="font-semibold underline"
              to={`/os/modelos/novo?${new URLSearchParams({
                categoria,
                cliente: clienteId,
                unidade: enderecoId ?? '',
                tipo: tipoId,
              })}`}
            >
              montar a O.S antes
            </Link>
            . Ou agende agora e cadastre os pontos na tela da OS.
          </Aviso>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data" htmlFor="os-data" obrigatorio>
            <Input
              id="os-data"
              type="date"
              required
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Horário" htmlFor="os-hora">
            <Input
              id="os-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </Campo>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">
            Operadores <span className="text-perigo">*</span>
          </legend>
          {operadores.data?.length === 0 && (
            <p className="text-sm text-texto-suave">
              Nenhum operador cadastrado. Crie em Usuários → Novo operador.
            </p>
          )}
          {operadores.data?.map((o) => (
            <label key={o.id} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-verde"
                checked={escolhidos.includes(o.id)}
                onChange={(e) =>
                  setEscolhidos((atual) =>
                    e.target.checked ? [...atual, o.id] : atual.filter((id) => id !== o.id),
                  )
                }
              />
              {o.nome}
            </label>
          ))}
        </fieldset>

        <Campo rotulo="Veículo" htmlFor="os-veiculo">
          <Select id="os-veiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)}>
            <option value="">Sem veículo definido</option>
            {veiculos.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {nomeVeiculo(v)}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo rotulo="Descrição do serviço" htmlFor="os-descricao" obrigatorio>
          <Textarea
            id="os-descricao"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Campo>

        <Campo
          rotulo="Observações ADM"
          htmlFor="os-observacoes"
          dica='Ex.: "Portaria libera às 08h30, falar com Fulana (48) 99999-0000".'
        >
          <Textarea
            id="os-observacoes"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </Campo>

        <Campo
          rotulo="Ocorrência (o técnico precisa confirmar)"
          htmlFor="os-ocorrencia"
          dica='Só quando houver. Ex.: "Ocorrência com roedores no setor de expedição". O técnico só conclui a OS depois de confirmar que resolveu.'
        >
          <Textarea
            id="os-ocorrencia"
            rows={2}
            value={ocorrencia}
            onChange={(e) => setOcorrencia(e.target.value)}
          />
        </Campo>

        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={salvarComoPadrao}
            onChange={(e) => setSalvarComoPadrao(e.target.checked)}
          />
          Usar operadores, veículo e observações como padrão das próximas visitas
        </label>
      </Card>

      <Button type="submit" disabled={agendar.isPending}>
        {agendar.isPending ? 'Agendando…' : 'Agendar OS'}
      </Button>
    </form>
  )
}
