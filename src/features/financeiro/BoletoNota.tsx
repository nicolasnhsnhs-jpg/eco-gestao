import { Ban, Copy, FileText, FlaskConical, Landmark, RefreshCw, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { abrirPdfBase64 } from '@/lib/arquivos'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { abrirArquivo } from '../arquivos/api'
import { totalRetido } from './notas'
import {
  bancoPelaRegra,
  NOME_BANCO,
  useAnexarBoletoNota,
  useBaixarBoleto,
  useBoletoNaEmissao,
  useConfigBoleto,
  useConsultarBoleto,
  useEnsaiarBoleto,
  useEscolherBancoBoleto,
  useGerarBoleto,
  useTirarBoletoNota,
  type BancoBoleto,
  type EnsaioBoleto,
  type NotaFiscalCompleta,
} from './notasApi'

const BANCOS: BancoBoleto[] = ['asaas', 'sicredi']

/** A situação como o financeiro entende (Sicredi: "LIQUIDADO PIX"; Asaas: "RECEIVED"…). */
function nomeSituacao(situacao: string | null): string {
  if (!situacao) return '—'
  if (/^LIQUIDADO/i.test(situacao)) return /PIX/i.test(situacao) ? 'Pago (Pix)' : 'Pago'
  if (/^(RECEIVED|CONFIRMED)$/i.test(situacao)) return 'Pago'
  if (/^RECEIVED_IN_CASH$/i.test(situacao)) return 'Pago (em dinheiro)'
  if (/^(EM CARTEIRA|PENDING)/i.test(situacao)) return 'Aguardando pagamento'
  if (/^(VENCIDO|OVERDUE)/i.test(situacao)) return 'Vencido'
  if (/^(BAIXADO|DELETED)/i.test(situacao)) return 'Cancelado'
  if (/^REFUND/i.test(situacao)) return 'Estornado'
  return situacao.charAt(0) + situacao.slice(1).toLowerCase()
}

const pago = (situacao: string | null) => /^(LIQUIDADO|RECEIVED|CONFIRMED)/i.test(situacao ?? '')

/**
 * Boleto da cobrança: gerado pelo sistema no Asaas ou no Sicredi, ou anexado à mão. Segue
 * no mesmo e-mail que leva a nota ao cliente, logo depois da emissão. Na nota já enviada,
 * "Enviar de novo" manda os dois.
 */
export function BoletoNota({ nota }: { nota: NotaFiscalCompleta }) {
  const config = useConfigBoleto()
  const anexar = useAnexarBoletoNota()
  const tirar = useTirarBoletoNota()
  const gerar = useGerarBoleto()
  const escolher = useEscolherBancoBoleto()
  const marcarEmissao = useBoletoNaEmissao()
  const ensaiar = useEnsaiarBoleto()
  const consultar = useConsultarBoleto()
  const baixar = useBaixarBoleto()
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [ensaio, setEnsaio] = useState<EnsaioBoleto | null>(null)
  const [bancoLocal, setBancoLocal] = useState<BancoBoleto | null>(null)
  const [naEmissaoLocal, setNaEmissaoLocal] = useState<boolean | null>(null)
  const ocupado =
    anexar.isPending ||
    tirar.isPending ||
    gerar.isPending ||
    escolher.isPending ||
    marcarEmissao.isPending ||
    ensaiar.isPending ||
    consultar.isPending ||
    baixar.isPending

  const registrado = !!nota.boleto_cobranca_id
  const bancoDoBoleto = (nota.boleto_banco as BancoBoleto | null) ?? null
  const ligados = BANCOS.filter((b) => config.data?.ambiente[b] === 'producao')
  const emTestes = BANCOS.filter((b) => config.data?.ambiente[b] === 'sandbox')
  const valorBoleto = Math.round((Number(nota.valor_servico) - totalRetido(nota)) * 100) / 100
  const pelaRegra = config.data ? bancoPelaRegra(config.data, valorBoleto) : null
  // O escolhido na tela, senão o gravado na nota, senão o da regra, senão o primeiro ligado.
  const escolhido = [bancoLocal, bancoDoBoleto, pelaRegra, ligados[0]].find(
    (b): b is BancoBoleto => !!b && ligados.includes(b),
  )
  const bancoRegistrado = registrado && bancoDoBoleto ? bancoDoBoleto : null
  const bancoLigado = !!bancoRegistrado && ligados.includes(bancoRegistrado)

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

  function mudarBanco(banco: BancoBoleto) {
    setBancoLocal(banco)
    // No rascunho a escolha fica gravada: é por ele que o boleto sai na emissão.
    if (nota.status === 'rascunho')
      void acao(async () => {
        await escolher.mutateAsync({ notaId: nota.id, banco })
        return null
      })
  }

  const aposGerar =
    nota.status === 'emitida' && nota.enviada_em
      ? ' A nota já tinha sido enviada: use "Enviar de novo" para o cliente receber o boleto.'
      : ''

  const podeGerar = ligados.length > 0 && !nota.boleto && !registrado
  // Rascunho por boleto: o financeiro escolhe se a emissão já gera o boleto no banco.
  const podeNaEmissao =
    nota.status === 'rascunho' && nota.forma_pagamento === 'boleto' && podeGerar && escolhido
  const geraNaEmissao = naEmissaoLocal ?? !!nota.boleto_na_emissao
  const naEmissao = podeNaEmissao && geraNaEmissao

  function marcarNaEmissao(gerar: boolean) {
    setNaEmissaoLocal(gerar)
    void acao(async () => {
      await marcarEmissao.mutateAsync({ notaId: nota.id, gerar })
      return null
    })
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
          : naEmissao
            ? `Na emissão, o sistema gera o boleto pelo ${NOME_BANCO[escolhido]} e manda junto com a nota. Dá para trocar o banco aqui.`
            : podeNaEmissao
              ? 'A nota sai sem boleto. Marque abaixo para gerar o boleto junto na emissão, ou gere (ou anexe) depois.'
              : podeGerar
                ? 'Gere o boleto pelo banco (ou anexe um PDF): ele vai no mesmo e-mail da nota fiscal.'
                : 'Anexe o PDF do boleto: ele vai no mesmo e-mail da nota fiscal.'}
      </p>

      {registrado && (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-texto-suave">
            {bancoRegistrado ? NOME_BANCO[bancoRegistrado] : 'Banco'}
          </dt>
          <dd>
            {nota.boleto_nosso_numero ? `Nosso número ${nota.boleto_nosso_numero} · ` : ''}
            {formatarReais(nota.boleto_valor)} · vence {formatarData(nota.boleto_vencimento)}
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
      {!erro && !registrado && !nota.boleto && nota.erro_boleto && (
        <Aviso tipo="erro">Última tentativa de gerar o boleto: {nota.erro_boleto}</Aviso>
      )}
      {registrado && !nota.boleto && nota.erro_boleto && (
        <Aviso tipo="erro">{nota.erro_boleto}</Aviso>
      )}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}
      {ensaio && (
        <Aviso tipo="sucesso">
          Boleto de teste registrado no sandbox do {NOME_BANCO[ensaio.banco]} (nada vale):{' '}
          {formatarReais(ensaio.valor)}, vence {formatarData(ensaio.vencimento)}.
          {ensaio.erroPdf && ` O PDF não veio: ${ensaio.erroPdf}`}
        </Aviso>
      )}

      {podeNaEmissao && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-verde"
            checked={geraNaEmissao}
            disabled={ocupado}
            onChange={(e) => marcarNaEmissao(e.target.checked)}
          />
          Gerar o boleto pelo {NOME_BANCO[escolhido]} na emissão da nota
        </label>
      )}

      {podeGerar && ligados.length > 1 && (
        <Campo
          rotulo="Banco do boleto"
          htmlFor={`banco-boleto-${nota.id}`}
          dica={
            pelaRegra
              ? `Pela regra das configurações: ${NOME_BANCO[pelaRegra]} (${formatarReais(valorBoleto)}).`
              : undefined
          }
        >
          <Select
            id={`banco-boleto-${nota.id}`}
            value={escolhido ?? ''}
            disabled={ocupado}
            onChange={(e) => mudarBanco(e.target.value as BancoBoleto)}
          >
            {ligados.map((b) => (
              <option key={b} value={b}>
                {NOME_BANCO[b]}
              </option>
            ))}
          </Select>
        </Campo>
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

        {podeGerar && escolhido && (
          <Button
            disabled={ocupado}
            onClick={() =>
              void acao(async () => {
                const r = await gerar.mutateAsync({ notaId: nota.id, banco: escolhido })
                return `Boleto gerado no ${NOME_BANCO[r.banco]}: ${formatarReais(r.valor)}, vence ${formatarData(r.vencimento)}.${aposGerar}`
              })
            }
          >
            <Landmark className="size-4" aria-hidden />
            {gerar.isPending
              ? `Gerando no ${NOME_BANCO[escolhido]}…`
              : `Gerar boleto no ${NOME_BANCO[escolhido]}`}
          </Button>
        )}

        {registrado && !nota.boleto && bancoLigado && (
          <Button
            disabled={ocupado}
            onClick={() =>
              void acao(async () => {
                await gerar.mutateAsync({ notaId: nota.id, banco: bancoRegistrado! })
                return `PDF do boleto guardado.${aposGerar}`
              })
            }
          >
            <Landmark className="size-4" aria-hidden />
            {gerar.isPending ? 'Buscando…' : 'Buscar o PDF do boleto'}
          </Button>
        )}

        {registrado && (
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
          </>
        )}

        {registrado && bancoLigado && (
          <>
            <Button
              variante="secundario"
              disabled={ocupado}
              onClick={() =>
                void acao(async () => {
                  const r = await consultar.mutateAsync(nota.id)
                  return r.pago
                    ? `Pago${r.pagoEm ? ` em ${formatarData(r.pagoEm)}` : ''}${r.valorPago != null ? ` (${formatarReais(r.valorPago)})` : ''}. Dê baixa na conta a receber.`
                    : `Situação no ${NOME_BANCO[bancoRegistrado!]}: ${nomeSituacao(r.situacao)}.`
                })
              }
            >
              <RefreshCw className="size-4" aria-hidden />
              {consultar.isPending ? 'Consultando…' : 'Atualizar situação'}
            </Button>
            {!pago(nota.boleto_situacao) && (
              <Button
                variante="secundario"
                disabled={ocupado}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Cancelar este boleto no ${NOME_BANCO[bancoRegistrado!]}? O cliente não consegue mais pagá-lo.`,
                    )
                  )
                    return
                  void acao(async () => {
                    await baixar.mutateAsync(nota.id)
                    return 'Boleto cancelado no banco: não vale mais. Agora dá para gerar outro.'
                  })
                }}
              >
                <Ban className="size-4" aria-hidden />
                {baixar.isPending ? 'Cancelando…' : 'Cancelar boleto'}
              </Button>
            )}
          </>
        )}

        {!registrado && (
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

        {emTestes.map((banco) => (
          <Button
            key={banco}
            variante="secundario"
            disabled={ocupado}
            onClick={() => {
              setEnsaio(null)
              void acao(async () => {
                const r = await ensaiar.mutateAsync({ notaId: nota.id, banco })
                setEnsaio(r)
                if (r.pdfBase64) abrirPdfBase64(r.pdfBase64)
                return null
              })
            }}
          >
            <FlaskConical className="size-4" aria-hidden />
            {ensaiar.isPending && ensaiar.variables?.banco === banco
              ? 'Testando…'
              : `Testar no ${NOME_BANCO[banco]} (sandbox)`}
          </Button>
        ))}
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
