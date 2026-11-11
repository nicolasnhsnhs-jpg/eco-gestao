import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { horaCurta, usePropostasAgendadas, type PropostaAgendada } from './api'

const diaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })
const nomeDia = (iso: string) => diaDaSemana.format(new Date(`${iso}T00:00:00Z`))

/**
 * Propostas aprovadas com dia de execução marcado: o ADM escolhe o dia (ou a
 * semana) e vê o que precisa virar ordem de serviço.
 */
export function PropostasAgendadasPage() {
  const [parametros, setParametros] = useSearchParams()
  const hoje = hojeISO()
  const dia = parametros.get('dia') || hoje
  const semana = parametros.get('ver') === 'semana'
  const ate = semana ? somarDias(dia, 6) : dia
  const agendadas = usePropostasAgendadas(dia, ate)

  function mudar(novo: Record<string, string | null>) {
    const p = new URLSearchParams(parametros)
    for (const [k, v] of Object.entries(novo)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    setParametros(p, { replace: true })
  }
  const irPara = (d: string) => mudar({ dia: d === hoje ? null : d })

  const porDia = new Map<string, PropostaAgendada[]>()
  for (const p of agendadas.data ?? []) {
    const lista = porDia.get(p.execucao_data!) ?? []
    lista.push(p)
    porDia.set(p.execucao_data!, lista)
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Propostas agendadas</h1>
      <p className="mb-4 text-sm text-texto-suave">
        Aprovadas com dia de execução marcado pelo vendedor, para emitir as ordens de serviço.
      </p>

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <Button
          variante="secundario"
          aria-label={semana ? 'Semana anterior' : 'Dia anterior'}
          onClick={() => irPara(somarDias(dia, semana ? -7 : -1))}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <Input
          type="date"
          aria-label="Dia"
          className="w-auto flex-1 sm:flex-none"
          value={dia}
          onChange={(e) => e.target.value && irPara(e.target.value)}
        />
        <Button
          variante="secundario"
          aria-label={semana ? 'Próxima semana' : 'Próximo dia'}
          onClick={() => irPara(somarDias(dia, semana ? 7 : 1))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
        {dia !== hoje && (
          <Button variante="fantasma" onClick={() => irPara(hoje)}>
            Hoje
          </Button>
        )}
        <div className="ml-auto flex rounded-xl border border-borda p-1" role="group">
          {(
            [
              ['dia', 'Só o dia'],
              ['semana', '7 dias'],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={semana === (valor === 'semana')}
              onClick={() => mudar({ ver: valor === 'semana' ? 'semana' : null })}
              className={cn(
                'min-h-9 rounded-lg px-3 text-sm font-semibold',
                semana === (valor === 'semana')
                  ? 'bg-verde text-white'
                  : 'text-texto-suave hover:bg-lima-claro',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </Card>

      {agendadas.isError && <Aviso tipo="erro">{mensagemDeErro(agendadas.error)}</Aviso>}
      {agendadas.isPending && <Carregando />}
      {agendadas.isSuccess && porDia.size === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhuma proposta aprovada com execução{' '}
          {semana
            ? `entre ${formatarData(dia)} e ${formatarData(ate)}`
            : `em ${formatarData(dia)} (${nomeDia(dia)})`}
          .
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {[...porDia].map(([d, lista]) => (
          <section key={d}>
            <h2 className="mb-2 font-bold">
              {formatarData(d)} <span className="font-normal text-texto-suave">· {nomeDia(d)}</span>
              {d === hoje && <span className="ml-2 text-sm text-verde">hoje</span>}
              <span className="ml-2 text-sm font-normal text-texto-suave">
                {lista.length} proposta{lista.length > 1 ? 's' : ''}
              </span>
            </h2>
            <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
              {lista.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/propostas/${p.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-fundo-suave"
                  >
                    <span className="flex w-16 shrink-0 items-center gap-1 pt-0.5 font-bold text-verde-escuro">
                      <Clock className="size-4" aria-hidden />
                      {horaCurta(p.execucao_hora) || '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {p.cliente?.nome_fantasia || p.cliente?.nome}{' '}
                        <span className="font-normal text-texto-suave">· {p.numero}</span>
                      </p>
                      <p className="text-sm">{p.itens.map((i) => i.descricao).join(' · ')}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-sm text-texto-suave">
                        {p.endereco && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden />
                            {[p.endereco.apelido, `${p.endereco.cidade}/${p.endereco.uf}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {p.vendedor?.nome && <span>Vendedor: {p.vendedor.nome}</span>}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-texto-suave" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
