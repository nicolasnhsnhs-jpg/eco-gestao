import { Ban, Copy, FileText, FlaskConical, Landmark, RefreshCw, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { abrirPdfBase64 } from '@/lib/arquivos'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { abrirArquivo } from '../arquivos/api'
import {
  useAmbienteBoleto,
  useAnexarBoletoNota,
  useBaixarBoleto,
  useConsultarBoleto,
  useEnsaiarBoleto,
  useGerarBoleto,
  useTirarBoletoNota,
  type EnsaioBoleto,
  type NotaFiscalCompleta,
} from './notasApi'

/** "LIQUIDADO PIX" → "Pago (Pix)"; o resto, como o Sicredi escreve. */
function nomeSituacao(situacao: string | null): string {
  if (!situacao) return '—'
  if (/^LIQUIDADO/i.test(situacao)) return /PIX/i.test(situacao) ? 'Pago (Pix)' : 'Pago'
  if (/^EM CARTEIRA/i.test(situacao)) return 'Aguardando pagamento'
  if (/^VENCIDO/i.test(situacao)) return 'Vencido'
  if (/^BAIXADO/i.test(situacao)) return 'Baixado (cancelado)'
  return situacao.charAt(0) + situacao.slice(1).toLowerCase()
}

/**
 * Boleto da cobrança: gerado no Sicredi pelo sistema ou anexado à mão. Segue no mesmo
 * e-mail que leva a nota ao cliente, logo depois da emissão. Na nota já enviada,
 * "Enviar de novo" manda os dois.
 */
export function BoletoNota({ nota }: { nota: NotaFiscalCompleta }) {
  const ambiente = useAmbienteBoleto()
  const anexar = useAnexarBoletoNota()
  const tirar = useTirarBoletoNota()
  const gerar = useGerarBoleto()
  const ensaiar = useEnsaiarBoleto()
  const consultar = useConsultarBoleto()
  const baixar = useBaixarBoleto()
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [ensaio, setEnsaio] = useState<EnsaioBoleto | null>(null)
  const ocupado =
    anexar.isPending ||
    tirar.isPending ||
    gerar.isPending ||
    ensaiar.isPending ||
    consultar.isPending ||
    baixar.isPending

  const doSicredi = !!nota.boleto_nosso_numero
  const ligado = ambiente.data === 'producao'

  async function acao(fazer: () => Promise<string | null>) {
    setErro(null)
    setSucesso(null)
    try {
      setSucesso(await fazer())
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return
    await acao(async () => {
      await anexar.mutateAsync({ nota, arquivo })
      return null
    })
    if (entrada.current) entrada.current.value = ''
  }

  const aposGerar =
    nota.status === 'emitida' && nota.enviada_em
      ? ' A nota já tinha sido enviada: use "Enviar de novo" para o cliente receber o boleto.'
      : ''

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
          : ligado
            ? 'Gere o boleto no Sicredi (ou anexe um PDF): ele vai no mesmo e-mail da nota fiscal.'
            : 'Anexe o PDF do boleto: ele vai no mesmo e-mail da nota fiscal.'}
      </p>

      {doSicredi && (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-texto-suave">Sicredi</dt>
          <dd>
            Nosso número {nota.boleto_nosso_numero} · {formatarReais(nota.boleto_valor)} · vence{' '}
            {formatarData(nota.boleto_vencimento)}
          </dd>
          <dt className="text-texto-suave">Situação</dt>
          <dd>
            {nomeSituacao(nota.boleto_situacao)}
            {nota.boleto_consultado_em && (
              <span className="text-texto-suave">
                {' '}
                (consultado em {formatarDataHora(nota.boleto_consultado_em)})
              </span>
            )}
          </dd>
          <dt className="text-texto-suave">Linha digitável</dt>
          <dd className="font-mono text-xs break-all">{nota.boleto_linha_digitavel}</dd>
        </dl>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!erro && !doSicredi && !nota.boleto && nota.erro_boleto && (
        <Aviso tipo="erro">Última tentativa de gerar o boleto: {nota.erro_boleto}</Aviso>
      )}
      {doSicredi && !nota.boleto && nota.erro_boleto && (
        <Aviso tipo="erro">{nota.erro_boleto}</Aviso>
      )}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      {ensaio && (
        <Aviso tipo="sucesso">
          Boleto de teste registrado no sandbox do Sicredi (nada vale): nosso número{' '}
          {ensaio.nossoNumero}, {formatarReais(ensaio.valor)}, vence{' '}
          {formatarData(ensaio.vencimento)}.{ensaio.erroPdf && ` O PDF não veio: ${ensaio.erroPdf}`}
        </Aviso>
      )}

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

        {ligado && !nota.boleto && (
          <Button
            disabled={ocupado}
            onClick={() =>
              void acao(async () => {
                const r = await gerar.mutateAsync(nota.id)
                return `Boleto gerado no Sicredi: ${formatarReais(r.valor)}, vence ${formatarData(r.vencimento)}.${aposGerar}`
              })
            }
          >
            <Landmark className="size-4" aria-hidden />
            {gerar.isPending
              ? 'Gerando no Sicredi…'
              : doSicredi
                ? 'Buscar o PDF do boleto'
                : 'Gerar boleto no Sicredi'}
          </Button>
        )}

        {doSicredi && ligado && (
          <>
            <Button
              variante="secundario"
              onClick={() =>
                void acao(async () => {
                  await navigator.clipboard.writeText(nota.boleto_linha_digitavel ?? '')
                  return 'Linha digitável copiada.'
                })
              }
            >
              <Copy className="size-4" aria-hidden /> Copiar linha
            </Button>
            {nota.boleto_pix && (
              <Button
                variante="secundario"
                onClick={() =>
                  void acao(async () => {
                    await navigator.clipboard.writeText(nota.boleto_pix ?? '')
                    return 'Pix copia e cola copiado.'
                  })
                }
              >
                <Copy className="size-4" aria-hidden /> Copiar Pix
              </Button>
            )}
            <Button
              variante="secundario"
              disabled={ocupado}
              onClick={() =>
                void acao(async () => {
                  const r = await consultar.mutateAsync(nota.id)
                  return r.pago
                    ? `Pago${r.pagoEm ? ` em ${formatarData(r.pagoEm)}` : ''}${r.valorPago != null ? ` (${formatarReais(r.valorPago)})` : ''}. Dê baixa na conta a receber.`
                    : `Situação no Sicredi: ${nomeSituacao(r.situacao)}.`
                })
              }
            >
              <RefreshCw className="size-4" aria-hidden />
              {consultar.isPending ? 'Consultando…' : 'Atualizar situação'}
            </Button>
            {!/^LIQUIDADO/i.test(nota.boleto_situacao ?? '') && (
              <Button
                variante="secundario"
                disabled={ocupado}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Cancelar este boleto no Sicredi (pedido de baixa)? O cliente não consegue mais pagá-lo.',
                    )
                  )
                    return
                  void acao(async () => {
                    await baixar.mutateAsync(nota.id)
                    return 'Baixa pedida no Sicredi: o boleto não vale mais. Agora dá para gerar outro.'
                  })
                }}
              >
                <Ban className="size-4" aria-hidden />
                {baixar.isPending ? 'Cancelando…' : 'Cancelar boleto'}
              </Button>
            )}
          </>
        )}

        {!doSicredi && (
          <>
            <Button
              variante="secundario"
              disabled={ocupado}
              onClick={() => entrada.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              {anexar.isPending ? 'Anexando…' : nota.boleto ? 'Trocar boleto' : 'Anexar boleto'}
            </Button>
            {nota.boleto && (
              <Button
                variante="secundario"
                disabled={ocupado}
                onClick={() => {
                  if (!window.confirm('Tirar o boleto desta nota? Ele não vai mais no e-mail.'))
                    return
                  void acao(async () => {
                    await tirar.mutateAsync(nota.id)
                    return null
                  })
                }}
              >
                <X className="size-4" aria-hidden /> Tirar boleto
              </Button>
            )}
          </>
        )}

        {ambiente.data === 'sandbox' && (
          <Button
            variante="secundario"
            disabled={ocupado}
            onClick={() => {
              setEnsaio(null)
              void acao(async () => {
                const r = await ensaiar.mutateAsync(nota.id)
                setEnsaio(r)
                if (r.pdfBase64) abrirPdfBase64(r.pdfBase64)
                return null
              })
            }}
          >
            <FlaskConical className="size-4" aria-hidden />
            {ensaiar.isPending ? 'Testando…' : 'Testar boleto (sandbox)'}
          </Button>
        )}
        {ensaio?.pdfBase64 && (
          <Button variante="secundario" onClick={() => abrirPdfBase64(ensaio.pdfBase64!)}>
            <FileText className="size-4" aria-hidden /> Ver boleto de teste
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
