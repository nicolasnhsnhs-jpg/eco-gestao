import { Download, ExternalLink, FileText, Mail, MessageCircle, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { linkWhatsapp, soNumeros } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'

import type { ClienteCompleto } from '../../clientes/api'
import type { PropostaCompleta } from '../api'
import {
  nomeArquivoProposta,
  pdfDaProposta,
  propostaGravadaParaBase,
  useVendedorPdf,
} from './usoPdf'

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// -----------------------------------------------------------------------------
// Prévia ao vivo (enquanto preenche)
// -----------------------------------------------------------------------------

/**
 * Mostra o PDF montado a partir do que está no formulário. Refaz o PDF um pouco
 * depois da última mudança (não a cada letra) e só troca quando o novo fica pronto.
 */
export function PreviaPdf({ gerar, chave }: { gerar: () => Promise<Blob>; chave: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const gerarRef = useRef(gerar)
  useEffect(() => {
    gerarRef.current = gerar
  })

  useEffect(() => {
    let cancelado = false
    const espera = setTimeout(async () => {
      setGerando(true)
      try {
        const blob = await gerarRef.current()
        if (cancelado) return
        const novo = URL.createObjectURL(blob)
        setUrl((antigo) => {
          if (antigo) setTimeout(() => URL.revokeObjectURL(antigo), 2000)
          return novo
        })
        setErro(null)
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErro(e))
      } finally {
        if (!cancelado) setGerando(false)
      }
    }, 700)
    return () => {
      cancelado = true
      clearTimeout(espera)
    }
  }, [chave])

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-texto-suave">
          <FileText className="size-4" aria-hidden />
          Prévia do PDF {gerando && <span className="font-normal">· atualizando…</span>}
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-verde hover:underline"
          >
            <ExternalLink className="size-4" aria-hidden /> Abrir em outra aba
          </a>
        )}
      </div>
      {erro && <Aviso tipo="erro">Não deu para montar a prévia: {erro}</Aviso>}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-borda bg-fundo-suave">
        {url ? (
          <iframe
            title="Prévia do PDF da proposta"
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            className="h-full w-full"
          />
        ) : (
          <p className="p-6 text-center text-sm text-texto-suave">Montando a prévia…</p>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Botões da proposta salva: abrir, baixar, enviar
// -----------------------------------------------------------------------------

export function AcoesPdfProposta({
  p,
  cliente,
}: {
  p: PropostaCompleta
  cliente: ClienteCompleto | null | undefined
}) {
  const vendedor = useVendedorPdf(p.vendedor_id)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const nomeCliente = p.cliente?.nome_fantasia || p.cliente?.nome || ''
  const nome = nomeArquivoProposta(p.numero, nomeCliente)
  const podeCompartilhar =
    typeof navigator !== 'undefined' &&
    !!navigator.canShare?.({ files: [new File([''], nome, { type: 'application/pdf' })] })

  const telefone = p.contato_telefone || cliente?.whatsapp || cliente?.telefone || ''
  const email = p.contato_email || cliente?.email || ''
  const mensagem =
    `Olá${p.contato_nome ? `, ${p.contato_nome.replace(/^(sr|sra|srª)\.?\s*/i, '')}` : ''}! ` +
    `Segue a proposta nº ${p.numero} da ${UNIDADE.nome} para ${nomeCliente}. Fico à disposição para qualquer dúvida.`

  async function comPdf(acao: (blob: Blob) => Promise<void> | void, aba?: Window | null) {
    setErro(null)
    setOcupado(true)
    try {
      const blob = await pdfDaProposta(
        propostaGravadaParaBase(p),
        cliente,
        p.endereco_id,
        vendedor.data,
      )
      await acao(blob)
    } catch (e) {
      aba?.close()
      if ((e as Error)?.name !== 'AbortError') setErro(mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  function abrir() {
    // A aba abre já no clique (senão o navegador bloqueia) e recebe o PDF quando ficar pronto.
    const aba = window.open('', '_blank')
    void comPdf((blob) => {
      const url = URL.createObjectURL(blob)
      if (aba) aba.location.href = url
      else window.location.href = url
    }, aba)
  }

  const pronto = !vendedor.isPending && cliente !== undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={abrir} disabled={!pronto || ocupado}>
          <FileText className="size-4" aria-hidden /> Ver PDF
        </Button>
        <Button
          variante="secundario"
          onClick={() => void comPdf((b) => baixar(b, nome))}
          disabled={!pronto || ocupado}
        >
          <Download className="size-4" aria-hidden /> Baixar
        </Button>
        {podeCompartilhar && (
          <Button
            variante="secundario"
            onClick={() =>
              void comPdf(async (b) => {
                await navigator.share({
                  files: [new File([b], nome, { type: 'application/pdf' })],
                  title: `Proposta ${p.numero}`,
                  text: mensagem,
                })
              })
            }
            disabled={!pronto || ocupado}
          >
            <Share2 className="size-4" aria-hidden /> Enviar
          </Button>
        )}
        {soNumeros(telefone).length >= 10 && (
          <Button
            variante="secundario"
            onClick={() =>
              void comPdf((b) => {
                baixar(b, nome)
                window.open(
                  `${linkWhatsapp(telefone)}?text=${encodeURIComponent(mensagem)}`,
                  '_blank',
                )
              })
            }
            disabled={!pronto || ocupado}
          >
            <MessageCircle className="size-4" aria-hidden /> WhatsApp
          </Button>
        )}
        {email && (
          <Button
            variante="secundario"
            onClick={() =>
              void comPdf((b) => {
                baixar(b, nome)
                const destino = email
                  .split(/[;,/\s]+/)
                  .filter(Boolean)
                  .join(',')
                window.location.href =
                  `mailto:${destino}?subject=${encodeURIComponent(`Proposta ${p.numero} - ${UNIDADE.nome}`)}` +
                  `&body=${encodeURIComponent(mensagem)}`
              })
            }
            disabled={!pronto || ocupado}
          >
            <Mail className="size-4" aria-hidden /> E-mail
          </Button>
        )}
      </div>
      <p className="text-sm text-texto-suave">
        WhatsApp e e-mail baixam o PDF e abrem a conversa: é só anexar o arquivo baixado.
        {podeCompartilhar && ' No celular, “Enviar” já manda o PDF junto.'}
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  )
}
