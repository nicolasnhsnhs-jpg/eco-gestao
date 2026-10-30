import { useEffect, useRef, useState } from 'react'

import { Button } from './Button'

type Props = {
  /** Recebe a assinatura como imagem PNG. */
  aoConfirmar: (imagem: Blob) => Promise<void> | void
  ocupado?: boolean
}

/**
 * Quadro para assinar com o dedo (ou caneta/mouse). Usa "pointer events", que
 * funcionam igual no celular e no computador.
 */
export function Assinatura({ aoConfirmar, ocupado }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const [vazio, setVazio] = useState(true)

  // Ajusta a resolução do quadro à tela (senão o traço fica borrado no celular).
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const escala = window.devicePixelRatio || 1
    c.width = c.clientWidth * escala
    c.height = c.clientHeight * escala
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(escala, escala)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f4d1a'
  }, [])

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    desenhando.current = true
    const { x, y } = ponto(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const { x, y } = ponto(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setVazio(false)
  }

  function limpar() {
    const c = canvas.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setVazio(true)
  }

  function confirmar() {
    canvas.current?.toBlob((imagem) => {
      if (imagem) void aoConfirmar(imagem)
    }, 'image/png')
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvas}
        aria-label="Quadro de assinatura"
        className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-verde bg-white"
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={() => (desenhando.current = false)}
        onPointerCancel={() => (desenhando.current = false)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variante="secundario" onClick={limpar} disabled={vazio || ocupado}>
          Limpar
        </Button>
        <Button type="button" onClick={confirmar} disabled={vazio || ocupado}>
          {ocupado ? 'Enviando…' : 'Confirmar assinatura'}
        </Button>
      </div>
    </div>
  )
}
