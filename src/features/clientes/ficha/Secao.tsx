import type { ReactNode } from 'react'

import { Card } from '@/components/ui/Card'

type Props = {
  titulo: string
  /** Botão no canto (ex.: "Adicionar"). */
  acao?: ReactNode
  children: ReactNode
  className?: string
}

/** Um bloco da ficha do cliente. */
export function Secao({ titulo, acao, children, className }: Props) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </Card>
  )
}

/** Mensagem curta para quando a seção ainda não tem nada. */
export function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-texto-suave">{children}</p>
}
