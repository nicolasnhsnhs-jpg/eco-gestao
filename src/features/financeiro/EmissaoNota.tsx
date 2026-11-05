import { FileCheck, FlaskConical, FileText, Send } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { abrirPdfBase64 } from '@/lib/arquivos'
import { mensagemDeErro } from '@/lib/erros'

import { useAmbienteNfse, useEmitirNota, useEnsaiarNota, type NotaFiscalCompleta } from './notasApi'
import { textoEmissao } from './notas'

/**
 * Rascunho → nota emitida, sem sair do sistema. "Emitir e enviar" salva o que foi
 * conferido, emite no Sistema Nacional NFS-e, guarda o PDF e manda ao cliente; "Só
 * emitir" para antes do e-mail (o financeiro anexa o boleto e envia depois).
 * No ambiente de testes, "Testar emissão" manda ao governo sem valer nada.
 */
export function EmissaoNota({
  nota,
  salvarAntes = async () => true,
  modelo = false,
}: {
  nota: NotaFiscalCompleta
  /** Salva o formulário como rascunho; false se algo impediu (o erro aparece no formulário). */
  salvarAntes?: () => Promise<boolean>
  /** Nota já emitida: só o teste no ambiente do governo, usando esta nota como modelo. */
  modelo?: boolean
}) {
  const ambiente = useAmbienteNfse()
  const emitir = useEmitirNota()
  const ensaiar = useEnsaiarNota()
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [pdfTeste, setPdfTeste] = useState<string | null>(null)
  const ocupado = emitir.isPending || ensaiar.isPending

  if (ambiente.data !== 'producao' && ambiente.data !== 'homologacao') return null
  if (modelo && ambiente.data !== 'homologacao') return null

  async function confirmarEEmitir(enviar: boolean) {
    if (
      !window.confirm(
        enviar
          ? 'Emitir esta nota agora? Ela vai para o Sistema Nacional NFS-e e o PDF segue ao cliente.'
          : 'Emitir esta nota agora, sem mandar ao cliente? Depois anexe o boleto e clique em Enviar.',
      )
    )
      return
    setMensagem(null)
    if (!(await salvarAntes())) return
    try {
      setMensagem({
        tipo: 'sucesso',
        texto: textoEmissao(await emitir.mutateAsync({ notaId: nota.id, enviar })),
      })
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
      <h2 className="font-bold">{modelo ? 'Testar emissão' : 'Emitir pelo sistema'}</h2>
      {modelo ? (
        <p className="text-sm text-texto-suave">
          Teste com os dados desta nota já emitida: vai ao ambiente de testes do governo, sem valor
          fiscal, e esta nota não muda.
        </p>
      ) : ambiente.data === 'homologacao' ? (
        <p className="text-sm text-texto-suave">
          A emissão está em <strong>testes</strong>: a nota vai ao ambiente de testes do governo,
          sem valor fiscal, e este rascunho não muda. Serve para conferir se tudo está certo antes
          de ligar a emissão de verdade.
        </p>
      ) : (
        <p className="text-sm text-texto-suave">
          Confira os dados acima. <strong>Emitir e enviar</strong>: o sistema emite a nota no
          Sistema Nacional NFS-e, guarda o PDF e o XML e já manda ao e-mail do cliente.{' '}
          <strong>Só emitir</strong>: emite e para aí; você anexa o boleto e clica em Enviar.
        </p>
      )}
      {!modelo && nota.erro_emissao && !mensagem && (
        <Aviso tipo="erro">Última tentativa: {nota.erro_emissao}</Aviso>
      )}
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      <div className="flex flex-wrap gap-2">
        {ambiente.data === 'producao' ? (
          <>
            <Button disabled={ocupado} onClick={() => void confirmarEEmitir(true)}>
              <Send className="size-4" aria-hidden />
              {emitir.isPending ? 'Emitindo…' : 'Emitir e enviar ao cliente'}
            </Button>
            <Button
              variante="secundario"
              disabled={ocupado}
              onClick={() => void confirmarEEmitir(false)}
            >
              <FileCheck className="size-4" aria-hidden /> Só emitir
            </Button>
          </>
        ) : (
          <Button disabled={ocupado} onClick={() => void testar()}>
            <FlaskConical className="size-4" aria-hidden />
            {ensaiar.isPending ? 'Testando…' : 'Testar emissão'}
          </Button>
        )}
        {pdfTeste && (
          <Button variante="secundario" onClick={() => abrirPdfBase64(pdfTeste)}>
            <FileText className="size-4" aria-hidden /> Ver PDF de teste
          </Button>
        )}
      </div>
    </Card>
  )
}
