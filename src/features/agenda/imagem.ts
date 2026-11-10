import { toBlob } from 'html-to-image'

import { ALTURA_QUADRO, LARGURA_QUADRO } from './QuadroAgenda'
import { nomeDaImagem } from './regras'

/** Tira a "foto" do quadro (1920x1080, PNG). */
export async function gerarImagem(no: HTMLElement): Promise<Blob> {
  await document.fonts.ready
  const blob = await toBlob(no, {
    width: LARGURA_QUADRO,
    height: ALTURA_QUADRO,
    pixelRatio: 1,
    cacheBust: true,
    style: { transform: 'none', position: 'static', left: '0', top: '0' },
  })
  if (!blob) throw new Error('Não deu para gerar a imagem da agenda.')
  return blob
}

/**
 * No celular abre o compartilhar (dá para mandar direto no grupo do WhatsApp);
 * no computador baixa o arquivo.
 */
export async function compartilharOuBaixar(
  blob: Blob,
  data: string,
): Promise<'compartilhou' | 'baixou'> {
  const arquivo = new File([blob], nomeDaImagem(data), { type: 'image/png' })
  const toque = window.matchMedia('(pointer: coarse)').matches
  if (toque && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Agenda do dia' })
      return 'compartilhou'
    } catch (e) {
      // Cancelou o compartilhar: não é erro.
      if (e instanceof DOMException && e.name === 'AbortError') return 'compartilhou'
    }
  }
  baixar(blob, data)
  return 'baixou'
}

export function baixar(blob: Blob, data: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeDaImagem(data)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Copia a imagem para colar no WhatsApp Web (Ctrl+V). */
export async function copiarImagem(blob: Blob): Promise<boolean> {
  if (!('ClipboardItem' in window) || !navigator.clipboard?.write) return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
