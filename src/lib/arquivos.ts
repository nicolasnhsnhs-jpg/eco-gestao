/**
 * Apoio para envio de arquivos: nomes seguros, tamanhos legíveis e
 * compressão de fotos tiradas no celular (para economizar o espaço gratuito).
 */

export const TAMANHO_MAXIMO = 20 * 1024 * 1024 // 20 MB (o mesmo limite do Storage)

/** Tipos aceitos pelo Storage (o banco recusa os outros). */
export const TIPOS_ACEITOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

/** Para o atributo accept do <input type="file">. */
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt'

/** "Proposta Nº 12 (final).PDF" → "proposta-n-12-final.pdf" */
export function nomeSeguro(nome: string): string {
  const ponto = nome.lastIndexOf('.')
  const base = ponto > 0 ? nome.slice(0, ponto) : nome
  const extensao =
    ponto > 0
      ? nome
          .slice(ponto + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : ''
  const limpo =
    base
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'arquivo'
  return extensao ? `${limpo}.${extensao}` : limpo
}

/** 1536000 → "1,5 MB" */
export function formatarTamanho(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

const LADO_MAXIMO = 1600

/**
 * Reduz fotos JPEG/PNG grandes (as do celular têm 3–8 MB) para no máximo 1600 px
 * no lado maior, em WebP com boa qualidade (~200–400 KB). Outros arquivos passam direto.
 */
export async function comprimirSeForFoto(arquivo: File): Promise<File> {
  if (!['image/jpeg', 'image/png'].includes(arquivo.type) || arquivo.size < 300 * 1024) {
    return arquivo
  }
  try {
    const imagem = await createImageBitmap(arquivo)
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(imagem.width * escala)
    canvas.height = Math.round(imagem.height * escala)
    canvas.getContext('2d')!.drawImage(imagem, 0, 0, canvas.width, canvas.height)
    imagem.close()

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.8))
    if (!blob || blob.size >= arquivo.size) return arquivo
    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], nome, { type: 'image/webp' })
  } catch {
    // Se o navegador não conseguir abrir a imagem, envia a original.
    return arquivo
  }
}
