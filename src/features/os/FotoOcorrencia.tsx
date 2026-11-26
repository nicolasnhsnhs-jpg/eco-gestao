import { useQuery } from '@tanstack/react-query'
import { ImageOff } from 'lucide-react'

import { comprimirSeForFoto, nomeSeguro, TAMANHO_MAXIMO } from '@/lib/arquivos'
import { supabase } from '@/lib/supabase'

/*
 * Foto que o escritório anexa à ocorrência (migration 20270204120000_ocorrencia_foto.sql).
 * Fica no Storage em clientes/<cliente>/ocorrencias/…; o técnico vê na OS do celular.
 */

/** Envia a foto da ocorrência e devolve o caminho no Storage (vai junto ao salvar). */
export async function enviarFotoOcorrencia(clienteId: string, original: File): Promise<string> {
  if (!original.type.startsWith('image/')) throw new Error('Escolha uma foto.')
  const arquivo = await comprimirSeForFoto(original)
  if (arquivo.size > TAMANHO_MAXIMO) throw new Error(`“${original.name}” passa de 20 MB.`)
  const caminho = `clientes/${clienteId}/ocorrencias/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`
  const { error } = await supabase.storage
    .from('arquivos')
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined })
  if (error) {
    throw new Error(
      /mime|type/i.test(error.message)
        ? 'Tipo de foto não aceito. Use JPG, PNG ou WebP.'
        : error.message,
    )
  }
  return caminho
}

function useLinkFoto(caminho: string) {
  return useQuery({
    queryKey: ['arquivos', 'foto-ocorrencia', caminho],
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('arquivos').createSignedUrl(caminho, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

/** Miniatura da foto; tocar abre a foto inteira numa aba nova. */
export function FotoOcorrencia({ caminho, className }: { caminho: string; className?: string }) {
  const link = useLinkFoto(caminho)
  if (link.isPending) {
    return <div className={`size-28 animate-pulse rounded-xl bg-black/10 ${className ?? ''}`} />
  }
  if (!link.data) {
    return (
      <p className={`flex items-center gap-2 text-sm text-texto-suave ${className ?? ''}`}>
        <ImageOff className="size-4" aria-hidden /> Foto da ocorrência (abre com internet)
      </p>
    )
  }
  return (
    <a
      href={link.data}
      target="_blank"
      rel="noreferrer"
      className={`block self-start ${className ?? ''}`}
      title="Abrir a foto"
    >
      <img
        src={link.data}
        alt="Foto da ocorrência"
        className="max-h-56 max-w-full rounded-xl border border-borda object-contain"
      />
    </a>
  )
}
