import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

const ESTILO_CAMPO =
  'w-full min-h-11 rounded-xl border border-borda bg-white px-3 text-base text-texto placeholder:text-texto-suave/60 focus:border-verde focus:outline-none focus:ring-2 focus:ring-lima/50 disabled:bg-fundo-suave aria-invalid:border-perigo'

type CampoProps = {
  rotulo: string
  /** Mensagem de erro de validação. */
  erro?: string
  dica?: ReactNode
  obrigatorio?: boolean
  className?: string
  children: ReactNode
  htmlFor?: string
}

/** Rótulo + campo + mensagem de erro, sempre no mesmo formato. */
export function Campo({
  rotulo,
  erro,
  dica,
  obrigatorio,
  className,
  children,
  htmlFor,
}: CampoProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-texto">
        {rotulo}
        {obrigatorio && <span className="text-perigo"> *</span>}
      </label>
      {children}
      {erro ? (
        <p className="text-sm text-perigo" role="alert">
          {erro}
        </p>
      ) : (
        dica && <p className="text-sm text-texto-suave">{dica}</p>
      )}
    </div>
  )
}

// No React 19 o "ref" chega como uma propriedade comum, então os campos
// funcionam direto com o register() do React Hook Form.

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(ESTILO_CAMPO, className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(ESTILO_CAMPO, 'pr-8', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(ESTILO_CAMPO, 'min-h-24 py-2', className)} {...props} />
}
