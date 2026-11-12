import { toBlob } from 'html-to-image'

import { supabase } from '@/lib/supabase'
import { UNIDADE } from '@/lib/unidade'

import { ALTURA_QUADRO, LARGURA_QUADRO } from './QuadroAgenda'
import { nomeDaImagem } from './regras'

/**
 * Tira a "foto" do quadro (PNG, 1920 de largura). Normalmente 1080 de altura; em
 * dia com tanto serviço que não cabe, a imagem cresce para baixo e mostra tudo.
 */
export async function gerarImagem(no: HTMLElement): Promise<Blob> {
  await document.fonts.ready
  const blob = await toBlob(no, {
    width: LARGURA_QUADRO,
    height: Math.max(ALTURA_QUADRO, Math.ceil(no.scrollHeight)),
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

/**
 * Guarda uma cópia da imagem no Google Drive: ADM / AGENDA / ano / mês / dd-mm-aaaa.png.
 * Gerar de novo no mesmo dia troca a cópia. Falhar aqui não atrapalha quem gerou.
 */
export function copiarAgendaNoDrive(blob: Blob, data: string) {
  if (!UNIDADE.drive) return
  void (async () => {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let texto = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
      texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    await supabase.functions.invoke('drive', {
      body: { acao: 'agenda', data, imagem: btoa(texto) },
    })
  })().catch(() => {})
}
