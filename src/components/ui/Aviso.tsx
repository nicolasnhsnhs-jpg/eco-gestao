import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Tipo = 'erro' | 'sucesso' | 'info'

const ESTILOS: Record<Tipo, string> = {
  erro: 'border-perigo/30 bg-red-50 text-perigo',
  sucesso: 'border-verde/30 bg-lima-claro text-verde-escuro',
  info: 'border-borda bg-fundo-suave text-texto',
}

const ICONES = { erro: CircleAlert, sucesso: CircleCheck, info: Info }

/**
 * Caixa de mensagem (erro ao salvar, confirmação, informação).
 *
 * O aviso de erro rola a tela até ele quando aparece ou muda de texto: quem tocou
 * em "Salvar" lá embaixo vê o que deu errado. Com `tentativa`, rola quando ela
 * muda (cada toque em "Concluir"), e não a cada mudança do texto: a lista do que
 * falta pode encolher enquanto a pessoa preenche sem puxar a tela de volta.
 */
export function Aviso({
  tipo = 'info',
  tentativa,
  children,
}: {
  tipo?: Tipo
  tentativa?: number
  children: ReactNode
}) {
  const Icone = ICONES[tipo]
  const caixa = useRef<HTMLDivElement>(null)
  const ultimo = useRef<{ texto: string; tentativa?: number } | null>(null)

  useEffect(() => {
    if (tipo !== 'erro' || !caixa.current) return
    const texto = caixa.current.textContent ?? ''
    const antes = ultimo.current
    ultimo.current = { texto, tentativa }
    const mudou =
      !antes || (tentativa === undefined ? antes.texto !== texto : antes.tentativa !== tentativa)
    if (!mudou) return
    caixa.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  })

  return (
    <div
      ref={caixa}
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={cn('flex scroll-mt-20 gap-2 rounded-xl border px-4 py-3 text-sm', ESTILOS[tipo])}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
