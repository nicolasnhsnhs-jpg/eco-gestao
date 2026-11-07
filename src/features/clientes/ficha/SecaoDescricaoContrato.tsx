import { AlertTriangle, Clock, FileText, Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData } from '@/lib/datas'

import { useContratos } from '../../contratos/api'
import { quantidadeTexto, useDescricaoContrato } from '../descricaoContrato'
import { Secao } from './Secao'

type Props = { clienteId: string; podeEditar: boolean }

/**
 * O que o contrato assinado contempla: serviços do ano com quantidades,
 * vigência e a taxa fora do horário (a recepção consulta antes de agendar).
 * Aparece quando já existe descrição ou, para a gestão, quando há contrato ativo.
 */
export function SecaoDescricaoContrato({ clienteId, podeEditar }: Props) {
  const descricao = useDescricaoContrato(clienteId)
  const contratos = useContratos({ clienteId })
  const temContratoAtivo = !!contratos.data?.some((c) => c.status === 'ativo')
  const d = descricao.data

  if (descricao.isPending) return null
  if (!d && !(podeEditar && temContratoAtivo)) return null

  const linkEditar = `/clientes/${clienteId}/descricao-contrato`

  return (
    <Secao
      titulo="Descrição do contrato"
      acao={
        podeEditar && (
          <Link
            to={linkEditar}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            {d ? (
              <>
                <Pencil className="size-4" aria-hidden /> Editar
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden /> Descrever
              </>
            )}
          </Link>
        )
      }
    >
      {!d ? (
        <p className="text-sm text-texto-suave">
          Este cliente tem contrato ativo, mas ainda não tem a descrição do que o contrato
          contempla.
        </p>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <Cabecalho d={d} />

          {(d.horario_atendimento || d.taxa_fora_horario) && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-alerta" aria-hidden />
              <div className="flex flex-col gap-1">
                {d.horario_atendimento && (
                  <p>
                    <span className="font-semibold">Horário do contrato:</span>{' '}
                    {d.horario_atendimento}
                  </p>
                )}
                {d.taxa_fora_horario && (
                  <p>
                    <span className="font-semibold">Fora do horário:</span> {d.taxa_fora_horario}
                  </p>
                )}
              </div>
            </div>
          )}

          {d.itens.length > 0 && (
            <div>
              <h3 className="mb-2 font-bold">Serviços no ano</h3>
              <ul className="divide-y divide-borda rounded-xl border border-borda">
                {d.itens.map((item, i) => {
                  const qtd = quantidadeTexto(item)
                  return (
                    <li key={i} className="flex flex-col gap-1 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold">{item.servico}</span>
                        {item.frequencia && (
                          <Etiqueta cor="verde">
                            {item.frequencia}
                            {item.vezes_ano ? ` · ${item.vezes_ano}x/ano` : ''}
                          </Etiqueta>
                        )}
                      </div>
                      {(qtd || item.detalhe) && (
                        <p>
                          {qtd && <span className="font-semibold">{qtd}</span>}
                          {qtd && item.detalhe && ' · '}
                          {item.detalhe}
                        </p>
                      )}
                      {item.locais && <p className="text-texto-suave">Locais: {item.locais}</p>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <Texto titulo="Cobrados à parte (orçamento)" texto={d.servicos_extras} />
          <Texto titulo="Condições importantes" texto={d.condicoes} />

          {d.pendencias && (
            <div className="flex gap-3 rounded-xl bg-red-50 p-3 text-perigo">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="whitespace-pre-line">{d.pendencias}</p>
            </div>
          )}

          {(d.documentos.length > 0 || d.conferido_em) && (
            <div className="border-t border-borda pt-3 text-texto-suave">
              {d.documentos.length > 0 && (
                <div className="flex gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>Conforme: {d.documentos.join('; ')}</p>
                </div>
              )}
              {d.conferido_em && (
                <p className="mt-1">Conferido em {formatarData(d.conferido_em)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Secao>
  )
}

function Cabecalho({ d }: { d: NonNullable<ReturnType<typeof useDescricaoContrato>['data']> }) {
  const linhas: [string, string][] = []
  if (d.numero_contrato) linhas.push(['Contrato', d.numero_contrato])
  if (d.data_assinatura) linhas.push(['Assinado em', formatarData(d.data_assinatura)])
  if (d.vigencia_inicio || d.vigencia_fim) {
    const inicio = d.vigencia_inicio ? formatarData(d.vigencia_inicio) : '…'
    const fim = d.vigencia_fim ? formatarData(d.vigencia_fim) : 'indeterminado'
    linhas.push(['Vigência', `${inicio} a ${fim}`])
  }
  if (d.renovacao) linhas.push(['Renovação', d.renovacao])
  if (d.reajuste) linhas.push(['Reajuste', d.reajuste])
  if (!linhas.length) return null
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt className="text-texto-suave">{rotulo}</dt>
          <dd className="font-semibold">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function Texto({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <h3 className="mb-1 font-bold">{titulo}</h3>
      <p className="whitespace-pre-line">{texto}</p>
    </div>
  )
}
