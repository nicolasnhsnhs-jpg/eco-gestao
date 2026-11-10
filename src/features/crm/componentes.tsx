import { cn } from '@/lib/utils'

import type { Etiqueta } from './api'
import { CORES_ETIQUETA } from './cores'
import { iniciais } from './regras'

/** Círculo com as iniciais (a API da Meta não fornece a foto do cliente). */
export function Avatar({ nome, compacto }: { nome: string; compacto?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-lima-claro font-titulo font-bold text-verde-escuro',
        compacto ? 'size-10 text-sm' : 'size-12 text-sm',
      )}
    >
      {iniciais(nome)}
    </span>
  )
}

export function CorEtiqueta({
  etiqueta,
  pequena,
}: {
  etiqueta: Pick<Etiqueta, 'nome' | 'cor'>
  pequena?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold',
        pequena ? 'px-1.5 text-[11px] leading-4' : 'px-2.5 py-0.5 text-xs',
        CORES_ETIQUETA[etiqueta.cor] ?? CORES_ETIQUETA.cinza,
      )}
    >
      {etiqueta.nome}
    </span>
  )
}
