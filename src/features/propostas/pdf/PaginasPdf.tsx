import { useEffect, useRef, useState } from 'react'

import { mensagemDeErro } from '@/lib/erros'

/**
 * Desenha as páginas do PDF como imagens (pdf.js). O celular não mostra PDF
 * dentro de um iframe — o Chrome do Android deixa em branco —, então a prévia
 * não pode depender do leitor de PDF do navegador.
 */

type PdfJs = typeof import('pdfjs-dist')
let pdfjs: Promise<PdfJs> | null = null

function carregarPdfJs() {
  pdfjs ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return pdfjs
}

export function PaginasPdf({ blob }: { blob: Blob }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  // Redesenha quando a largura muda (girar o celular, abrir/fechar a prévia).
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width)
      setLargura((antiga) => (Math.abs(antiga - w) > 8 ? w : antiga))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const el = caixa.current
    if (!el || largura <= 0) return
    let cancelado = false
    let doc: { destroy: () => Promise<void> } | null = null

    void (async () => {
      try {
        const lib = await carregarPdfJs()
        const dados = new Uint8Array(await blob.arrayBuffer())
        const pdf = await lib.getDocument({ data: dados, isEvalSupported: false }).promise
        doc = pdf
        const escalaTela = Math.min(window.devicePixelRatio || 1, 2)
        const novas: HTMLCanvasElement[] = []
        for (let n = 1; n <= pdf.numPages; n++) {
          const pagina = await pdf.getPage(n)
          if (cancelado) return
          const base = pagina.getViewport({ scale: 1 })
          const vp = pagina.getViewport({ scale: (largura / base.width) * escalaTela })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(vp.width)
          canvas.height = Math.floor(vp.height)
          canvas.className = 'block w-full h-auto bg-white shadow-sm'
          canvas.setAttribute('aria-label', `Página ${n} de ${pdf.numPages}`)
          await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
          if (cancelado) return
          novas.push(canvas)
        }
        // Só troca quando todas as páginas ficaram prontas, para não piscar.
        el.replaceChildren(...novas)
        setErro(null)
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e))
      }
    })()

    return () => {
      cancelado = true
      void doc?.destroy()
    }
  }, [blob, largura])

  return (
    <>
      {erro && <p className="p-4 text-sm text-red-700">Não deu para desenhar a prévia: {erro}</p>}
      <div ref={caixa} className="flex flex-col gap-3" />
    </>
  )
}
