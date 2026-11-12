import type { QueryClient } from '@tanstack/react-query'

import { consultaOs } from '@/features/os/api'
import { montarPdfOs } from '@/features/os/pdf/gerarPdfOs'

import { enviarDocumentosAoCliente, paraBase64, type CertificadoResumo } from '../api'
import { pdfFinalCertificado } from './gerarPdfCertificado'

const base64DoBlob = async (b: Blob) => paraBase64(new Uint8Array(await b.arrayBuffer()))

/**
 * Monta o PDF do certificado (assinado, quando marcado) e o de cada OS escolhida, e manda
 * tudo num e-mail só ao cliente, pelo e-mail do ADM.
 */
export async function enviarCertificadoEOs(
  queryClient: QueryClient,
  c: CertificadoResumo,
  osIds: string[],
  para: string,
  aoAvancar?: (etapa: string) => void,
) {
  aoAvancar?.('Montando o certificado…')
  const certificado = await base64DoBlob(await pdfFinalCertificado(c))
  const os: { id: string; pdf: string }[] = []
  for (const id of osIds) {
    const dados = await queryClient.fetchQuery(consultaOs(id))
    if (!dados) throw new Error('OS não encontrada.')
    aoAvancar?.(`Montando a ${dados.numero}…`)
    os.push({ id, pdf: await base64DoBlob(await montarPdfOs(dados)) })
  }
  aoAvancar?.('Enviando o e-mail…')
  return enviarDocumentosAoCliente({
    certificadoId: c.id,
    para: para.trim() || undefined,
    certificado,
    os,
  })
}
