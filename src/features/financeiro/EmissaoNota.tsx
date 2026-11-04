import { FlaskConical, FileText, Send } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { mensagemDeErro } from '@/lib/erros'

import { useAmbienteNfse, useEmitirNota, useEnsaiarNota, type NotaFiscalCompleta } from './notasApi'
import { textoEmissao } from './notas'

/** Abre o PDF (base64) numa aba nova. */
function abrirPdf(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Rascunho → nota emitida, sem sair do sistema. "Confirmar e emitir" salva o que foi
 * conferido, emite no Sistema Nacional NFS-e, guarda o PDF e manda ao cliente.
 * No ambiente de testes, "Testar emissão" manda ao governo sem valer nada.
 */
export function EmissaoNota({
  nota,
  salvarAntes,
}: {
  nota: NotaFiscalCompleta
  /** Salva o formulário como rascunho; false se algo impediu (o erro aparece no formulário). */
  salvarAntes: () => Promise<boolean>
}) {
  const ambiente = useAmbienteNfse()
  const emitir = useEmitirNota()
  const ensaiar = useEnsaiarNota()
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [pdfTeste, setPdfTeste] = useState<string | null>(null)
  const ocupado = emitir.isPending || ensaiar.isPending

  if (ambiente.data !== 'producao' && ambiente.data !== 'homologacao') return null

  async function confirmarEEmitir() {
    if (
      !window.confirm(
        'Emitir esta nota agora? Ela vai para o Sistema Nacional NFS-e e o PDF segue ao cliente.',
      )
    )
      return
    setMensagem(null)
    if (!(await salvarAntes())) return
    try {
      setMensagem({ tipo: 'sucesso', texto: textoEmissao(await emitir.mutateAsync(nota.id)) })
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) })
    }
  }

  async function testar() {
    setMensagem(null)
    setPdfTeste(null)
    if (!(await salvarAntes())) return
    try {
      const r = await ensaiar.mutateAsync(nota.id)
      if (r.ok) {
        setPdfTeste(r.pdfBase64)
        setMensagem({
          tipo: 'sucesso',
          texto: `O governo aceitou a nota de teste (nº ${r.numero ?? '—'}).${r.alertas.length ? ` Alertas: ${r.alertas.join(' | ')}` : ''}`,
        })
      } else setMensagem({ tipo: 'erro', texto: r.erro })
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) })
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-bold">Emitir pelo sistema</h2>
      {ambiente.data === 'homologacao' ? (
        <p className="text-sm text-texto-suave">
          A emissão está em <strong>testes</strong>: a nota vai ao ambiente de testes do governo,
          sem valor fiscal, e este rascunho não muda. Serve para conferir se tudo está certo antes
          de ligar a emissão de verdade.
        </p>
      ) : (
        <p className="text-sm text-texto-suave">
          Confira os dados acima e confirme: o sistema emite a nota no Sistema Nacional NFS-e,
          guarda o PDF e o XML e manda o PDF ao e-mail do cliente.
        </p>
      )}
      {nota.erro_emissao && !mensagem && (
        <Aviso tipo="erro">Última tentativa: {nota.erro_emissao}</Aviso>
      )}
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      <div className="flex flex-wrap gap-2">
        {ambiente.data === 'producao' ? (
          <Button disabled={ocupado} onClick={() => void confirmarEEmitir()}>
            <Send className="size-4" aria-hidden />
            {emitir.isPending ? 'Emitindo…' : 'Confirmar e emitir'}
          </Button>
        ) : (
          <Button disabled={ocupado} onClick={() => void testar()}>
            <FlaskConical className="size-4" aria-hidden />
            {ensaiar.isPending ? 'Testando…' : 'Testar emissão'}
          </Button>
        )}
        {pdfTeste && (
          <Button variante="secundario" onClick={() => abrirPdf(pdfTeste)}>
            <FileText className="size-4" aria-hidden /> Ver PDF de teste
          </Button>
        )}
      </div>
    </Card>
  )
}
