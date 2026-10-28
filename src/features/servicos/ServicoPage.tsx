import { ArrowLeft, Ban, CheckCircle2, Pencil, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { ListaArquivos } from '../arquivos/ListaArquivos'
import { usePerfil } from '../auth/useAuth'
import { useCategorias } from '../financeiro/api'
import { NOME_SITUACAO, type Situacao } from '../financeiro/rotulos'
import {
  COR_STATUS_SERVICO,
  NOME_STATUS_SERVICO,
  useAtualizarServico,
  useLancamentosDoServico,
  useServico,
  type ServicoResumo,
} from './api'

export function ServicoPage() {
  const { id } = useParams()
  const servico = useServico(id)
  if (servico.isPending) return <Carregando />
  if (servico.isError) return <Aviso tipo="erro">{mensagemDeErro(servico.error)}</Aviso>
  if (!servico.data) {
    return <Aviso tipo="erro">Serviço não encontrado ou sem permissão de acesso.</Aviso>
  }
  return <Detalhe s={servico.data} />
}

function Detalhe({ s }: { s: ServicoResumo }) {
  const perfil = usePerfil()
  const acessoTotal = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const atualizar = useAtualizarServico(s.id)
  const [concluindo, setConcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const nomeCliente = s.cliente?.nome_fantasia || s.cliente?.nome || ''

  async function cancelar() {
    if (!window.confirm('Cancelar este serviço? Ele fica no histórico.')) return
    try {
      await atualizar.mutateAsync({ status: 'cancelado' })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const vinculo = { clienteId: s.cliente_id, servicoId: s.id }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/servicos"
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Serviços
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{s.tipo?.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <Etiqueta cor={COR_STATUS_SERVICO[s.status]}>{NOME_STATUS_SERVICO[s.status]}</Etiqueta>
            <span>{formatarData(s.data_execucao)}</span>
            <Link to={`/clientes/${s.cliente_id}`} className="font-semibold text-verde underline">
              {nomeCliente}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.status === 'agendado' && (
            <Button onClick={() => setConcluindo(true)}>
              <CheckCircle2 className="size-5" aria-hidden /> Marcar como feito
            </Button>
          )}
          {s.status !== 'cancelado' && (
            <Button variante="secundario" onClick={() => void cancelar()}>
              <Ban className="size-4" aria-hidden /> Cancelar
            </Button>
          )}
          <Link
            to={`/servicos/${s.id}/editar`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
        </div>
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold">Dados</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Dado
              rotulo="Endereço"
              valor={
                s.endereco
                  ? [
                      s.endereco.apelido,
                      `${s.endereco.logradouro}, ${s.endereco.numero ?? 's/n'}`,
                      `${s.endereco.cidade}/${s.endereco.uf}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Não informado'
              }
            />
            <Dado rotulo="Valor" valor={s.valor != null ? formatarReais(s.valor) : '—'} />
            <Dado rotulo="Vendedor" valor={s.vendedor?.nome} />
            <Dado rotulo="Nº do certificado" valor={s.numero_certificado} />
            <Dado rotulo="Técnicos" valor={s.tecnicos} />
            {s.periodicidade_meses && (
              <Dado rotulo="Repetir a cada" valor={`${s.periodicidade_meses} meses (combinado)`} />
            )}
            {s.proposta && (
              <div>
                <dt className="text-texto-suave">Proposta</dt>
                <dd>
                  <Link
                    to={`/propostas/${s.proposta.id}`}
                    className="font-semibold text-verde underline"
                  >
                    {s.proposta.numero}
                  </Link>
                </dd>
              </div>
            )}
            {s.observacoes && <Dado rotulo="Observações" valor={s.observacoes} />}
          </dl>
        </Card>

        {acessoTotal && <CartaoFinanceiro s={s} nomeCliente={nomeCliente} />}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Certificado</h2>
          <ListaArquivos
            {...vinculo}
            categoria="certificado"
            filtrarPorCategoria
            textoVazio="Anexe o certificado de execução (PDF ou foto)."
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Relatório</h2>
          <ListaArquivos
            {...vinculo}
            categoria="relatorio"
            filtrarPorCategoria
            textoVazio="Anexe o relatório do serviço."
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Fotos de antes</h2>
          <ListaArquivos
            {...vinculo}
            categoria="foto_antes"
            filtrarPorCategoria
            miniaturas
            textoVazio="Nenhuma foto."
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Fotos de depois</h2>
          <ListaArquivos
            {...vinculo}
            categoria="foto_depois"
            filtrarPorCategoria
            miniaturas
            textoVazio="Nenhuma foto."
          />
        </Card>
      </div>

      <ConcluirModal
        aberto={concluindo}
        aoFechar={() => setConcluindo(false)}
        servico={s}
        aoErro={setErro}
      />
    </div>
  )
}

/** Conta a receber deste serviço (só Admin/Financeiro). */
function CartaoFinanceiro({ s, nomeCliente }: { s: ServicoResumo; nomeCliente: string }) {
  const lancamentos = useLancamentosDoServico(s.id, true)
  const categorias = useCategorias()
  const servicosPrestados = categorias.data?.find(
    (c) => c.tipo === 'receita' && c.nome === 'Serviços prestados',
  )

  // Vencimento = data do serviço + prazo combinado na proposta.
  const prazo = s.proposta?.prazo_pagamento_dias ?? 0
  const parametros = new URLSearchParams({
    tipo: 'entrada',
    cliente: s.cliente_id,
    cliente_nome: nomeCliente,
    descricao: s.tipo?.nome ?? 'Serviço',
    valor: String(s.valor ?? ''),
    vencimento: somarDias(s.data_execucao, prazo),
    servico: s.id,
    ...(servicosPrestados ? { categoria: servicosPrestados.id } : {}),
  })

  return (
    <Card>
      <h2 className="mb-3 text-lg font-bold">Financeiro</h2>
      {lancamentos.isPending && <Carregando />}
      {lancamentos.data?.map((l) => (
        <Link
          key={l.id}
          to={`/financeiro/lancamentos/${l.id}`}
          className="mb-2 block rounded-xl border border-borda p-3 text-sm hover:bg-fundo-suave"
        >
          <strong>{formatarReais(l.valor)}</strong> · vence {formatarData(l.vencimento)} ·{' '}
          {NOME_SITUACAO[(l.situacao ?? l.status) as Situacao]}
        </Link>
      ))}
      {lancamentos.data?.length === 0 &&
        (s.status === 'realizado' && Number(s.valor) > 0 ? (
          <>
            <p className="mb-3 text-sm text-texto-suave">
              Serviço feito e ainda sem conta a receber.
              {prazo > 0 && ` Prazo combinado: ${prazo} dias.`}
            </p>
            <Link
              to={`/financeiro/lancamentos/novo?${parametros}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
            >
              <Receipt className="size-4" aria-hidden /> Lançar conta a receber
            </Link>
          </>
        ) : (
          <p className="text-sm text-texto-suave">
            {s.status === 'realizado'
              ? 'Sem valor informado no serviço.'
              : 'A conta a receber é lançada depois que o serviço for feito.'}
          </p>
        ))}
    </Card>
  )
}

function ConcluirModal({
  aberto,
  aoFechar,
  servico,
  aoErro,
}: {
  aberto: boolean
  aoFechar: () => void
  servico: ServicoResumo
  aoErro: (mensagem: string) => void
}) {
  const atualizar = useAtualizarServico(servico.id)
  const hoje = hojeISO()
  const [data, setData] = useState(servico.data_execucao > hoje ? hoje : servico.data_execucao)
  const [certificado, setCertificado] = useState(servico.numero_certificado ?? '')

  async function concluir() {
    try {
      await atualizar.mutateAsync({
        status: 'realizado',
        data_execucao: data,
        numero_certificado: certificado.trim() || null,
      })
      aoFechar()
    } catch (e) {
      aoErro(mensagemDeErro(e))
      aoFechar()
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Marcar como feito">
      <div className="flex flex-col gap-4">
        <Campo rotulo="Data em que foi feito" htmlFor="data-feito">
          <Input
            id="data-feito"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Nº do certificado" htmlFor="cert-feito">
          <Input
            id="cert-feito"
            value={certificado}
            onChange={(e) => setCertificado(e.target.value)}
          />
        </Campo>
        <p className="text-sm text-texto-suave">
          O próximo vencimento deste serviço é recalculado a partir desta data.
        </p>
        <Button disabled={!data || atualizar.isPending} onClick={() => void concluir()}>
          {atualizar.isPending ? 'Salvando…' : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  )
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-texto-suave">{rotulo}</dt>
      <dd className="font-semibold whitespace-pre-line">{valor || '—'}</dd>
    </div>
  )
}
