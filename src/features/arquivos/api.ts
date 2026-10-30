import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { comprimirSeForFoto, nomeSeguro, TAMANHO_MAXIMO } from '@/lib/arquivos'
import type { Database, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Arquivo = Tables<'arquivos'>
export type CategoriaArquivo = Database['public']['Enums']['categoria_arquivo']

const BUCKET = 'arquivos'

export type Vinculo = {
  clienteId: string
  /** Arquivos de uma proposta. */
  propostaId?: string
  /** Arquivos de um serviço (certificado, relatório, fotos). */
  servicoId?: string
  /** Fotos e assinaturas de uma ordem de serviço. */
  osId?: string
  /** Sem proposta nem serviço: só os documentos gerais do cliente. */
}

export function useArquivos(
  { clienteId, propostaId, servicoId, osId }: Vinculo,
  categoria?: CategoriaArquivo,
) {
  return useQuery({
    queryKey: [
      'arquivos',
      clienteId,
      propostaId ?? servicoId ?? osId ?? 'gerais',
      categoria ?? 'todas',
    ],
    queryFn: async () => {
      let consulta = supabase
        .from('arquivos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('criado_em', { ascending: false })
      if (propostaId) consulta = consulta.eq('proposta_id', propostaId)
      else if (servicoId) consulta = consulta.eq('servico_id', servicoId)
      else if (osId) consulta = consulta.eq('os_id', osId)
      else {
        consulta = consulta
          .is('proposta_id', null)
          .is('lancamento_id', null)
          .is('servico_id', null)
          .is('os_id', null)
      }
      if (categoria) consulta = consulta.eq('categoria', categoria)
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
export function useEnviarArquivos({ clienteId, propostaId, servicoId, osId }: Vinculo) {
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
        // Arquivos da OS ficam numa pasta própria: é por ela que o operador tem acesso.
        const pasta = osId ? `clientes/${clienteId}/os/${osId}` : `clientes/${clienteId}`
        const caminho = `${pasta}/${id}-${nomeSeguro(arquivo.name)}`

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
          servico_id: servicoId ?? null,
          os_id: osId ?? null,
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
/** Links temporários de várias imagens de uma vez (para as miniaturas das fotos). */
export function useLinksDasImagens(arquivos: Arquivo[] | undefined) {
  const imagens = (arquivos ?? []).filter((a) => a.tipo_mime?.startsWith('image/'))
  return useQuery({
    queryKey: ['arquivos', 'links', imagens.map((a) => a.id)],
    enabled: imagens.length > 0,
    staleTime: 4 * 60_000, // os links valem 5 minutos
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(
        imagens.map((a) => a.caminho_storage),
        300,
      )
      if (error) throw error
      return new Map(data.map((d) => [d.path, d.signedUrl]))
    },
  })
}

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
