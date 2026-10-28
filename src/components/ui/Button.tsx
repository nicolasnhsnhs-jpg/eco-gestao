import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-verde text-white hover:bg-verde-escuro',
  secundario: 'border border-borda bg-white text-verde-escuro hover:bg-lima-claro',
  fantasma: 'text-verde-escuro hover:bg-lima-claro',
  perigo: 'bg-perigo text-white hover:brightness-90',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }

export function Button({ variante = 'primario', className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        ESTILOS[variante],
        className,
      )}
      {...props}
    />
  )
}
