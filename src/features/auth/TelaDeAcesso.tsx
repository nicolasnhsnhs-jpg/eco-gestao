import type { ReactNode } from 'react'

import { Card } from '@/components/ui/Card'

/** Moldura das telas sem login (entrar, esqueci a senha, definir senha). */
export function TelaDeAcesso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-fundo-suave px-4 py-10">
      <img src="/logo.webp" alt="Eco Ambiental" className="mb-2 h-16 w-auto" />
      <p className="mb-6 font-titulo text-sm font-bold tracking-wide text-verde-escuro uppercase">
        Sistema de gestão
      </p>
      <Card className="w-full max-w-sm">
        <h1 className="mb-5 text-xl font-bold">{titulo}</h1>
        {children}
      </Card>
    </div>
  )
}
