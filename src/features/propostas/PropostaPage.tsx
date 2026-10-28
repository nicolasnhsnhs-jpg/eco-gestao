import { ArrowLeft, Check, Pencil, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { ListaArquivos } from '../arquivos/ListaArquivos'
import {
  COR_SITUACAO_PROPOSTA,
  NOME_SITUACAO_PROPOSTA,
  useProposta,
  useResponderProposta,
  type PropostaCompleta,
  type SituacaoProposta,
} from './api'

export function PropostaPage() {
  const { id } = useParams()
  const proposta = useProposta(id)
  if (proposta.isPending) return <Carregando />
  if (proposta.isError) return <Aviso tipo="erro">{mensagemDeErro(proposta.error)}</Aviso>
  if (!proposta.data) {
    return <Aviso tipo="erro">Proposta não encontrada ou sem permissão de acesso.</Aviso>
  }
  return <Detalhe p={proposta.data} />
}

function Detalhe({ p }: { p: PropostaCompleta }) {
  const responder = useResponderProposta(p.id!)
  const [erro, setErro] = useState<string | null>(null)
  const situacao = (p.situacao ?? p.status) as SituacaoProposta
  const nomeCliente = p.cliente?.nome_fantasia || p.cliente?.nome

  async function mudar(status: 'aprovada' | 'recusada' | 'enviada') {
    setErro(null)
    let motivo: string | null = null
    if (status === 'recusada') {
      motivo = window.prompt('Motivo da recusa (opcional):') ?? null
      if (motivo === null) return
    }
    try {
      await responder.mutateAsync({ status, motivo_recusa: motivo?.trim() || null })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/propostas"
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Propostas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proposta {p.numero}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <Etiqueta cor={COR_SITUACAO_PROPOSTA[situacao]}>
              {NOME_SITUACAO_PROPOSTA[situacao]}
            </Etiqueta>
            <Link to={`/clientes/${p.cliente_id}`} className="font-semibold text-verde underline">
              {nomeCliente}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === 'enviada' ? (
            <>
              <Button onClick={() => void mudar('aprovada')} disabled={responder.isPending}>
                <Check className="size-4" aria-hidden /> Aprovada
              </Button>
              <Button
                variante="secundario"
                onClick={() => void mudar('recusada')}
                disabled={responder.isPending}
              >
                <X className="size-4" aria-hidden /> Recusada
              </Button>
            </>
          ) : (
            <Button
              variante="secundario"
              onClick={() => void mudar('enviada')}
              disabled={responder.isPending}
            >
              <RotateCcw className="size-4" aria-hidden /> Voltar para “aguardando resposta”
            </Button>
          )}
          <Link
            to={`/propostas/${p.id}/editar`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Pencil className="size-4" aria-hidden /> Editar
          </Link>
        </div>
      </header>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {situacao === 'expirada' && (
        <Aviso>
          A validade terminou em {formatarData(p.validade)} sem resposta. Se o cliente aceitar mesmo
          assim, marque como aprovada.
        </Aviso>
      )}
      {p.status === 'aprovada' && (
        <Aviso tipo="sucesso">
          Aprovada em {formatarData(p.data_resposta)}. Na Fase 4, daqui sairá o registro do serviço
          e, ao concluir, a conta a receber.
        </Aviso>
      )}
      {p.status === 'recusada' && (
        <Aviso tipo="erro">
          Recusada em {formatarData(p.data_resposta)}
          {p.motivo_recusa ? `: ${p.motivo_recusa}` : '.'}
        </Aviso>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold">Serviços</h2>
          <ul className="divide-y divide-borda">
            {p.itens.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className="font-semibold">{i.descricao}</p>
                  <p className="text-sm text-texto-suave">
                    {Number(i.quantidade).toLocaleString('pt-BR')} ×{' '}
                    {formatarReais(i.valor_unitario)}
                    {i.periodicidade_meses && ` · repetir a cada ${i.periodicidade_meses} meses`}
                  </p>
                </div>
                <strong>
                  {formatarReais(
                    Math.round(Number(i.quantidade) * Number(i.valor_unitario) * 100) / 100,
                  )}
                </strong>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-borda pt-3 text-right text-lg">
            Total: <strong>{formatarReais(p.valor_total)}</strong>
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Dados</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Dado rotulo="Vendedor" valor={p.vendedor?.nome} />
            <Dado rotulo="Enviada em" valor={formatarData(p.data_envio)} />
            <Dado rotulo="Válida até" valor={formatarData(p.validade) || '—'} />
            {p.endereco && (
              <Dado
                rotulo="Endereço"
                valor={[
                  p.endereco.apelido,
                  `${p.endereco.logradouro}, ${p.endereco.numero ?? 's/n'}`,
                  `${p.endereco.cidade}/${p.endereco.uf}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )}
            <Dado
              rotulo="Prazo de pagamento"
              valor={
                p.prazo_pagamento_dias != null
                  ? `${p.prazo_pagamento_dias} dias após o serviço`
                  : '—'
              }
            />
            {p.condicao_pagamento && <Dado rotulo="Condição" valor={p.condicao_pagamento} />}
            {p.observacoes && <Dado rotulo="Observações" valor={p.observacoes} />}
          </dl>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Arquivos da proposta</h2>
        <ListaArquivos
          clienteId={p.cliente_id!}
          propostaId={p.id!}
          categoria="proposta"
          textoVazio="Anexe aqui o PDF enviado ao cliente (e a versão assinada, se houver)."
        />
      </Card>
    </div>
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
