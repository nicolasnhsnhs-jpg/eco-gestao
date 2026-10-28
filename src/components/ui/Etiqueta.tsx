import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Cor = 'verde' | 'cinza' | 'alerta' | 'perigo'

const CORES: Record<Cor, string> = {
  verde: 'bg-lima-claro text-verde-escuro',
  cinza: 'bg-fundo-suave text-texto-suave border border-borda',
  alerta: 'bg-amber-50 text-alerta',
  perigo: 'bg-red-50 text-perigo',
}

/** Pequena etiqueta de status (ex.: "PJ", "Inativo"). */
export function Etiqueta({ cor = 'cinza', children }: { cor?: Cor; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        CORES[cor],
      )}
    >
      {children}
    </span>
  )
}
