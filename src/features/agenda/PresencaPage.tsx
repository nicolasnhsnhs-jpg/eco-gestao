import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO, mesDe, somarMeses } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useCadastroAgenda, useDiasDoMes } from './api'
import { AUSENCIAS, NOME_AUSENCIA, presencaDoMes } from './regras'

/*
 * Presença do mês: quantos dias cada técnico esteve na escala, faltou ou folgou
 * (folga comum, folga porque trabalhará domingo ou descontada das horas em haver),
 * pelas agendas do dia. O mês atual vai se atualizando conforme a agenda muda.
 */

const NOME_MES = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** O que aparece em "ver dias": cada falta e folga e os dias sem registro. */
const TIPOS_DE_DIA = [...AUSENCIAS, 'sem_registro'] as const

function nomeDoMes(mes: string): string {
  const t = NOME_MES.format(new Date(`${mes}-01T12:00:00Z`))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** "2026-11-03" → "03/11 (ter)" */
function diaCurto(iso: string): string {
  const semana = new Date(`${iso}T12:00:00Z`)
    .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '')
  return `${formatarData(iso).slice(0, 5)} (${semana})`
}

export function PresencaPage() {
  const atual = mesDe(hojeISO())
  const [mes, setMes] = useState(atual)
  const dias = useDiasDoMes(mes)
  const cadastro = useCadastroAgenda()
  const [aberto, setAberto] = useState<number | null>(null)

  const linhas = dias.data && cadastro.data ? presencaDoMes(dias.data, cadastro.data.tecnicos) : []
  const totalDias = dias.data?.length ?? 0
  const soma = (k: 'presencas' | 'faltas' | 'folgasSimples' | 'folgas' | 'folgasHoras') =>
    linhas.reduce((t, l) => t + l[k], 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Presença da equipe</h1>
          <p className="text-sm text-texto-suave">
            Presença, falta e folga de cada técnico, contadas pelas agendas do dia.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            aria-label="Mês"
            value={mes}
            max={atual}
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className="min-h-10 w-auto"
          />
          <Button
            variante="fantasma"
            className="min-h-10"
            onClick={() => setMes(mesDe(somarMeses(`${atual}-01`, -1)))}
          >
            Mês passado
          </Button>
          {mes !== atual && (
            <Button variante="fantasma" className="min-h-10" onClick={() => setMes(atual)}>
              Este mês
            </Button>
          )}
        </div>
      </div>

      {(dias.isPending || cadastro.isPending) && <Carregando />}
      {(dias.isError || cadastro.isError) && (
        <Aviso tipo="erro">{mensagemDeErro(dias.error ?? cadastro.error)}</Aviso>
      )}

      {dias.data && cadastro.data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Resumo rotulo="Dias com agenda" valor={totalDias} />
            <Resumo rotulo="Presenças" valor={soma('presencas')} cor="verde" />
            <Resumo rotulo="Faltas" valor={soma('faltas')} cor="vermelho" />
            <Resumo rotulo="Folgas" valor={soma('folgasSimples')} />
            <Resumo rotulo="Folgas · trabalhará domingo" valor={soma('folgas')} />
            <Resumo rotulo="Folgas · horas em haver" valor={soma('folgasHoras')} />
          </div>

          <Lembretes dias={dias.data} />

          <Card className="overflow-x-auto p-0">
            <div className="flex items-center justify-between border-b border-borda px-4 py-3">
              <h2 className="font-bold">{nomeDoMes(mes)}</h2>
              {mes === atual && (
                <span className="text-xs text-texto-suave">Atualiza sozinho durante o mês</span>
              )}
            </div>
            {totalDias === 0 ? (
              <p className="p-4 text-sm text-texto-suave">Nenhuma agenda do dia neste mês.</p>
            ) : (
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-texto-suave uppercase">
                    <th className="px-4 py-2">Técnico</th>
                    <th className="px-2 py-2 text-center">Presenças</th>
                    <th className="px-2 py-2 text-center">Faltas</th>
                    <th className="px-2 py-2 text-center" title="Folga comum (ex.: domingo)">
                      Folgas
                    </th>
                    <th
                      className="px-2 py-2 text-center"
                      title="Folga porque trabalhará no domingo"
                    >
                      Folgas · trab. domingo
                    </th>
                    <th
                      className="px-2 py-2 text-center"
                      title="Folga descontada das horas em haver"
                    >
                      Folgas · horas em haver
                    </th>
                    <th
                      className="px-2 py-2 text-center"
                      title="Dias com agenda em que o técnico não estava em nenhuma escala, nem na falta ou na folga"
                    >
                      Sem registro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const temDias = TIPOS_DE_DIA.some((t) => l.dias[t].length > 0)
                    const mostrar = aberto === l.numero
                    return (
                      <tr key={l.numero} className="border-t border-borda align-top">
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            disabled={!temDias}
                            onClick={() => setAberto(mostrar ? null : l.numero)}
                            className="text-left disabled:cursor-default"
                            title={
                              temDias ? 'Ver os dias de falta, folga e sem registro' : undefined
                            }
                          >
                            <strong>{String(l.numero).padStart(2, '0')}</strong>{' '}
                            {l.nome || <span className="text-texto-suave">sem cadastro</span>}
                            {temDias && (
                              <span className="ml-1 text-xs text-verde-escuro underline">
                                {mostrar ? 'esconder dias' : 'ver dias'}
                              </span>
                            )}
                          </button>
                          {mostrar && (
                            <div className="mt-1 flex flex-col gap-0.5 text-xs">
                              {TIPOS_DE_DIA.filter((t) => l.dias[t].length > 0).map((t) => (
                                <span
                                  key={t}
                                  className={t === 'falta' ? 'text-perigo' : 'text-texto-suave'}
                                >
                                  {t === 'sem_registro' ? 'Sem registro' : NOME_AUSENCIA[t]}:{' '}
                                  {l.dias[t].map(diaCurto).join(', ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <Numero valor={l.presencas} cor="verde" />
                        <Numero valor={l.faltas} cor="vermelho" />
                        <Numero valor={l.folgasSimples} />
                        <Numero valor={l.folgas} />
                        <Numero valor={l.folgasHoras} />
                        <Numero valor={l.semRegistro} apagado />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

/** As anotações da escala do mês (ex.: quem saiu mais cedo e fica com horas em haver). */
function Lembretes({ dias }: { dias: readonly { data: string; nota_escala: string }[] }) {
  const comNota = dias.filter((d) => d.nota_escala.trim())
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-bold">Lembretes da escala</h2>
      {comNota.length === 0 ? (
        <p className="text-sm text-texto-suave">
          Nenhum lembrete neste mês. Eles são escritos na Agenda do dia, em "Anotação da escala".
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda">
          {comNota.map((d) => (
            <li key={d.data} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
              <Link
                to={`/servicos/dia?data=${d.data}`}
                className="shrink-0 text-sm font-bold text-verde-escuro underline sm:w-28"
                title="Abrir a agenda deste dia"
              >
                {diaCurto(d.data)}
              </Link>
              <span className="text-sm whitespace-pre-line">{d.nota_escala.trim()}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Resumo({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string
  valor: number
  cor?: 'verde' | 'vermelho'
}) {
  return (
    <Card className="flex flex-col gap-0.5 p-3">
      <span className="text-xs font-semibold text-texto-suave">{rotulo}</span>
      <span
        className={cn(
          'text-2xl font-bold',
          cor === 'verde' && 'text-verde-escuro',
          cor === 'vermelho' && 'text-perigo',
        )}
      >
        {valor}
      </span>
    </Card>
  )
}

function Numero({
  valor,
  cor,
  apagado,
}: {
  valor: number
  cor?: 'verde' | 'vermelho'
  apagado?: boolean
}) {
  return (
    <td
      className={cn(
        'px-2 py-2 text-center text-base font-bold tabular-nums',
        valor === 0 && 'font-normal text-texto-suave',
        valor > 0 && cor === 'verde' && 'text-verde-escuro',
        valor > 0 && cor === 'vermelho' && 'text-perigo',
        apagado && 'font-normal text-texto-suave',
      )}
    >
      {valor}
    </td>
  )
}
