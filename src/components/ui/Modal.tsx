import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  children: ReactNode
}

/**
 * Janela por cima da página. Usa o elemento <dialog> do próprio navegador,
 * que já cuida do foco, da tecla Esc e da acessibilidade.
 * No celular ela ocupa a parte de baixo da tela; no computador, fica centralizada.
 */
export function Modal({ aberto, aoFechar, titulo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberto && !dialogo.open) {
      dialogo.showModal()
      // O navegador põe o foco no primeiro botão (o "fechar"). Para quem vai digitar, é melhor
      // começar no campo marcado com data-autofocus ou, sem ele, no primeiro campo do formulário.
      const campo =
        dialogo.querySelector<HTMLElement>('[data-autofocus]') ??
        dialogo.querySelector<HTMLElement>('input:not([type=hidden]):not([type=radio]), textarea')
      campo?.focus()
    }
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => e.target === ref.current && aoFechar()}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 shadow-xl backdrop:bg-verde-noite/40 sm:m-auto sm:max-w-lg sm:rounded-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-borda bg-white px-5 py-3">
        <h2 className="text-lg font-bold">{titulo}</h2>
        <button
          type="button"
          onClick={aoFechar}
          className="grid size-10 place-items-center rounded-xl text-verde-escuro hover:bg-lima-claro"
          aria-label="Fechar"
        >
          <X aria-hidden />
        </button>
      </div>
      {aberto && <div className="p-5">{children}</div>}
    </dialog>
  )
}
