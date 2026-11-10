import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { hojeISO } from '@/lib/datas'

import { usePerfil } from '../auth/useAuth'
import { useAgenda, useAgendaTempoReal, useCadastroAgenda } from './api'
import { QuadroAgenda, QuadroAjustado } from './QuadroAgenda'

/*
 * Agenda na TV: tela cheia, relógio ao vivo e as mudanças chegando na hora.
 * Sem "?data=", mostra sempre o dia de hoje (vira o dia sozinha à meia-noite).
 */
export function AgendaTvPage() {
  const perfil = usePerfil()
  const [params] = useSearchParams()
  const fixa = params.get('data')
  const [hoje, setHoje] = useState(hojeISO)
  useEffect(() => {
    if (fixa) return
    const t = setInterval(() => setHoje(hojeISO()), 60_000)
    return () => clearInterval(t)
  }, [fixa])
  const data = fixa || hoje

  const agenda = useAgenda(data)
  const cadastro = useCadastroAgenda()
  useAgendaTempoReal(data, `${perfil.id}-tv`, `${perfil.nome} (TV)`)

  useEffect(() => {
    document.title = 'Agenda do dia'
  }, [])

  return (
    <div
      className="h-dvh w-screen cursor-none bg-[#0f2a0d]"
      onDoubleClick={() => void document.documentElement.requestFullscreen?.()}
      title="Dois cliques: tela cheia"
    >
      {agenda.data?.dia ? (
        <QuadroAjustado ajuste="tela">
          {(k) => (
            <QuadroAgenda
              dia={agenda.data.dia!}
              itens={agenda.data.itens}
              veiculos={cadastro.data?.veiculos ?? []}
              modo="tv"
              style={{ transform: `scale(${k})` }}
            />
          )}
        </QuadroAjustado>
      ) : (
        <div className="grid h-full place-items-center text-2xl font-bold text-lime-300">
          {agenda.isPending ? 'Carregando…' : 'A agenda de hoje ainda não foi começada'}
        </div>
      )}
    </div>
  )
}
