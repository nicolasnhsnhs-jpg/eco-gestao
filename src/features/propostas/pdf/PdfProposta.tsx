import { Download, ExternalLink, FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'

import type { ClienteCompleto } from '../../clientes/api'
import type { PropostaCompleta } from '../api'
import {
  copiarPropostaNoDrive,
  nomeArquivoProposta,
  pdfDaProposta,
  propostaGravadaParaBase,
  useVendedorPdf,
} from './usoPdf'
import { PaginasPdf } from './PaginasPdf'

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

type JanelaComSalvar = Window & {
  showSaveFilePicker?: (opcoes: {
    suggestedName?: string
    types?: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<{
    createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>
  }>
}

/**
 * Pergunta onde salvar (Chrome/Edge). Tem de ser chamado direto no clique.
 * Devolve null quando o navegador não oferece a janela de salvar.
 */
async function escolherOndeSalvar(nome: string) {
  const w = window as JanelaComSalvar
  if (!w.showSaveFilePicker) return null
  return w.showSaveFilePicker({
    suggestedName: nome,
    types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
  })
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
  const [blob, setBlob] = useState<Blob | null>(null)
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
        setBlob(blob)
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
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-borda bg-fundo-suave p-2">
        {blob ? (
          <PaginasPdf blob={blob} />
        ) : (
          <p className="p-6 text-center text-sm text-texto-suave">Montando a prévia…</p>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Botões da proposta salva: abrir e baixar
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
      copiarPropostaNoDrive(p.id, blob)
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

  async function salvar() {
    let destino: Awaited<ReturnType<typeof escolherOndeSalvar>>
    try {
      // A janela de salvar abre já no clique; o PDF é montado depois.
      destino = await escolherOndeSalvar(nome)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return // cancelou
      destino = null
    }
    await comPdf(async (b) => {
      if (!destino) return baixar(b, nome)
      const arquivo = await destino.createWritable()
      await arquivo.write(b)
      await arquivo.close()
    })
  }

  const pronto = !vendedor.isPending && cliente !== undefined

  // Proposta salva (nova ou alterada): a cópia vai para o Drive sem ninguém clicar.
  // Uma vez por versão neste navegador, para não reenviar a cada visita.
  useEffect(() => {
    if (!pronto || !UNIDADE.drive) return
    const chave = `drive:proposta:${p.id}:${p.atualizado_em}`
    try {
      if (localStorage.getItem(chave)) return
      // Marca antes de gerar: a página pode rodar isto de novo enquanto o PDF é montado.
      localStorage.setItem(chave, '1')
    } catch {
      /* sem armazenamento: manda assim mesmo */
    }
    void pdfDaProposta(propostaGravadaParaBase(p), cliente, p.endereco_id, vendedor.data)
      .then((blob) => copiarPropostaNoDrive(p.id, blob))
      .catch(() => {})
    // Só quando a versão da proposta muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, p.id, p.atualizado_em])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={abrir} disabled={!pronto || ocupado}>
          <FileText className="size-4" aria-hidden /> Ver PDF
        </Button>
        <Button
          variante="secundario"
          onClick={() => void salvar()}
          disabled={!pronto || ocupado}
        >
          <Download className="size-4" aria-hidden /> Baixar
        </Button>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  )
}
