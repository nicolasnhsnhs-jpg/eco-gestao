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
  const vazioRef = useRef(true)
  const [erro, setErro] = useState<string | null>(null)

  // Ajusta a resolução do quadro à tela (senão o traço fica borrado no celular).
  // Refaz quando o quadro muda de tamanho (girar o celular, teclado fechando…),
  // só enquanto está em branco, para não apagar uma assinatura já feita.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ajustar = () => {
      if (!vazioRef.current && c.width > 0) return
      const escala = window.devicePixelRatio || 1
      const largura = Math.round(c.clientWidth * escala)
      const altura = Math.round(c.clientHeight * escala)
      if (largura === 0 || altura === 0 || (c.width === largura && c.height === altura)) return
      c.width = largura
      c.height = altura
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.scale(escala, escala)
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1f4d1a'
    }
    ajustar()
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(ajustar)
    observador.observe(c)
    return () => observador.disconnect()
  }, [])

  const marcarVazio = (v: boolean) => {
    vazioRef.current = v
    setVazio(v)
  }

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
    if (vazioRef.current) marcarVazio(false)
    setErro(null)
  }

  function limpar() {
    const c = canvas.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    marcarVazio(true)
    setErro(null)
  }

  function confirmar() {
    const c = canvas.current
    const falhou = () => {
      // Quadro sem imagem (o celular não gerou o desenho): limpa para assinar de novo.
      limpar()
      setErro('A assinatura não foi gravada. Assine de novo no quadro.')
    }
    if (!c || c.width === 0 || c.height === 0) return falhou()
    try {
      c.toBlob((imagem) => {
        if (imagem && imagem.size > 0) void aoConfirmar(imagem)
        else falhou()
      }, 'image/png')
    } catch {
      falhou()
    }
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
      {erro && (
        <p className="text-sm font-semibold text-perigo" role="alert">
          {erro}
        </p>
      )}
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
