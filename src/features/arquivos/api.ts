import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { comprimirSeForFoto, nomeSeguro, TAMANHO_MAXIMO } from '@/lib/arquivos'
import type { Database, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Arquivo = Tables<'arquivos'>
export type CategoriaArquivo = Database['public']['Enums']['categoria_arquivo']

const BUCKET = 'arquivos'

export type Vinculo = {
  clienteId: string
  /** Arquivos de uma proposta. Sem ele, só os documentos gerais do cliente. */
  propostaId?: string
}

export function useArquivos({ clienteId, propostaId }: Vinculo) {
  return useQuery({
    queryKey: ['arquivos', clienteId, propostaId ?? 'gerais'],
    queryFn: async () => {
      let consulta = supabase
        .from('arquivos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('criado_em', { ascending: false })
      consulta = propostaId
        ? consulta.eq('proposta_id', propostaId)
        : consulta.is('proposta_id', null).is('lancamento_id', null)
      const { data, error } = await consulta
      if (error) throw error
      return data
    },
  })
}

/**
 * Envia arquivos: primeiro o arquivo vai para o Storage, depois o registro vai
 * para a tabela. Se o registro falhar, o arquivo enviado é apagado (nada fica "solto").
 */
export function useEnviarArquivos({ clienteId, propostaId }: Vinculo) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      arquivos,
      categoria,
    }: {
      arquivos: File[]
      categoria: CategoriaArquivo
    }) => {
      for (const original of arquivos) {
        const arquivo = await comprimirSeForFoto(original)
        if (arquivo.size > TAMANHO_MAXIMO) {
          throw new Error(`“${original.name}” passa de 20 MB.`)
        }
        const id = crypto.randomUUID()
        const caminho = `clientes/${clienteId}/${id}-${nomeSeguro(arquivo.name)}`

        const envio = await supabase.storage
          .from(BUCKET)
          .upload(caminho, arquivo, { contentType: arquivo.type || undefined })
        if (envio.error) {
          throw new Error(
            /mime|type/i.test(envio.error.message)
              ? `“${original.name}”: tipo de arquivo não aceito. Use PDF, foto, Word ou Excel.`
              : envio.error.message,
          )
        }

        const { error } = await supabase.from('arquivos').insert({
          id,
          caminho_storage: caminho,
          nome_original: original.name,
          tipo_mime: arquivo.type || null,
          tamanho_bytes: arquivo.size,
          categoria,
          cliente_id: clienteId,
          proposta_id: propostaId ?? null,
        })
        if (error) {
          await supabase.storage.from(BUCKET).remove([caminho])
          throw error
        }
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['arquivos', clienteId] }),
  })
}

export function useRemoverArquivo(clienteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (arquivo: Arquivo) => {
      const { error } = await supabase.from('arquivos').delete().eq('id', arquivo.id)
      if (error) throw error
      // O registro já saiu; se o Storage falhar, sobra só um arquivo órfão (sem acesso pela tela).
      await supabase.storage.from(BUCKET).remove([arquivo.caminho_storage])
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['arquivos', clienteId] }),
  })
}

/**
 * Abre o arquivo numa nova aba com um link temporário (vale 5 minutos).
 * A aba é aberta antes de pedir o link porque o celular bloqueia janelas
 * abertas depois de uma espera.
 */
export async function abrirArquivo(arquivo: Arquivo) {
  const aba = window.open('', '_blank')
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(arquivo.caminho_storage, 300)
  if (error || !data) {
    aba?.close()
    throw error ?? new Error('Não foi possível abrir o arquivo.')
  }
  if (aba) aba.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}
