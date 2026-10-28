import type { ReactNode } from 'react'

type Props = {
  titulo: string
  descricao?: string
  /** Botões à direita do título (ex.: "Novo cliente"). */
  acoes?: ReactNode
}

export function PageHeader({ titulo, descricao, acoes }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        {descricao && <p className="mt-1 text-texto-suave">{descricao}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </header>
  )
}
