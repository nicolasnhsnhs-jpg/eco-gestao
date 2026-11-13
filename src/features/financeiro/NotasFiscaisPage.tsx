import { FileText, HandCoins, Landmark, Plus, Search, Send, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, formatarMes, hojeISO } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { juntarEmails } from '@/lib/emails'
import { mensagemDeErro } from '@/lib/erros'
import { useValorAtrasado } from '@/lib/useValorAtrasado'
import { cn } from '@/lib/utils'

import { AntecipacaoModal } from './AntecipacaoModal'
import { totalBruto } from './antecipacao'
import { aceitaBoletoEmLote, contaParaAntecipar, oQueFoiEnviado, textoEmissao } from './notas'
import {
  BANCOS_DA_UNIDADE,
  NOME_BANCO,
  NOME_TIPO_NOTA,
  useAmbienteNfse,
  useConfigBoleto,
  useEmitirNota,
  useEnviarNotaPorEmail,
  useGerarBoleto,
  useNotasFiscais,
  usePrepararBoletoDoRascunho,
  type BancoBoleto,
  type FiltroNotas,
  type NotaFiscalCompleta,
} from './notasApi'

export function NotasFiscaisPage() {
  // Filtros no endereço (?mes=2026-11&tipo=contrato…): "voltar" mantém tudo.
  const [parametros, setParametros] = useSearchParams()
  // Modo antecipar: só notas emitidas com a conta a receber em aberto, filtradas pelo dia
  // da emissão (?antecipar=1&dia=2026-11-10), com caixinhas para escolher.
  const antecipando = parametros.get('antecipar') === '1'
  const filtro: FiltroNotas = {
    mes: antecipando ? '' : (parametros.get('mes') ?? ''),
    dia: antecipando ? (parametros.get('dia') ?? '') : '',
    tipo: (parametros.get('tipo') as FiltroNotas['tipo']) ?? 'todos',
    status: antecipando
      ? 'emitida'
      : ((parametros.get('status') as FiltroNotas['status']) ?? 'emitida'),
    busca: parametros.get('q') ?? '',
  }
  const buscaAtrasada = useValorAtrasado(filtro.busca)
  const notas = useNotasFiscais({ ...filtro, busca: buscaAtrasada })
  const ambiente = useAmbienteNfse()
  const configBoleto = useConfigBoleto()
  // Na lista de rascunhos, com a emissão ligada: marcar várias e emitir de uma vez.
  const emLote = !antecipando && filtro.status === 'rascunho' && ambiente.data === 'producao'
  // Na lista de emitidas, com um banco ligado: marcar as sem boleto e gerar de uma vez.
  // Só com o mês escolhido no filtro, para não pegar as notas antigas que nunca tiveram boleto.
  const bancoLigado = BANCOS_DA_UNIDADE.some((b) => configBoleto.data?.ambiente[b] === 'producao')
  const boletoEmLote = !antecipando && filtro.status === 'emitida' && bancoLigado && !!filtro.mes
  const pedirMes = !antecipando && filtro.status === 'emitida' && bancoLigado && !filtro.mes
  // Cada barra só conta as marcadas que estão na lista dela (rascunhos e emitidas são outras notas).
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [antecipacaoAberta, setAntecipacaoAberta] = useState(false)

  function mudar(chave: string, valor: string) {
    const novos = new URLSearchParams(parametros)
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    setParametros(novos, { replace: true })
  }

  function alternarAntecipacao(ligar: boolean) {
    const novos = new URLSearchParams(parametros)
    if (ligar) {
      novos.set('antecipar', '1')
      novos.set('dia', hojeISO())
    } else {
      novos.delete('antecipar')
      novos.delete('dia')
    }
    setParametros(novos, { replace: true })
    setMarcadas(new Set())
  }

  const todasDoFiltro = notas.data ?? []
  // Na antecipação só aparecem as que dá para antecipar; as outras do dia são contadas à parte.
  const lista = antecipando ? todasDoFiltro.filter((n) => contaParaAntecipar(n)) : todasDoFiltro
  const foraDaAntecipacao = todasDoFiltro.length - lista.length
  // Só valem as marcadas que ainda aparecem na lista (o filtro pode ter mudado).
  const contasMarcadas = antecipando
    ? lista.filter((n) => marcadas.has(n.id)).map((n) => contaParaAntecipar(n)!)
    : []
  const somar = (lista: NotaFiscalCompleta[]) =>
    lista.reduce((s, n) => s + Number(n.valor_servico), 0)
  const deContrato = lista.filter((n) => n.tipo === 'contrato')
  const avulsas = lista.filter((n) => n.tipo === 'avulsa')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notas fiscais</h1>
        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" onClick={() => alternarAntecipacao(!antecipando)}>
            {antecipando ? (
              <>
                <X className="size-5" aria-hidden /> Sair da antecipação
              </>
            ) : (
              <>
                <HandCoins className="size-5" aria-hidden /> Antecipar
              </>
            )}
          </Button>
          <Link
            to="/financeiro/notas/nova?tipo=contrato"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden /> Nota de contrato
          </Link>
          <Link
            to="/financeiro/notas/nova?tipo=avulsa"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Plus className="size-5" aria-hidden /> Nota avulsa
          </Link>
        </div>
      </div>

      {antecipando && (
        <div className="mb-4">
          <Aviso>
            Escolha o <strong>dia da emissão</strong>, marque as notas que foram antecipadas e toque
            em <strong>Antecipar</strong>. Aparecem só as notas com a conta a receber em aberto; os
            vencimentos dos clientes continuam registrados e no saldo entra só o que caiu na conta.{' '}
            <Link to="/financeiro/antecipacoes" className="font-semibold underline">
              Ver antecipações feitas
            </Link>
          </Aviso>
        </div>
      )}

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Buscar pelo número ou descrição</span>
          <Search
            className="pointer-events-none absolute top-3 left-3 size-5 text-texto-suave"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Nº da nota ou descrição"
            className="pl-10"
            value={filtro.busca}
            onChange={(e) => mudar('q', e.target.value)}
          />
        </label>
        <Select
          aria-label="Tipo"
          value={filtro.tipo}
          onChange={(e) => mudar('tipo', e.target.value === 'todos' ? '' : e.target.value)}
        >
          <option value="todos">Contrato e avulsa</option>
          <option value="contrato">Só de contrato</option>
          <option value="avulsa">Só avulsas</option>
        </Select>
        <Select
          aria-label="Situação"
          value={filtro.status}
          disabled={antecipando}
          onChange={(e) => mudar('status', e.target.value === 'emitida' ? '' : e.target.value)}
        >
          <option value="emitida">Emitidas</option>
          <option value="rascunho">Rascunhos (a emitir)</option>
          <option value="cancelada">Canceladas</option>
          <option value="todos">Todas</option>
        </Select>
        {antecipando ? (
          <Input
            type="date"
            aria-label="Dia da emissão"
            title="Dia da emissão (vazio = todos)"
            value={filtro.dia}
            onChange={(e) => mudar('dia', e.target.value)}
          />
        ) : (
          <Input
            type="month"
            aria-label="Mês de competência"
            title="Mês de competência (vazio = todos)"
            value={filtro.mes}
            onChange={(e) => mudar('mes', e.target.value)}
          />
        )}
      </Card>

      {!antecipando && <RascunhosDoMes />}

      {notas.isError && <Aviso tipo="erro">{mensagemDeErro(notas.error)}</Aviso>}
      {notas.isPending && <Carregando />}

      {notas.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          {antecipando
            ? 'Nenhuma nota para antecipar com estes filtros.'
            : 'Nenhuma nota fiscal com estes filtros.'}
        </Card>
      )}

      {antecipando && notas.isSuccess && foraDaAntecipacao > 0 && (
        <p className="mb-3 text-sm text-texto-suave">
          {foraDaAntecipacao} nota(s) com estes filtros ficaram de fora: já recebidas, antecipadas
          ou sem conta a receber.
        </p>
      )}

      {lista.length > 0 && (
        <>
          {antecipando && (
            <div className="mb-2 px-4">
              <MarcarTodas
                lista={lista}
                marcadas={marcadas}
                aoMarcar={setMarcadas}
                disabled={false}
              />
            </div>
          )}
          {emLote && <EmitirMarcadas lista={lista} marcadas={marcadas} aoMarcar={setMarcadas} />}
          {boletoEmLote && (
            <BoletoDasMarcadas lista={lista} marcadas={marcadas} aoMarcar={setMarcadas} />
          )}
          {pedirMes && (
            <p className="mb-3 text-sm text-texto-suave">
              Para gerar boleto de várias notas de uma vez, escolha o mês de competência no filtro.
            </p>
          )}
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
            {lista.map((n) => (
              <LinhaNota
                key={n.id}
                n={n}
                marcada={
                  antecipando || emLote || (boletoEmLote && aceitaBoletoEmLote(n))
                    ? marcadas.has(n.id)
                    : undefined
                }
                antecipacao={antecipando}
                aoMarcar={(sim) => {
                  const novas = new Set(marcadas)
                  if (sim) novas.add(n.id)
                  else novas.delete(n.id)
                  setMarcadas(novas)
                }}
              />
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
            <span>
              {deContrato.length} de contrato:{' '}
              <strong className="text-verde">{formatarReais(somar(deContrato))}</strong>
            </span>
            <span>
              {avulsas.length} avulsa(s):{' '}
              <strong className="text-verde">{formatarReais(somar(avulsas))}</strong>
            </span>
            <span>
              Total: <strong>{formatarReais(somar(lista))}</strong>
            </span>
          </div>
        </>
      )}

      {antecipando && contasMarcadas.length > 0 && (
        <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borda bg-white p-3 shadow-lg">
          <p className="text-sm">
            {contasMarcadas.length} nota(s) marcada(s) · A receber{' '}
            <strong className="text-verde">
              {formatarReais(totalBruto(contasMarcadas.map((l) => l.valor ?? 0)))}
            </strong>
          </p>
          <Button onClick={() => setAntecipacaoAberta(true)}>
            <HandCoins className="size-5" aria-hidden /> Antecipar
          </Button>
        </div>
      )}

      <AntecipacaoModal
        aberto={antecipacaoAberta}
        selecionados={contasMarcadas}
        aoFechar={() => setAntecipacaoAberta(false)}
        aoAntecipar={() => {
          setAntecipacaoAberta(false)
          setMarcadas(new Set())
        }}
      />
    </>
  )
}

export function LinhaNota({
  n,
  marcada,
  aoMarcar,
  antecipacao,
}: {
  n: NotaFiscalCompleta
  /** Com valor, a linha ganha a caixa de marcar (emissão em lote). */
  marcada?: boolean
  aoMarcar?: (sim: boolean) => void
  /** Na antecipação mostra o valor da conta a receber (é ele que é antecipado). */
  antecipacao?: boolean
}) {
  const cancelada = n.status === 'cancelada'
  const rascunho = n.status === 'rascunho'
  const envioPendente = n.status === 'emitida' && !!n.pdf && !n.enviada_em
  return (
    <li className="flex items-center">
      {marcada !== undefined && (
        <label className="flex min-h-11 cursor-pointer items-center self-stretch pl-4">
          <span className="sr-only">Marcar esta nota</span>
          <input
            type="checkbox"
            className="size-5 accent-verde"
            checked={marcada}
            onChange={(e) => aoMarcar?.(e.target.checked)}
          />
        </label>
      )}
      <Link
        to={`/financeiro/notas/${n.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-fundo-suave"
      >
        <FileText
          className={cn(
            'size-6 shrink-0',
            cancelada ? 'text-texto-suave' : rascunho ? 'text-alerta' : 'text-verde',
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold', cancelada && 'line-through')}>
            {rascunho ? 'Rascunho' : n.numero ? `NF ${n.numero}` : 'NF sem número'} ·{' '}
            {n.cliente?.nome_fantasia || n.cliente?.nome}
          </p>
          <p className="truncate text-sm text-texto-suave">
            {[
              !rascunho && `Emitida ${formatarData(n.data_emissao)}`,
              formatarMes(n.competencia),
              n.vencimento && `vence ${formatarData(n.vencimento)}`,
              n.contrato?.descricao,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <strong className="text-sm">
            {formatarReais(antecipacao && n.lancamento ? n.lancamento.valor : n.valor_servico)}
          </strong>
          <span className="flex gap-1">
            {cancelada && <Etiqueta cor="perigo">Cancelada</Etiqueta>}
            {rascunho && n.erro_emissao && <Etiqueta cor="perigo">Erro na emissão</Etiqueta>}
            {rascunho && <Etiqueta cor="alerta">A emitir</Etiqueta>}
            {envioPendente && <Etiqueta cor="perigo">Envio pendente</Etiqueta>}
            {n.enviada_em && <Etiqueta cor="cinza">Enviada</Etiqueta>}
            <Etiqueta cor={n.tipo === 'contrato' ? 'verde' : 'alerta'}>
              {NOME_TIPO_NOTA[n.tipo]}
            </Etiqueta>
          </span>
        </div>
      </Link>
    </li>
  )
}

/** Aviso no topo: notas do mês montadas pelo sistema que ainda não foram emitidas. */
function RascunhosDoMes() {
  const [parametros, setParametros] = useSearchParams()
  const rascunhos = useNotasFiscais({ mes: '', tipo: 'todos', status: 'rascunho', busca: '' })
  const total = rascunhos.data?.length ?? 0
  if (total === 0 || parametros.get('status') === 'rascunho') return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-alerta/30 bg-amber-50 px-4 py-3 text-sm">
      <span>
        <strong>{total}</strong> nota(s) de contrato em rascunho, prontas para conferir e emitir.
      </span>
      <button
        type="button"
        className="font-semibold text-verde-escuro underline"
        onClick={() => setParametros({ status: 'rascunho' }, { replace: true })}
      >
        Ver rascunhos
      </button>
    </div>
  )
}

type Progresso = {
  feitas: number
  total: number
  linhas: { id: string; nome: string; ok: boolean; texto: string }[]
}

const nomeDaNota = (n: NotaFiscalCompleta) => n.cliente?.nome_fantasia || n.cliente?.nome || ''

/** Passa pelas notas uma de cada vez (o erro de uma não para as outras), com progresso. */
function useLote() {
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const rodando = !!progresso && progresso.feitas < progresso.total
  async function rodar(
    notas: NotaFiscalCompleta[],
    fazer: (n: NotaFiscalCompleta) => Promise<string>,
  ) {
    const p: Progresso = { feitas: 0, total: notas.length, linhas: [] }
    setProgresso({ ...p })
    for (const n of notas) {
      try {
        p.linhas.push({ id: n.id, nome: nomeDaNota(n), ok: true, texto: await fazer(n) })
      } catch (erro) {
        p.linhas.push({ id: n.id, nome: nomeDaNota(n), ok: false, texto: mensagemDeErro(erro) })
      }
      p.feitas++
      setProgresso({ ...p, linhas: [...p.linhas] })
    }
  }
  return { progresso, rodando, rodar }
}

function ProgressoLote({
  progresso,
  rodando,
  feito,
  seErro,
}: {
  progresso: Progresso | null
  rodando: boolean
  /** "emitida(s)", "com boleto"… */
  feito: string
  seErro: string
}) {
  if (!progresso) return null
  const comErro = progresso.linhas.filter((l) => !l.ok)
  return (
    <>
      <div
        className="h-2 overflow-hidden rounded-full bg-fundo-suave"
        role="progressbar"
        aria-label="Andamento"
        aria-valuenow={progresso.feitas}
        aria-valuemax={progresso.total}
      >
        <div
          className="h-full bg-verde transition-all"
          style={{ width: `${(progresso.feitas / progresso.total) * 100}%` }}
        />
      </div>
      {!rodando && (
        <Aviso tipo={comErro.length ? 'erro' : 'sucesso'}>
          {progresso.total - comErro.length} de {progresso.total} {feito}.
          {comErro.length > 0 && ` ${seErro}`}
        </Aviso>
      )}
      {progresso.linhas.length > 0 && (
        <ul className="max-h-64 overflow-y-auto text-sm">
          {progresso.linhas.map((l) => (
            <li key={l.id} className={cn('py-1', l.ok ? 'text-verde-escuro' : 'text-perigo')}>
              <strong>{l.nome}:</strong> {l.texto}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function MarcarTodas({
  lista,
  marcadas,
  aoMarcar,
  disabled,
  rotulo = 'Marcar todas',
}: {
  lista: NotaFiscalCompleta[]
  marcadas: Set<string>
  aoMarcar: (s: Set<string>) => void
  disabled: boolean
  rotulo?: string
}) {
  const todas = lista.length > 0 && lista.every((n) => marcadas.has(n.id))
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        className="size-5 accent-verde"
        checked={todas}
        disabled={disabled || lista.length === 0}
        onChange={() => aoMarcar(todas ? new Set() : new Set(lista.map((n) => n.id)))}
      />
      {rotulo} ({lista.length})
    </label>
  )
}

/**
 * Barra acima da lista de rascunhos: marca todas e emite as marcadas, uma a uma. Nas notas
 * por boleto, dá para escolher o banco: o boleto sai junto na emissão e vai no mesmo e-mail.
 */
function EmitirMarcadas({
  lista,
  marcadas,
  aoMarcar,
}: {
  lista: NotaFiscalCompleta[]
  marcadas: Set<string>
  aoMarcar: (s: Set<string>) => void
}) {
  const emitir = useEmitirNota()
  const preparar = usePrepararBoletoDoRascunho()
  const config = useConfigBoleto()
  const ligados = BANCOS_DA_UNIDADE.filter((b) => config.data?.ambiente[b] === 'producao')
  // "" = como está em cada nota; "sem" = nenhuma gera boleto; ou o banco de todas.
  const [boleto, setBoleto] = useState<'' | 'sem' | BancoBoleto>('')
  const { progresso, rodando, rodar } = useLote()
  const escolhidas = lista.filter((n) => marcadas.has(n.id))
  const porBoleto = escolhidas.filter((n) => n.forma_pagamento === 'boleto')

  async function emitirTodas() {
    const comBoleto =
      boleto && boleto !== 'sem' && porBoleto.length
        ? ` ${porBoleto.length} delas por boleto: o boleto sai no ${NOME_BANCO[boleto]} e vai junto no e-mail.`
        : ''
    if (
      !window.confirm(
        `Emitir ${escolhidas.length} nota(s) agora? Elas vão para o Sistema Nacional NFS-e e o PDF segue a cada cliente.${comBoleto}`,
      )
    )
      return
    // Uma de cada vez: a Sefin recusa pedidos demais seguidos.
    await rodar(escolhidas, async (n) => {
      if (boleto && n.forma_pagamento === 'boleto')
        await preparar.mutateAsync({ notaId: n.id, banco: boleto === 'sem' ? null : boleto })
      return textoEmissao(await emitir.mutateAsync(n.id))
    })
    aoMarcar(new Set())
  }

  return (
    <Card className="mb-3 flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MarcarTodas lista={lista} marcadas={marcadas} aoMarcar={aoMarcar} disabled={rodando} />
        <div className="flex flex-wrap items-center gap-2">
          {ligados.length > 0 && (
            <Select
              aria-label="Boleto das notas por boleto"
              className="w-auto"
              value={boleto}
              disabled={rodando}
              onChange={(e) => setBoleto(e.target.value as typeof boleto)}
            >
              <option value="">Boleto: como está em cada nota</option>
              {ligados.map((b) => (
                <option key={b} value={b}>
                  Gerar boleto no {NOME_BANCO[b]}
                </option>
              ))}
              <option value="sem">Sem boleto (gerar depois)</option>
            </Select>
          )}
          <Button disabled={rodando || escolhidas.length === 0} onClick={() => void emitirTodas()}>
            <Send className="size-4" aria-hidden />
            {rodando
              ? `Emitindo ${progresso!.feitas + 1} de ${progresso!.total}…`
              : `Emitir marcadas (${escolhidas.length})`}
          </Button>
        </div>
      </div>
      <ProgressoLote
        progresso={progresso}
        rodando={rodando}
        feito="emitida(s)"
        seErro="As que deram erro continuam na lista como rascunho."
      />
    </Card>
  )
}

/**
 * Barra acima da lista de emitidas: marca as notas sem boleto e gera o boleto de todas no
 * banco escolhido, uma a uma; com "enviar", cada cliente já recebe a nota e o boleto.
 */
function BoletoDasMarcadas({
  lista,
  marcadas,
  aoMarcar,
}: {
  lista: NotaFiscalCompleta[]
  marcadas: Set<string>
  aoMarcar: (s: Set<string>) => void
}) {
  const gerar = useGerarBoleto()
  const enviarEmail = useEnviarNotaPorEmail()
  const config = useConfigBoleto()
  const [enviar, setEnviar] = useState(true)
  const [banco, setBanco] = useState<BancoBoleto | null>(null)
  const { progresso, rodando, rodar } = useLote()
  const aceitas = lista.filter(aceitaBoletoEmLote)
  const escolhidas = aceitas.filter((n) => marcadas.has(n.id))
  const ligados = BANCOS_DA_UNIDADE.filter((b) => config.data?.ambiente[b] === 'producao')

  async function gerarTodas(b: BancoBoleto) {
    if (
      !window.confirm(
        `Gerar o boleto de ${escolhidas.length} nota(s) no ${NOME_BANCO[b]}?${enviar ? ' Cada cliente recebe por e-mail a nota e o boleto.' : ''}`,
      )
    )
      return
    setBanco(b)
    await rodar(escolhidas, async (n) => {
      const r = await gerar.mutateAsync({ notaId: n.id, banco: b })
      const texto = `boleto de ${formatarReais(r.valor)}, vence ${formatarData(r.vencimento)}`
      if (!enviar) return `${texto}.`
      if (!n.pdf) throw new Error(`${texto}, mas a nota ainda não tem PDF: não foi enviada.`)
      const e = await enviarEmail.mutateAsync({ notaId: n.id })
      if (!e.enviada) throw new Error(`${texto}, mas o e-mail não foi: ${e.motivo}`)
      return `${texto}; ${oQueFoiEnviado(e.comBoleto, e.boletos).toLowerCase()} para ${juntarEmails(e.para)}.`
    })
    aoMarcar(new Set())
  }

  if (aceitas.length === 0 && !progresso) return null
  return (
    <Card className="mb-3 flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MarcarTodas
          lista={aceitas}
          marcadas={marcadas}
          aoMarcar={aoMarcar}
          disabled={rodando}
          rotulo="Marcar todas sem boleto"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-verde"
              checked={enviar}
              disabled={rodando}
              onChange={(e) => setEnviar(e.target.checked)}
            />
            Enviar ao cliente logo depois
          </label>
          {BANCOS_DA_UNIDADE.map((b) => (
            <Button
              key={b}
              disabled={rodando || escolhidas.length === 0 || !ligados.includes(b)}
              title={ligados.includes(b) ? undefined : `O ${NOME_BANCO[b]} ainda não está valendo.`}
              onClick={() => void gerarTodas(b)}
            >
              <Landmark className="size-4" aria-hidden />
              {rodando && banco === b
                ? `Gerando ${progresso!.feitas + 1} de ${progresso!.total}…`
                : `Boleto no ${NOME_BANCO[b]} (${escolhidas.length})`}
            </Button>
          ))}
        </div>
      </div>
      <ProgressoLote
        progresso={progresso}
        rodando={rodando}
        feito={enviar ? 'com boleto e enviada(s)' : 'com boleto'}
        seErro="Confira as que deram erro: a nota fica como estava ou com o boleto já gerado."
      />
    </Card>
  )
}
