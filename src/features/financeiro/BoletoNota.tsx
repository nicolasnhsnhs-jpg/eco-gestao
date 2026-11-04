import { FileText, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { mensagemDeErro } from '@/lib/erros'

import { abrirArquivo } from '../arquivos/api'
import { useAnexarBoletoNota, useTirarBoletoNota, type NotaFiscalCompleta } from './notasApi'

/**
 * Boleto da cobrança: anexado no rascunho, segue no mesmo e-mail que leva a nota ao
 * cliente, logo depois da emissão. Na nota já enviada, "Enviar de novo" manda os dois.
 */
export function BoletoNota({ nota }: { nota: NotaFiscalCompleta }) {
  const anexar = useAnexarBoletoNota()
  const tirar = useTirarBoletoNota()
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ocupado = anexar.isPending || tirar.isPending

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    try {
      await anexar.mutateAsync({ nota, arquivo })
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-bold">Boleto</h2>
      <p className="text-sm text-texto-suave">
        {nota.boleto
          ? nota.status === 'rascunho'
            ? 'O boleto vai junto com a nota no e-mail ao cliente, logo depois da emissão.'
            : nota.enviada_em
              ? 'Boleto anexado. Para o cliente receber, use "Enviar de novo": vão a nota e o boleto.'
              : 'O boleto vai junto com a nota no e-mail ao cliente.'
          : 'Anexe o PDF do boleto: ele vai no mesmo e-mail da nota fiscal.'}
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        {nota.boleto && (
          <Button
            variante="secundario"
            onClick={() =>
              abrirArquivo(nota.boleto!).catch((e: unknown) => setErro(mensagemDeErro(e)))
            }
          >
            <FileText className="size-4" aria-hidden /> Ver boleto
          </Button>
        )}
        <Button variante="secundario" disabled={ocupado} onClick={() => entrada.current?.click()}>
          <Upload className="size-4" aria-hidden />
          {anexar.isPending ? 'Anexando…' : nota.boleto ? 'Trocar boleto' : 'Anexar boleto'}
        </Button>
        {nota.boleto && (
          <Button
            variante="secundario"
            disabled={ocupado}
            onClick={() => {
              if (!window.confirm('Tirar o boleto desta nota? Ele não vai mais no e-mail.')) return
              tirar.mutateAsync(nota.id).catch((e: unknown) => setErro(mensagemDeErro(e)))
            }}
          >
            <X className="size-4" aria-hidden /> Tirar boleto
          </Button>
        )}
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          aria-label="PDF do boleto"
          onChange={(e) => void aoEscolher(e.target.files?.[0])}
        />
      </div>
    </Card>
  )
}
