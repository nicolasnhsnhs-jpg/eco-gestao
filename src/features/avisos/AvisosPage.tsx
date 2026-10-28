import { AlertTriangle, BellOff, CalendarClock, Check, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarDataHora } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useAvisos, useGerarAvisosAoAbrir, useMarcarAviso } from './api'

const URGENTES = new Set(['cobranca_atrasada', 'pagamento_atrasado'])

/** Central de avisos: cobranças atrasadas, recebimentos do dia e, depois, serviços vencendo. */
export function AvisosPage() {
  useGerarAvisosAoAbrir()
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false)
  const avisos = useAvisos(mostrarResolvidos)
  const marcar = useMarcarAviso()

  const naoLidos = (avisos.data ?? []).filter((a) => !a.lido_em && !a.resolvido_em)

  return (
    <>
      <PageHeader
        titulo="Avisos"
        descricao="Os avisos de cobrança se resolvem sozinhos quando o pagamento é confirmado."
        acoes={
          naoLidos.length > 0 && (
            <Button
              variante="secundario"
              onClick={() => marcar.mutate({ ids: naoLidos.map((a) => a.id), campo: 'lido_em' })}
            >
              <CheckCheck className="size-4" aria-hidden /> Marcar todos como lidos
            </Button>
          )
        }
      />

      <label className="mb-4 flex items-center gap-2 text-sm text-texto-suave">
        <input
          type="checkbox"
          className="size-4 accent-verde"
          checked={mostrarResolvidos}
          onChange={(e) => setMostrarResolvidos(e.target.checked)}
        />
        Mostrar também os resolvidos
      </label>

      {avisos.isError && <Aviso tipo="erro">{mensagemDeErro(avisos.error)}</Aviso>}
      {avisos.isPending && <Carregando />}

      {avisos.data?.length === 0 && (
        <Card className="flex flex-col items-center gap-2 py-12 text-center text-texto-suave">
          <BellOff className="size-10" aria-hidden />
          Nenhum aviso pendente. Tudo em dia!
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {avisos.data?.map((a) => {
          const urgente = URGENTES.has(a.tipo)
          const Icone = urgente ? AlertTriangle : CalendarClock
          const resolvido = !!a.resolvido_em
          return (
            <li
              key={a.id}
              className={cn(
                'flex gap-3 rounded-2xl border bg-white p-4',
                urgente && !resolvido ? 'border-perigo/30' : 'border-borda',
                resolvido && 'opacity-60',
              )}
            >
              <Icone
                className={cn('mt-0.5 size-5 shrink-0', urgente ? 'text-perigo' : 'text-verde')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className={cn('font-semibold', !a.lido_em && !resolvido && 'text-verde-escuro')}>
                  {!a.lido_em && !resolvido && (
                    <span className="mr-2 inline-block size-2 rounded-full bg-lima align-middle" />
                  )}
                  {a.titulo}
                </p>
                {a.mensagem && <p className="text-sm">{a.mensagem}</p>}
                <p className="mt-1 text-xs text-texto-suave">
                  {formatarDataHora(a.criado_em)}
                  {resolvido && ` · resolvido em ${formatarDataHora(a.resolvido_em)}`}
                </p>
                {a.link && !resolvido && (
                  <Link
                    to={a.link}
                    onClick={() => !a.lido_em && marcar.mutate({ ids: [a.id], campo: 'lido_em' })}
                    className="mt-2 inline-block text-sm font-semibold text-verde underline"
                  >
                    Abrir
                  </Link>
                )}
              </div>
              {!resolvido && (
                <Button
                  variante="fantasma"
                  className="shrink-0 self-start px-3 text-sm"
                  onClick={() => marcar.mutate({ ids: [a.id], campo: 'resolvido_em' })}
                  title="Marcar como resolvido"
                >
                  <Check className="size-4" aria-hidden /> Resolvido
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
