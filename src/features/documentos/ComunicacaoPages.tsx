import { ArrowDown, ArrowUp, FileDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useCliente } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import {
  tecnicoPeloNome,
  useApagarComunicacao,
  useComunicacao,
  useComunicacoes,
  useSalvarComunicacao,
  useTecnicosConhecidos,
  useVeiculosComunicacao,
  type Comunicacao,
} from './comunicacaoApi'
import {
  conteudoDoModelo,
  lerConteudo,
  limparConteudo,
  MODELOS_COMUNICACAO,
  modeloComunicacao,
  NOMES_ESTILO,
  type ConteudoComunicacao,
  type EstiloSecao,
  type SecaoComunicacao,
} from './comunicacaoModelos'

function useBaixarPdf() {
  const [gerando, setGerando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  async function baixar(c: Comunicacao) {
    setErro(null)
    setGerando(c.id)
    try {
      // O gerador de PDF só é baixado quando alguém pede um PDF.
      const { baixarPdfComunicacao } = await import('./comunicacaoPdf')
      await baixarPdfComunicacao(c)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setGerando(null)
    }
  }
  return { gerando, erro, baixar }
}

const simplificar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// -----------------------------------------------------------------------------
// Lista
// -----------------------------------------------------------------------------

/** /documentos/comunicacoes */
export function ComunicacoesPage() {
  const lista = useComunicacoes()
  const apagar = useApagarComunicacao()
  const pdf = useBaixarPdf()
  const [busca, setBusca] = useState('')
  const termo = simplificar(busca.trim())
  const filtradas =
    lista.data?.filter((c) => {
      if (!termo) return true
      const conteudo = lerConteudo(c.conteudo)
      return simplificar(
        [c.cliente_nome, c.titulo, conteudo.subtitulo, conteudo.local].join(' '),
      ).includes(termo)
    }) ?? []

  return (
    <>
      <PageHeader
        titulo="Comunicação de serviço"
        descricao="O aviso que vai ao cliente antes do serviço: data, horário, técnicos autorizados, como preparar o local e os cuidados depois. Emita, baixe o PDF e envie ao cliente."
        acoes={
          <Link to="/documentos/comunicacoes/nova">
            <Button>
              <Plus className="size-5" aria-hidden /> Nova comunicação
            </Button>
          </Link>
        }
      />
      <div className="mb-4">
        <Input
          aria-label="Buscar"
          type="search"
          placeholder="Buscar por cliente, serviço ou local…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {(pdf.erro || apagar.isError) && (
        <div className="mb-4">
          <Aviso tipo="erro">{pdf.erro ?? mensagemDeErro(apagar.error)}</Aviso>
        </div>
      )}
      {lista.isPending && <Carregando />}
      {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}
      {lista.isSuccess && filtradas.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          {termo ? 'Nenhuma comunicação encontrada.' : 'Nenhuma comunicação emitida ainda.'}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {filtradas.map((c) => {
          const conteudo = lerConteudo(c.conteudo)
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borda bg-white p-4"
            >
              <Link to={`/documentos/comunicacoes/${c.id}`} className="min-w-0 hover:underline">
                <p className="font-semibold text-verde-escuro">
                  {c.cliente_nome}
                  {conteudo.local && ` · ${conteudo.local}`}
                </p>
                <p className="text-sm text-texto-suave">
                  {conteudo.subtitulo || c.titulo} · {formatarData(c.data)}
                  {conteudo.horario && ` ${conteudo.horario}`} · {modeloComunicacao(c.modelo).nome}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  variante="secundario"
                  onClick={() => void pdf.baixar(c)}
                  disabled={pdf.gerando === c.id}
                  aria-label={`Baixar o PDF da comunicação de ${c.cliente_nome}`}
                >
                  <FileDown className="size-5" aria-hidden />
                  {pdf.gerando === c.id ? 'Gerando…' : 'PDF'}
                </Button>
                <Link to={`/documentos/comunicacoes/${c.id}`}>
                  <Button variante="fantasma" aria-label="Editar">
                    <Pencil className="size-5" aria-hidden />
                  </Button>
                </Link>
                <Button
                  variante="fantasma"
                  aria-label="Apagar"
                  disabled={apagar.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Apagar a comunicação de ${c.cliente_nome} (${formatarData(c.data)})?`,
                      )
                    )
                      apagar.mutate(c.id)
                  }}
                >
                  <Trash2 className="size-5" aria-hidden />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// -----------------------------------------------------------------------------
// Emitir / editar
// -----------------------------------------------------------------------------

/** /documentos/comunicacoes/nova e /documentos/comunicacoes/:id */
export function ComunicacaoFormPage() {
  const { id } = useParams()
  const c = useComunicacao(id)
  if (id && c.isPending) return <Carregando />
  if (id && c.isError) return <Aviso tipo="erro">{mensagemDeErro(c.error)}</Aviso>
  if (id && !c.data) return <Aviso tipo="erro">Comunicação não encontrada.</Aviso>
  return <Formulario key={id ?? 'nova'} comunicacao={c.data ?? null} />
}

const MODELO_INICIAL = 'desinsetizacao_comercio'

function Formulario({ comunicacao }: { comunicacao: Comunicacao | null }) {
  const navigate = useNavigate()
  const salvar = useSalvarComunicacao(comunicacao?.id ?? null)
  const pdf = useBaixarPdf()
  const tecnicosConhecidos = useTecnicosConhecidos()
  const veiculos = useVeiculosComunicacao()

  const [modelo, setModelo] = useState(comunicacao?.modelo ?? MODELO_INICIAL)
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(
    comunicacao ? { id: comunicacao.cliente_id, nome: comunicacao.cliente_nome } : null,
  )
  const dadosCliente = useCliente(cliente?.id ?? '')
  const [enderecoId, setEnderecoId] = useState(comunicacao?.endereco_id ?? '')
  const [clienteNome, setClienteNome] = useState(comunicacao?.cliente_nome ?? '')
  const [titulo, setTitulo] = useState(
    comunicacao?.titulo ?? modeloComunicacao(MODELO_INICIAL).titulo,
  )
  const [data, setData] = useState(comunicacao?.data ?? hojeISO())
  const [c, setC] = useState<ConteudoComunicacao>(() =>
    comunicacao ? lerConteudo(comunicacao.conteudo) : conteudoDoModelo(MODELO_INICIAL),
  )
  const [erro, setErro] = useState<string | null>(null)

  const m = modeloComunicacao(modelo)
  const enderecos = dadosCliente.data?.enderecos.filter((e) => e.ativo) ?? []
  const mudar = (patch: Partial<ConteudoComunicacao>) => setC((x) => ({ ...x, ...patch }))
  const mudarSecao = (i: number, patch: Partial<SecaoComunicacao>) =>
    mudar({ secoes: c.secoes.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const moverSecao = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= c.secoes.length) return
    const nova = [...c.secoes]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    mudar({ secoes: nova })
  }

  function escolherModelo(novo: string) {
    if (novo === modelo) return
    const atual = conteudoDoModelo(modelo)
    const mexeu =
      JSON.stringify([c.abertura, c.secoes, c.fechamento, c.subtitulo]) !==
      JSON.stringify([atual.abertura, atual.secoes, atual.fechamento, atual.subtitulo])
    if (mexeu && !window.confirm('Trocar o modelo troca os textos que você escreveu. Continuar?'))
      return
    const base = conteudoDoModelo(novo)
    setModelo(novo)
    setTitulo(modeloComunicacao(novo).titulo)
    // O que é do serviço marcado (local, contato, técnicos, veículo) continua.
    setC((x) => ({
      ...base,
      local: x.local || base.local,
      contato: x.contato,
      tecnicos: x.tecnicos,
      veiculo: x.veiculo,
      contatos: x.contatos || base.contatos,
    }))
  }

  function escolherCliente(novo: ClienteEscolhido | null) {
    setCliente(novo)
    setEnderecoId('')
    setClienteNome(novo?.nome ?? '')
  }

  function escolherEndereco(id: string) {
    setEnderecoId(id)
    const e = enderecos.find((x) => x.id === id)
    const base = dadosCliente.data?.nome_fantasia || dadosCliente.data?.nome || cliente?.nome || ''
    setClienteNome(e?.apelido ? `${base} - ${e.apelido}` : base)
  }

  function mudarTecnico(i: number, patch: Partial<ConteudoComunicacao['tecnicos'][number]>) {
    mudar({
      tecnicos: c.tecnicos.map((t, j) => {
        if (j !== i) return t
        const novo = { ...t, ...patch }
        // Nome de um técnico conhecido: RG e CPF da última comunicação.
        if (patch.nome !== undefined) {
          const conhecido = tecnicoPeloNome(tecnicosConhecidos.data, patch.nome)
          if (conhecido) {
            novo.rg = novo.rg || conhecido.rg
            novo.cpf = novo.cpf || conhecido.cpf
          }
        }
        return novo
      }),
    })
  }

  async function enviar(baixar: boolean) {
    setErro(null)
    if (!cliente) return setErro('Escolha o cliente.')
    if (!clienteNome.trim()) return setErro('Escreva o nome do cliente que sai na comunicação.')
    if (titulo.trim().length < 3) return setErro('Escreva o título.')
    if (!data) return setErro('Escolha a data.')
    const conteudo = limparConteudo(c)
    try {
      const id = await salvar.mutateAsync({
        modelo,
        titulo,
        clienteId: cliente.id,
        enderecoId: enderecoId || null,
        clienteNome,
        data,
        conteudo,
      })
      if (baixar)
        await pdf.baixar({
          ...(comunicacao ?? ({} as Comunicacao)),
          id,
          modelo,
          titulo: titulo.trim(),
          cliente_id: cliente.id,
          endereco_id: enderecoId || null,
          cliente_nome: clienteNome.trim(),
          data,
          conteudo,
        } as Comunicacao)
      navigate('/documentos/comunicacoes')
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const salvando = salvar.isPending || !!pdf.gerando
  const mostrarTecnicos = m.pedeTecnicos || c.tecnicos.length > 0
  const mostrarVeiculo = m.pedeVeiculo || !!c.veiculo

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void enviar(false)
      }}
      className="flex flex-col gap-4"
    >
      <PageHeader
        titulo={comunicacao ? 'Editar comunicação' : 'Nova comunicação de serviço'}
        descricao="O modelo já traz os textos; ajuste o que precisar. Nos textos, {cliente} vira o nome do cliente e {data} a data por extenso."
      />

      <Card className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Modelo</h2>
        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          role="radiogroup"
          aria-label="Modelo"
        >
          {Object.entries(MODELOS_COMUNICACAO).map(([chave, mod]) => (
            <button
              key={chave}
              type="button"
              role="radio"
              aria-checked={modelo === chave}
              onClick={() => escolherModelo(chave)}
              className={cn(
                'min-h-12 rounded-xl border-2 px-3 text-left text-sm font-semibold',
                modelo === chave
                  ? 'border-verde bg-verde text-white'
                  : 'border-borda bg-white text-verde-escuro hover:bg-lima-claro',
              )}
            >
              {mod.nome}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Cliente e serviço</h2>
        <Campo rotulo="Cliente" htmlFor="com-cliente" obrigatorio>
          {comunicacao ? (
            <p className="font-semibold">{comunicacao.cliente_nome}</p>
          ) : (
            <ClienteSeletor id="com-cliente" valor={cliente} aoMudar={escolherCliente} />
          )}
        </Campo>
        {!comunicacao && cliente && enderecos.length > 1 && (
          <Campo rotulo="Unidade" htmlFor="com-unidade">
            <Select
              id="com-unidade"
              value={enderecoId}
              onChange={(e) => escolherEndereco(e.target.value)}
            >
              <option value="">Escolha…</option>
              {enderecos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.apelido || `${e.logradouro}, ${e.numero ?? 's/n'}`} · {e.cidade}/{e.uf}
                </option>
              ))}
            </Select>
          </Campo>
        )}
        <Campo
          rotulo="Nome do cliente na comunicação"
          htmlFor="com-nome"
          obrigatorio
          dica="Ex.: Restaurante Giardino Di Mamma Gema"
        >
          <Input
            id="com-nome"
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
          />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Data" htmlFor="com-data" obrigatorio>
            <Input
              id="com-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </Campo>
          <Campo rotulo="Horário" htmlFor="com-horario" dica="Ex.: às 21h · a partir das 6h">
            <Input
              id="com-horario"
              value={c.horario}
              onChange={(e) => mudar({ horario: e.target.value })}
            />
          </Campo>
          <Campo rotulo="Local" htmlFor="com-local" dica="Ex.: Cozinha refeitório">
            <Input
              id="com-local"
              value={c.local}
              onChange={(e) => mudar({ local: e.target.value })}
            />
          </Campo>
        </div>
        <Campo
          rotulo="Contato no cliente"
          htmlFor="com-contato"
          dica={m.pedeContato ? 'Ex.: Sr. Paulo (51) 98593-1175' : 'Opcional'}
        >
          <Input
            id="com-contato"
            value={c.contato}
            onChange={(e) => mudar({ contato: e.target.value })}
          />
        </Campo>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Título e abertura</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Título" htmlFor="com-titulo" obrigatorio dica="Ex.: Comunicado importante">
            <Input id="com-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo
            rotulo="Serviço (letras grandes)"
            htmlFor="com-subtitulo"
            dica="Ex.: Desinsetização"
          >
            <Input
              id="com-subtitulo"
              value={c.subtitulo}
              onChange={(e) => mudar({ subtitulo: e.target.value })}
            />
          </Campo>
        </div>
        <Campo rotulo="Texto de abertura" htmlFor="com-abertura" dica="Opcional. Ex.: Prezados, …">
          <Textarea
            id="com-abertura"
            rows={3}
            value={c.abertura}
            onChange={(e) => mudar({ abertura: e.target.value })}
          />
        </Campo>
      </Card>

      {(mostrarTecnicos || mostrarVeiculo) && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-titulo text-lg font-bold text-verde-escuro">Técnicos autorizados</h2>
          <p className="text-sm text-texto-suave">
            Escolha pelo nome: o RG e o CPF usados da última vez já vêm preenchidos.
          </p>
          <datalist id="com-tecnicos">
            {tecnicosConhecidos.data?.map((t) => (
              <option key={t.nome} value={t.nome} />
            ))}
          </datalist>
          {c.tecnicos.map((t, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_auto]">
              <Input
                aria-label={`Nome do técnico ${i + 1}`}
                placeholder="Nome"
                list="com-tecnicos"
                value={t.nome}
                onChange={(e) => mudarTecnico(i, { nome: e.target.value })}
              />
              <Input
                aria-label={`RG do técnico ${i + 1}`}
                placeholder="RG (opcional)"
                value={t.rg}
                onChange={(e) => mudarTecnico(i, { rg: e.target.value })}
              />
              <Input
                aria-label={`CPF do técnico ${i + 1}`}
                placeholder="CPF"
                value={t.cpf}
                onChange={(e) => mudarTecnico(i, { cpf: e.target.value })}
              />
              <Button
                variante="fantasma"
                aria-label={`Tirar o técnico ${i + 1}`}
                onClick={() => mudar({ tecnicos: c.tecnicos.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-5" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            variante="secundario"
            className="self-start"
            onClick={() => mudar({ tecnicos: [...c.tecnicos, { nome: '', rg: '', cpf: '' }] })}
          >
            <Plus className="size-5" aria-hidden /> Adicionar técnico
          </Button>
          <Campo rotulo="Veículo" htmlFor="com-veiculo" dica="Opcional. Ex.: ONIX · Placa JCI9E13">
            <Input
              id="com-veiculo"
              list="com-veiculos"
              value={c.veiculo}
              onChange={(e) => mudar({ veiculo: e.target.value })}
            />
          </Campo>
          <datalist id="com-veiculos">
            {veiculos.data?.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Card>
      )}
      {!mostrarTecnicos && !mostrarVeiculo && (
        <Button
          variante="secundario"
          className="self-start"
          onClick={() => mudar({ tecnicos: [{ nome: '', rg: '', cpf: '' }] })}
        >
          <Plus className="size-5" aria-hidden /> Incluir técnicos autorizados
        </Button>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Orientações</h2>
        <p className="text-sm text-texto-suave">
          Nas listas, cada linha vira um item. O quadro de destaque sai em amarelo.
        </p>
        {c.secoes.map((s, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-borda p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_13rem_auto]">
              <Input
                aria-label={`Título da seção ${i + 1}`}
                placeholder="Título (opcional)"
                value={s.titulo}
                onChange={(e) => mudarSecao(i, { titulo: e.target.value })}
              />
              <Select
                aria-label={`Formato da seção ${i + 1}`}
                value={s.estilo}
                onChange={(e) => mudarSecao(i, { estilo: e.target.value as EstiloSecao })}
              >
                {Object.entries(NOMES_ESTILO).map(([v, nome]) => (
                  <option key={v} value={v}>
                    {nome}
                  </option>
                ))}
              </Select>
              <div className="flex gap-1">
                <Button
                  variante="fantasma"
                  aria-label="Subir"
                  disabled={i === 0}
                  onClick={() => moverSecao(i, -1)}
                >
                  <ArrowUp className="size-5" aria-hidden />
                </Button>
                <Button
                  variante="fantasma"
                  aria-label="Descer"
                  disabled={i === c.secoes.length - 1}
                  onClick={() => moverSecao(i, 1)}
                >
                  <ArrowDown className="size-5" aria-hidden />
                </Button>
                <Button
                  variante="fantasma"
                  aria-label={`Tirar a seção ${i + 1}`}
                  onClick={() => mudar({ secoes: c.secoes.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="size-5" aria-hidden />
                </Button>
              </div>
            </div>
            <Textarea
              aria-label={`Texto da seção ${i + 1}`}
              rows={Math.min(10, Math.max(3, s.texto.split('\n').length + 1))}
              value={s.texto}
              onChange={(e) => mudarSecao(i, { texto: e.target.value })}
            />
          </div>
        ))}
        <Button
          variante="secundario"
          className="self-start"
          onClick={() =>
            mudar({ secoes: [...c.secoes, { titulo: '', texto: '', estilo: 'lista' }] })
          }
        >
          <Plus className="size-5" aria-hidden /> Adicionar seção
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Fechamento</h2>
        <Campo rotulo="Texto final" htmlFor="com-fechamento" dica="Opcional">
          <Textarea
            id="com-fechamento"
            rows={2}
            value={c.fechamento}
            onChange={(e) => mudar({ fechamento: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Contatos do SAC" htmlFor="com-contatos">
          <Input
            id="com-contatos"
            value={c.contatos}
            onChange={(e) => mudar({ contatos: e.target.value })}
          />
        </Campo>
      </Card>

      {(erro || pdf.erro) && <Aviso tipo="erro">{erro ?? pdf.erro}</Aviso>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variante="fantasma" onClick={() => navigate('/documentos/comunicacoes')}>
          Voltar
        </Button>
        <Button variante="secundario" type="submit" disabled={salvando}>
          Salvar
        </Button>
        <Button disabled={salvando} onClick={() => void enviar(true)}>
          <FileDown className="size-5" aria-hidden />
          {salvando ? 'Salvando…' : 'Salvar e baixar PDF'}
        </Button>
      </div>
    </form>
  )
}
