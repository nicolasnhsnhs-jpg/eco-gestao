import { ChevronDown, FileDown, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO } from '@/lib/datas'
import { formatarCnpj, formatarCpf } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useCliente } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import {
  participantesEmOrdem,
  useApr,
  useAprs,
  useAtualizarApr,
  useCancelarApr,
  useEmitirApr,
  useEquipeApr,
  type Apr,
} from './api'
import {
  ETAPA_VAZIA,
  lerEpis,
  lerEtapas,
  limparEtapas,
  MODELOS_APR,
  nomeModelo,
  numeroApr,
  type EtapaApr,
  type ModeloApr,
} from './aprModelos'

// -----------------------------------------------------------------------------
// Abas de Documentos
// -----------------------------------------------------------------------------

export function DocumentosLayout() {
  const abas = [{ rotulo: 'Emissão de APR', caminho: '/documentos' }]
  return (
    <>
      <nav
        aria-label="Documentos"
        className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1"
      >
        {abas.map((aba) => (
          <NavLink
            key={aba.caminho}
            to={aba.caminho}
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

function situacao(a: Pick<Apr, 'status' | 'participantes'>) {
  if (a.status === 'cancelada') return { texto: 'Cancelada', cor: 'cinza' as const }
  if (a.status === 'concluida') return { texto: 'Concluída', cor: 'verde' as const }
  const feitas = a.participantes.filter((p) => p.assinada_em).length
  return {
    texto: `Aguardando assinaturas (${feitas}/${a.participantes.length})`,
    cor: 'alerta' as const,
  }
}

function useBaixarPdf() {
  const [gerando, setGerando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  async function baixar(a: Apr) {
    setErro(null)
    setGerando(a.id)
    try {
      // O gerador de PDF só é baixado quando alguém pede um PDF.
      const { baixarPdfApr } = await import('./aprPdf')
      await baixarPdfApr(a)
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setGerando(null)
    }
  }
  return { gerando, erro, baixar }
}

// -----------------------------------------------------------------------------
// Lista
// -----------------------------------------------------------------------------

/** /documentos: APRs emitidas, com a situação das assinaturas e o PDF. */
export function AprsPage() {
  const [status, setStatus] = useState<'' | 'pendente' | 'concluida' | 'cancelada'>('')
  const aprs = useAprs(status ? { status } : {})
  const [busca, setBusca] = useState('')
  const pdf = useBaixarPdf()
  const termo = busca.trim().toLowerCase()
  const lista =
    aprs.data?.filter(
      (a) =>
        !termo ||
        [numeroApr(a), a.cliente_nome, a.local, a.titulo]
          .filter(Boolean)
          .some((t) => t!.toLowerCase().includes(termo)),
    ) ?? []

  return (
    <>
      <PageHeader
        titulo="Emissão de APR"
        descricao="Análise Preliminar de Risco: escolha o cliente e os técnicos; eles assinam no celular, em Pendências. Concluída, baixe o PDF e envie ao cliente."
        acoes={
          <Link to="/documentos/apr/nova">
            <Button>
              <Plus className="size-5" aria-hidden /> Nova APR
            </Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          aria-label="Buscar"
          placeholder="Buscar por número, cliente ou local…"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-borda bg-white px-3"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select
          aria-label="Situação"
          className="w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="">Todas</option>
          <option value="pendente">Aguardando assinaturas</option>
          <option value="concluida">Concluídas</option>
          <option value="cancelada">Canceladas</option>
        </Select>
      </div>
      {pdf.erro && (
        <div className="mb-4">
          <Aviso tipo="erro">{pdf.erro}</Aviso>
        </div>
      )}
      {aprs.isPending && <Carregando />}
      {aprs.isError && <Aviso tipo="erro">{mensagemDeErro(aprs.error)}</Aviso>}
      {aprs.isSuccess && lista.length === 0 && (
        <p className="rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          {termo || status ? 'Nenhuma APR encontrada.' : 'Nenhuma APR emitida ainda.'}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {lista.map((a) => {
          const s = situacao(a)
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borda bg-white p-4"
            >
              <Link to={`/documentos/apr/${a.id}`} className="min-w-0 hover:underline">
                <p className="font-semibold text-verde-escuro">
                  APR {numeroApr(a)} · {a.cliente_nome}
                  {a.local && ` · ${a.local}`}
                </p>
                <p className="text-sm text-texto-suave">
                  {nomeModelo(a.modelo)} · {formatarData(a.data)} ·{' '}
                  {participantesEmOrdem(a)
                    .map((p) => p.nome)
                    .join(', ')}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <Etiqueta cor={s.cor}>{s.texto}</Etiqueta>
                <Button
                  variante="secundario"
                  onClick={() => void pdf.baixar(a)}
                  disabled={pdf.gerando === a.id}
                  aria-label={`Baixar o PDF da APR ${numeroApr(a)}`}
                >
                  <FileDown className="size-5" aria-hidden />
                  {pdf.gerando === a.id ? 'Gerando…' : 'PDF'}
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
// Detalhe
// -----------------------------------------------------------------------------

/** /documentos/apr/:id */
export function AprPage() {
  const { id } = useParams()
  const apr = useApr(id)
  const pdf = useBaixarPdf()
  const [cancelando, setCancelando] = useState(false)

  if (apr.isPending) return <Carregando />
  if (apr.isError) return <Aviso tipo="erro">{mensagemDeErro(apr.error)}</Aviso>
  if (!apr.data) return <Aviso tipo="erro">APR não encontrada.</Aviso>
  const a = apr.data
  const s = situacao(a)
  const etapas = lerEtapas(a.etapas)
  const epis = lerEpis(a.epis)

  return (
    <>
      <PageHeader
        titulo={`APR ${numeroApr(a)}`}
        descricao={`${a.cliente_nome}${a.local ? ` · ${a.local}` : ''} · ${formatarData(a.data)}`}
        acoes={
          <>
            {a.status !== 'cancelada' && (
              <Link to={`/documentos/apr/${a.id}/editar`}>
                <Button variante="secundario">
                  <Pencil className="size-5" aria-hidden /> Editar
                </Button>
              </Link>
            )}
            <Button onClick={() => void pdf.baixar(a)} disabled={pdf.gerando === a.id}>
              <FileDown className="size-5" aria-hidden />
              {pdf.gerando === a.id ? 'Gerando…' : 'Baixar PDF'}
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        {pdf.erro && <Aviso tipo="erro">{pdf.erro}</Aviso>}
        {a.status === 'pendente' && (
          <Aviso tipo="info">
            Os técnicos assinam no celular, em <strong>Pendências</strong>. Quando todos assinarem,
            a APR fica concluída.
          </Aviso>
        )}
        {a.status === 'cancelada' && (
          <Aviso tipo="erro">Cancelada: {a.motivo_cancelamento ?? 'sem motivo informado'}.</Aviso>
        )}
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-titulo text-lg font-bold text-verde-escuro">{a.titulo}</h2>
            <Etiqueta cor={s.cor}>{s.texto}</Etiqueta>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Dado rotulo="Modelo">{nomeModelo(a.modelo)}</Dado>
            <Dado rotulo="Data">{formatarData(a.data)}</Dado>
            <Dado rotulo="Cliente">{a.cliente_nome}</Dado>
            {a.cliente_documento && <Dado rotulo="CNPJ/CPF">{a.cliente_documento}</Dado>}
            {a.local && <Dado rotulo="Local">{a.local}</Dado>}
            {a.endereco_texto && <Dado rotulo="Endereço">{a.endereco_texto}</Dado>}
            {a.descricao_atividade && <Dado rotulo="Atividade">{a.descricao_atividade}</Dado>}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-titulo text-lg font-bold text-verde-escuro">Assinaturas</h2>
          <ul className="flex flex-col divide-y divide-borda">
            {participantesEmOrdem(a).map((p) => (
              <li
                key={p.perfil_id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  <strong>{p.nome}</strong>
                  <span className="text-sm text-texto-suave"> · {p.funcao}</span>
                </span>
                {p.assinada_em ? (
                  <Etiqueta cor="verde">
                    Assinou em {new Date(p.assinada_em).toLocaleString('pt-BR')}
                  </Etiqueta>
                ) : (
                  <Etiqueta cor="alerta">Falta assinar</Etiqueta>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-titulo text-lg font-bold text-verde-escuro">
            Etapas ({etapas.length})
          </h2>
          <ol className="flex flex-col gap-3">
            {etapas.map((e, i) => (
              <li key={i} className="rounded-xl border border-borda p-3 text-sm">
                <p className="font-semibold">
                  {i + 1}. {e.etapa}
                </p>
                <ResumoEtapa e={e} />
              </li>
            ))}
          </ol>
          {epis.length > 0 && (
            <p className="mt-3 text-sm">
              <strong>EPIs:</strong> {epis.join(' · ')}
            </p>
          )}
          {a.observacoes && (
            <p className="mt-2 text-sm whitespace-pre-line">
              <strong>Observações:</strong> {a.observacoes}
            </p>
          )}
        </Card>

        {a.status !== 'cancelada' && (
          <div>
            <Button variante="fantasma" onClick={() => setCancelando(true)}>
              <XCircle className="size-5" aria-hidden /> Cancelar APR
            </Button>
          </div>
        )}
      </div>
      <Modal aberto={cancelando} aoFechar={() => setCancelando(false)} titulo="Cancelar APR">
        <Cancelar apr={a} aoFechar={() => setCancelando(false)} />
      </Modal>
    </>
  )
}

export function ResumoEtapa({ e }: { e: EtapaApr }) {
  const linhas: [string, string][] = [
    ['Riscos', e.riscos],
    ['Medidas de controle', e.medidas],
    ['O que pode dar errado', e.o_que_pode_dar_errado],
    ['Ações corretivas', e.acoes],
  ]
  return (
    <dl className="mt-1 flex flex-col gap-1">
      {linhas
        .filter(([, v]) => v)
        .map(([r, v]) => (
          <div key={r}>
            <dt className="inline font-semibold text-texto-suave">{r}: </dt>
            <dd className="inline">{v}</dd>
          </div>
        ))}
    </dl>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

function Cancelar({ apr, aoFechar }: { apr: Apr; aoFechar: () => void }) {
  const cancelar = useCancelarApr(apr.id)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        cancelar.mutate(motivo, {
          onSuccess: aoFechar,
          onError: (err) => setErro(mensagemDeErro(err)),
        })
      }}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo rotulo="Motivo" htmlFor="apr-motivo" obrigatorio>
        <Input id="apr-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <p className="text-sm text-texto-suave">
        Some das pendências dos técnicos. O PDF passa a sair com &quot;CANCELADA&quot;.
      </p>
      <div className="flex justify-end gap-2">
        <Button variante="fantasma" type="button" onClick={aoFechar}>
          Voltar
        </Button>
        <Button type="submit" disabled={cancelar.isPending}>
          {cancelar.isPending ? 'Cancelando…' : 'Cancelar APR'}
        </Button>
      </div>
    </form>
  )
}

// -----------------------------------------------------------------------------
// Emitir / editar
// -----------------------------------------------------------------------------

/** /documentos/apr/nova e /documentos/apr/:id/editar */
export function AprFormPage() {
  const { id } = useParams()
  const apr = useApr(id)
  if (id && apr.isPending) return <Carregando />
  if (id && apr.isError) return <Aviso tipo="erro">{mensagemDeErro(apr.error)}</Aviso>
  if (id && !apr.data) return <Aviso tipo="erro">APR não encontrada.</Aviso>
  return <Formulario key={id ?? 'nova'} apr={apr.data ?? null} />
}

function Formulario({ apr }: { apr: Apr | null }) {
  const navigate = useNavigate()
  const emitir = useEmitirApr()
  const atualizar = useAtualizarApr(apr?.id ?? '')
  const equipe = useEquipeApr()

  const [cliente, setCliente] = useState<ClienteEscolhido | null>(
    apr ? { id: apr.cliente_id, nome: apr.cliente_nome } : null,
  )
  const dadosCliente = useCliente(cliente?.id ?? '')
  const [enderecoId, setEnderecoId] = useState(apr?.endereco_id ?? '')
  const [modelo, setModelo] = useState<ModeloApr>((apr?.modelo as ModeloApr) ?? 'reservatorio')
  const [titulo, setTitulo] = useState(apr?.titulo ?? MODELOS_APR.reservatorio.titulo)
  const [atividade, setAtividade] = useState(
    apr?.descricao_atividade ?? MODELOS_APR.reservatorio.descricao,
  )
  const [local, setLocal] = useState(apr?.local ?? '')
  const [enderecoTexto, setEnderecoTexto] = useState(apr?.endereco_texto ?? '')
  const [data, setData] = useState(apr?.data ?? hojeISO())
  const [etapas, setEtapas] = useState<EtapaApr[]>(() =>
    apr ? lerEtapas(apr.etapas) : MODELOS_APR.reservatorio.etapas.map((e) => ({ ...e })),
  )
  const [epis, setEpis] = useState(() =>
    (apr ? lerEpis(apr.epis) : MODELOS_APR.reservatorio.epis).join('\n'),
  )
  const [observacoes, setObservacoes] = useState(apr?.observacoes ?? '')
  const [tecnicos, setTecnicos] = useState<string[]>(() =>
    apr ? participantesEmOrdem(apr).map((p) => p.perfil_id) : [],
  )
  const assinaram = new Set(
    apr?.participantes.filter((p) => p.assinada_em).map((p) => p.perfil_id) ?? [],
  )
  const [verOutros, setVerOutros] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const enderecos = dadosCliente.data?.enderecos.filter((e) => e.ativo) ?? []

  function escolherEndereco(id: string) {
    setEnderecoId(id)
    const e = enderecos.find((x) => x.id === id)
    if (!e) return
    if (e.apelido) setLocal(e.apelido)
    setEnderecoTexto(
      [[e.logradouro, e.numero].filter(Boolean).join(', '), e.bairro, `${e.cidade}/${e.uf}`]
        .filter(Boolean)
        .join(' - '),
    )
  }

  function escolherCliente(c: ClienteEscolhido | null) {
    setCliente(c)
    setEnderecoId('')
    setLocal('')
    setEnderecoTexto('')
  }

  function escolherModelo(m: ModeloApr) {
    if (m === modelo) return
    const mudou =
      JSON.stringify(limparEtapas(etapas)) !==
      JSON.stringify(limparEtapas(MODELOS_APR[modelo].etapas))
    if (mudou && !window.confirm('Trocar o modelo apaga as etapas que você mudou. Continuar?'))
      return
    setModelo(m)
    setTitulo(MODELOS_APR[m].titulo)
    setAtividade(MODELOS_APR[m].descricao)
    setEtapas(MODELOS_APR[m].etapas.map((e) => ({ ...e })))
    setEpis(MODELOS_APR[m].epis.join('\n'))
  }

  function alternarTecnico(id: string) {
    if (assinaram.has(id)) return
    setTecnicos((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const limpas = limparEtapas(etapas)
    if (!cliente) return setErro('Escolha o cliente.')
    if (enderecos.length > 1 && !enderecoId && !apr) return setErro('Escolha a unidade do cliente.')
    if (titulo.trim().length < 3) return setErro('Escreva o título da atividade.')
    if (limpas.length === 0) return setErro('A APR precisa de pelo menos uma etapa.')
    if (limpas.some((x) => !x.etapa)) return setErro('Toda etapa precisa do nome da etapa.')
    if (tecnicos.length === 0) return setErro('Escolha quem vai assinar.')
    const comuns = {
      titulo,
      descricaoAtividade: atividade,
      local,
      enderecoTexto,
      data,
      etapas: limpas,
      epis: epis
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      observacoes,
      tecnicos,
    }
    try {
      if (apr) {
        await atualizar.mutateAsync(comuns)
        navigate(`/documentos/apr/${apr.id}`)
      } else {
        const unidade =
          enderecos.find((x) => x.id === enderecoId) ??
          (enderecos.length === 1 ? enderecos[0] : undefined)
        const doc = unidade?.cnpj || dadosCliente.data?.cpf_cnpj
        const id = await emitir.mutateAsync({
          ...comuns,
          modelo,
          clienteId: cliente.id,
          enderecoId: unidade?.id ?? null,
          clienteNome:
            unidade?.razao_social ||
            dadosCliente.data?.nome_fantasia ||
            dadosCliente.data?.nome ||
            cliente.nome,
          clienteDocumento: doc
            ? doc.replace(/\D/g, '').length > 11
              ? formatarCnpj(doc)
              : formatarCpf(doc)
            : null,
        })
        navigate(`/documentos/apr/${id}`)
      }
    } catch (err) {
      setErro(mensagemDeErro(err))
    }
  }

  const operadores = equipe.data?.filter((p) => p.papel === 'operador') ?? []
  const outros = equipe.data?.filter((p) => p.papel !== 'operador') ?? []
  const salvando = emitir.isPending || atualizar.isPending

  return (
    <form onSubmit={(e) => void salvar(e)} className="flex flex-col gap-4">
      <PageHeader
        titulo={apr ? `Editar APR ${numeroApr(apr)}` : 'Nova APR'}
        descricao="Os técnicos escolhidos recebem a APR em Pendências, no celular, para assinar."
      />

      <Card className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Cliente e serviço</h2>
        <Campo rotulo="Cliente" htmlFor="apr-cliente" obrigatorio>
          {apr ? (
            <p className="font-semibold">{apr.cliente_nome}</p>
          ) : (
            <ClienteSeletor id="apr-cliente" valor={cliente} aoMudar={escolherCliente} />
          )}
        </Campo>
        {!apr && cliente && enderecos.length > 0 && (
          <Campo rotulo="Unidade" htmlFor="apr-unidade">
            <Select
              id="apr-unidade"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Local do serviço" htmlFor="apr-local" dica="Ex.: Carlos Gomes Center">
            <Input id="apr-local" value={local} onChange={(e) => setLocal(e.target.value)} />
          </Campo>
          <Campo rotulo="Data" htmlFor="apr-data" obrigatorio>
            <Input
              id="apr-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </Campo>
        </div>
        <Campo rotulo="Endereço" htmlFor="apr-endereco">
          <Input
            id="apr-endereco"
            value={enderecoTexto}
            onChange={(e) => setEnderecoTexto(e.target.value)}
          />
        </Campo>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Modelo da análise</h2>
        {apr ? (
          <p>
            <strong>{nomeModelo(apr.modelo)}</strong>
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Modelo">
            {(Object.keys(MODELOS_APR) as ModeloApr[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modelo === m}
                onClick={() => escolherModelo(m)}
                className={cn(
                  'min-h-12 rounded-xl border-2 px-3 font-semibold',
                  modelo === m
                    ? 'border-verde bg-verde text-white'
                    : 'border-borda bg-white text-verde-escuro hover:bg-lima-claro',
                )}
              >
                {MODELOS_APR[m].nome}
              </button>
            ))}
          </div>
        )}
        <Campo rotulo="Título da atividade" htmlFor="apr-titulo" obrigatorio>
          <Input id="apr-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </Campo>
        <Campo rotulo="Descrição da atividade" htmlFor="apr-atividade">
          <Textarea
            id="apr-atividade"
            rows={2}
            value={atividade}
            onChange={(e) => setAtividade(e.target.value)}
          />
        </Campo>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">
          Quem assina <span className="text-perigo">*</span>
        </h2>
        {equipe.isPending && <Carregando />}
        {equipe.isError && <Aviso tipo="erro">{mensagemDeErro(equipe.error)}</Aviso>}
        <ListaPessoas
          pessoas={operadores}
          escolhidos={tecnicos}
          travados={assinaram}
          aoAlternar={alternarTecnico}
        />
        {outros.length > 0 && (
          <button
            type="button"
            className="flex items-center gap-1 self-start text-sm font-semibold text-verde"
            onClick={() => setVerOutros((v) => !v)}
          >
            <ChevronDown className={cn('size-4', verOutros && 'rotate-180')} aria-hidden />
            Supervisor ou outra pessoa da equipe
          </button>
        )}
        {(verOutros || outros.some((p) => tecnicos.includes(p.id))) && (
          <ListaPessoas
            pessoas={outros}
            escolhidos={tecnicos}
            travados={assinaram}
            aoAlternar={alternarTecnico}
          />
        )}
        {assinaram.size > 0 && (
          <p className="text-sm text-texto-suave">Quem já assinou não sai da APR.</p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">Etapas do trabalho</h2>
        <p className="text-sm text-texto-suave">
          Já vêm do modelo. Ajuste ao local se precisar (ex.: reservatório subterrâneo, coifa muito
          alta).
        </p>
        {etapas.map((e, i) => (
          <EditorEtapa
            key={i}
            n={i}
            etapa={e}
            aoMudar={(nova) => setEtapas((t) => t.map((x, j) => (j === i ? nova : x)))}
            aoTirar={() => setEtapas((t) => t.filter((_, j) => j !== i))}
          />
        ))}
        <Button
          variante="secundario"
          className="self-start"
          onClick={() => setEtapas((t) => [...t, { ...ETAPA_VAZIA }])}
        >
          <Plus className="size-5" aria-hidden /> Adicionar etapa
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <Campo rotulo="EPIs obrigatórios" htmlFor="apr-epis" dica="Um por linha.">
          <Textarea id="apr-epis" rows={6} value={epis} onChange={(e) => setEpis(e.target.value)} />
        </Campo>
        <Campo rotulo="Observações" htmlFor="apr-obs" dica="Riscos próprios do local, se houver.">
          <Textarea
            id="apr-obs"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </Campo>
      </Card>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex justify-end gap-2">
        <Button
          variante="fantasma"
          onClick={() => navigate(apr ? `/documentos/apr/${apr.id}` : '/documentos')}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : apr ? 'Salvar' : 'Emitir APR'}
        </Button>
      </div>
    </form>
  )
}

function ListaPessoas({
  pessoas,
  escolhidos,
  travados,
  aoAlternar,
}: {
  pessoas: { id: string; nome: string }[]
  escolhidos: string[]
  travados: Set<string>
  aoAlternar: (id: string) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {pessoas.map((p) => (
        <label
          key={p.id}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-xl border px-3',
            escolhidos.includes(p.id) ? 'border-verde bg-lima-claro' : 'border-borda',
          )}
        >
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={escolhidos.includes(p.id)}
            disabled={travados.has(p.id)}
            onChange={() => aoAlternar(p.id)}
          />
          <span className="font-semibold">{p.nome}</span>
          {travados.has(p.id) && <span className="text-xs text-verde">assinou</span>}
        </label>
      ))}
    </div>
  )
}

function EditorEtapa({
  n,
  etapa,
  aoMudar,
  aoTirar,
}: {
  n: number
  etapa: EtapaApr
  aoMudar: (e: EtapaApr) => void
  aoTirar: () => void
}) {
  const [aberta, setAberta] = useState(!etapa.etapa)
  const campos: [keyof EtapaApr, string][] = [
    ['etapa', 'Etapa'],
    ['riscos', 'Riscos'],
    ['medidas', 'Medidas de controle (procedimento seguro)'],
    ['o_que_pode_dar_errado', 'O que pode dar errado'],
    ['acoes', 'Ações corretivas'],
  ]
  return (
    <div className="rounded-xl border border-borda">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={aberta}
          onClick={() => setAberta((a) => !a)}
        >
          <ChevronDown
            className={cn('size-5 shrink-0 text-verde', aberta && 'rotate-180')}
            aria-hidden
          />
          <span className="truncate font-semibold">
            {n + 1}. {etapa.etapa || 'Etapa nova'}
          </span>
        </button>
        <button
          type="button"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-perigo hover:bg-red-50"
          aria-label={`Tirar a etapa ${n + 1}`}
          onClick={aoTirar}
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
      {aberta && (
        <div className="flex flex-col gap-3 border-t border-borda p-3">
          {campos.map(([campo, rotulo]) => (
            <Campo key={campo} rotulo={rotulo} htmlFor={`etapa-${n}-${campo}`}>
              <Textarea
                id={`etapa-${n}-${campo}`}
                rows={campo === 'etapa' ? 2 : 3}
                value={etapa[campo]}
                onChange={(e) => aoMudar({ ...etapa, [campo]: e.target.value })}
              />
            </Campo>
          ))}
        </div>
      )}
    </div>
  )
}
