import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Junta classes do Tailwind e resolve conflitos.
 * Ex.: cn('px-2', condicao && 'px-4') → 'px-4' quando a condição é verdadeira.
 */
export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes))
}
