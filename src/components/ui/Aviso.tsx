import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Tipo = 'erro' | 'sucesso' | 'info'

const ESTILOS: Record<Tipo, string> = {
  erro: 'border-perigo/30 bg-red-50 text-perigo',
  sucesso: 'border-verde/30 bg-lima-claro text-verde-escuro',
  info: 'border-borda bg-fundo-suave text-texto',
}

const ICONES = { erro: CircleAlert, sucesso: CircleCheck, info: Info }

/** Caixa de mensagem (erro ao salvar, confirmação, informação). */
export function Aviso({ tipo = 'info', children }: { tipo?: Tipo; children: ReactNode }) {
  const Icone = ICONES[tipo]
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={cn('flex gap-2 rounded-xl border px-4 py-3 text-sm', ESTILOS[tipo])}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
