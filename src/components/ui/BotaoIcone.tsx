import type { ReactNode } from 'react'

type Props = {
  /** Texto lido por leitores de tela e mostrado ao passar o mouse. */
  rotulo: string
  onClick: () => void
  children: ReactNode
}

/** Botão pequeno só com ícone (editar, remover…). */
export function BotaoIcone({ rotulo, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className="grid size-9 place-items-center rounded-lg text-texto-suave hover:bg-lima-claro hover:text-verde-escuro"
    >
      {children}
    </button>
  )
}
