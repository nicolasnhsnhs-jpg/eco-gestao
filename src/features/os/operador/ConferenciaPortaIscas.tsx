import { CheckCircle2, ChevronDown, ChevronUp, ListChecks } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

import type { PontoOs } from '../pragasApi'
import { situacaoPadrao } from '../tipos/pragas'

/*
 * Lista de conferência dos porta-iscas: o técnico abre, vê todos por setor, com
 * a situação anotada, e dá um visto em cada um que já olhou, para não esquecer
 * nenhum. Os vistos são só um apoio: ficam no celular (sem internet também) e
 * não vão para o sistema.
 */

const chave = (osId: string) => `eco-os-conferidos-${osId}`

function lerConferidos(osId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chave(osId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function gravarConferidos(osId: string, ids: Set<string>) {
  try {
    localStorage.setItem(chave(osId), JSON.stringify([...ids]))
  } catch {
    // Sem espaço ou navegação privada: o visto vale só enquanto a tela está aberta.
  }
}

/** Setores na ordem dos números (o primeiro porta-isca de cada setor manda). */
function agruparPorSetor(pontos: PontoOs[]) {
  const grupos = new Map<string, PontoOs[]>()
  for (const p of [...pontos].sort((a, b) => a.numero - b.numero)) {
    grupos.set(p.area, [...(grupos.get(p.area) ?? []), p])
  }
  return [...grupos]
}

export function ConferenciaPortaIscas({
  osId,
  pontos,
  aberta,
}: {
  osId: string
  pontos: PontoOs[]
  aberta: boolean
}) {
  const [visivel, setVisivel] = useState(false)
  const [conferidos, setConferidos] = useState(() => lerConferidos(osId))
  const total = pontos.length
  const feitos = pontos.filter((p) => conferidos.has(p.id)).length
  const tudo = feitos === total && total > 0

  function marcar(ids: string[], valor: boolean) {
    if (!aberta) return
    const novo = new Set(conferidos)
    for (const id of ids) {
      if (valor) novo.add(id)
      else novo.delete(id)
    }
    setConferidos(novo)
    gravarConferidos(osId, novo)
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-3">
      <Button
        type="button"
        variante="secundario"
        aria-expanded={visivel}
        onClick={() => setVisivel((v) => !v)}
      >
        <ListChecks className="size-5" aria-hidden />
        {visivel ? 'Esconder a lista' : 'Ver a lista de porta-iscas'}
        {visivel ? (
          <ChevronUp className="size-5" aria-hidden />
        ) : (
          <ChevronDown className="size-5" aria-hidden />
        )}
      </Button>
      <p className={cn('text-sm', tudo ? 'font-semibold text-verde' : 'text-texto-suave')}>
        {tudo && <CheckCircle2 className="mr-1 inline size-4" aria-hidden />}
        Conferidos: <strong>{feitos}</strong> de <strong>{total}</strong>
        {!tudo && total - feitos > 0 && ` · faltam ${total - feitos}`}
      </p>

      {visivel && (
        <div className="flex flex-col gap-3">
          {agruparPorSetor(pontos).map(([setor, lista]) => {
            const doSetor = lista.filter((p) => conferidos.has(p.id)).length
            const setorFeito = doSetor === lista.length
            return (
              <section key={setor} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 border-b border-borda pb-1">
                  <h4 className={cn('font-semibold', setorFeito && 'text-verde')}>
                    {setorFeito && <CheckCircle2 className="mr-1 inline size-4" aria-hidden />}
                    {setor}{' '}
                    <span className="text-sm font-normal text-texto-suave">
                      ({doSetor}/{lista.length})
                    </span>
                  </h4>
                  {aberta && (
                    <button
                      type="button"
                      className="min-h-11 px-2 text-sm font-semibold text-verde underline"
                      onClick={() =>
                        marcar(
                          lista.map((p) => p.id),
                          !setorFeito,
                        )
                      }
                    >
                      {setorFeito ? 'Desmarcar' : 'Marcar o setor'}
                    </button>
                  )}
                </div>
                <ul className="flex flex-col">
                  {lista.map((p) => {
                    const feito = conferidos.has(p.id)
                    const excecao = p.situacao && p.situacao !== situacaoPadrao(p.tipo_isca)
                    return (
                      <li key={p.id}>
                        <label className="flex min-h-11 items-center gap-3">
                          <input
                            type="checkbox"
                            className="size-5 accent-verde"
                            disabled={!aberta}
                            checked={feito}
                            onChange={(e) => marcar([p.id], e.target.checked)}
                          />
                          <span
                            className={cn('w-10 font-bold tabular-nums', feito && 'text-verde')}
                          >
                            {String(p.numero).padStart(2, '0')}
                          </span>
                          <span className="flex-1 text-sm text-texto-suave">
                            {p.forma_iscagem} · {p.tipo_isca}
                          </span>
                          <span
                            className={cn(
                              'grid min-w-11 place-items-center rounded-lg px-2 py-0.5 text-sm font-bold',
                              excecao ? 'bg-verde text-white' : 'bg-fundo-suave text-texto-suave',
                            )}
                          >
                            {p.situacao ?? '—'}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
