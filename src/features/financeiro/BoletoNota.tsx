import {
  Ban,
  Copy,
  FileText,
  FlaskConical,
  Plus,
  Landmark,
  Mail,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { abrirPdfBase64 } from '@/lib/arquivos'
import { formatarData, formatarDataHora } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { juntarEmails } from '@/lib/emails'
import { mensagemDeErro } from '@/lib/erros'

import { abrirArquivo } from '../arquivos/api'
import { oQueFoiEnviado, totalRetido } from './notas'
import {
  BANCOS_DA_UNIDADE,
  bancoPelaRegra,
  NOME_BANCO,
  useEnviarNotaPorEmail,
  useAnexarBoletoExtra,
  useAnexarBoletoNota,
  useBoletosExtras,
  useBaixarBoleto,
  useBoletoNaEmissao,
  useConfigBoleto,
  useConsultarBoleto,
  useEnsaiarBoleto,
  useEscolherBancoBoleto,
  useGerarBoleto,
  useTirarBoletoExtra,
  useTirarBoletoNota,
  type BancoBoleto,
  type EnsaioBoleto,
  type NotaFiscalCompleta,
} from './notasApi'

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
 * Boleto da cobrança: gerado pelo sistema (um botão por banco da unidade: no RS, Asaas e
 * Sicredi; em SC, só Asaas) ou anexado à mão. Segue no mesmo e-mail que leva a nota ao
 * cliente, logo depois da emissão; gerado depois, "Enviar nota e boleto" manda os dois.
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
  const enviar = useEnviarNotaPorEmail()
  const anexarExtra = useAnexarBoletoExtra()
  const tirarExtra = useTirarBoletoExtra()
  const extras = useBoletosExtras(nota)
  const entrada = useRef<HTMLInputElement>(null)
  const entradaExtra = useRef<HTMLInputElement>(null)
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
    baixar.isPending ||
    enviar.isPending ||
    anexarExtra.isPending ||
    tirarExtra.isPending

  const registrado = !!nota.boleto_cobranca_id
  const bancoDoBoleto = (nota.boleto_banco as BancoBoleto | null) ?? null
  const ligados = BANCOS_DA_UNIDADE.filter((b) => config.data?.ambiente[b] === 'producao')
  const emTestes = BANCOS_DA_UNIDADE.filter((b) => config.data?.ambiente[b] === 'sandbox')
  const desligados = BANCOS_DA_UNIDADE.filter((b) => !ligados.includes(b))
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

  async function aoEscolherExtra(arquivo: File | undefined) {
    if (!arquivo) return
    await acao(async () => {
      await anexarExtra.mutateAsync({ nota, arquivo })
      return 'Boleto anexado: vai no mesmo e-mail, junto com a nota e o outro boleto.'
    })
    if (entradaExtra.current) entradaExtra.current.value = ''
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
    nota.status === 'emitida' && nota.pdf
      ? ' Clique em "Enviar nota e boleto" para o cliente receber os dois.'
      : ''

  const semBoleto = !nota.boleto && !registrado
  const podeGerar = ligados.length > 0 && semBoleto
  // Nota emitida com PDF e boleto: o botão manda os dois ao cliente (o mesmo e-mail da nota).
  const qtdExtras = nota.boletos_extras?.length ?? 0
  const podeEnviar = nota.status === 'emitida' && !!nota.pdf && (!!nota.boleto || qtdExtras > 0)
  // Boleto a mais (emitido por fora, outro prazo): só depois do primeiro.
  const podeAnexarExtra = nota.status !== 'cancelada' && (!!nota.boleto || qtdExtras > 0)

  function gerarNo(banco: BancoBoleto) {
    void acao(async () => {
      const r = await gerar.mutateAsync({ notaId: nota.id, banco })
      return `Boleto gerado no ${NOME_BANCO[r.banco]}: ${formatarReais(r.valor)}, vence ${formatarData(r.vencimento)}.${aposGerar}`
    })
  }

  function enviarBoleto() {
    void acao(async () => {
      const r = await enviar.mutateAsync({ notaId: nota.id })
      if (!r.enviada) throw new Error(`${r.motivo} Ficou o aviso de envio pendente.`)
      return `${oQueFoiEnviado(r.comBoleto, r.boletos)} para ${juntarEmails(r.para)}.`
    })
  }
  // Rascunho por boleto: o financeiro escolhe se a emissão já gera o boleto no banco.
  const podeNaEmissao =
    nota.status === 'rascunho' && nota.forma_pagamento === 'boleto' && podeGerar && escolhido
  const geraNaEmissao = naEmissaoLocal ?? !!nota.boleto_na_emissao
  const naEmissao = podeNaEmissao && geraNaEmissao

  function marcarNaEmissao(gerar: boolean) {
    setNaEmissaoLocal(gerar)
    void acao(async () => {
      await marcarEmissao.mutateAsync({ notaId: nota.id, gerar, banco: escolhido })
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
              ? 'Boleto pronto. Para o cliente receber, clique em "Enviar nota e boleto": vão os dois no mesmo e-mail.'
              : 'O boleto vai junto com a nota no e-mail ao cliente.'
          : naEmissao
            ? `Na emissão, o sistema gera o boleto pelo ${NOME_BANCO[escolhido]} e manda junto com a nota. Dá para trocar o banco aqui.`
            : podeNaEmissao
              ? 'A nota sai sem boleto. Marque abaixo para gerar o boleto junto na emissão, ou gere (ou anexe) depois.'
              : podeGerar
                ? 'Escolha em qual banco gerar o boleto (ou anexe um PDF): ele vai no mesmo e-mail da nota fiscal.'
                : 'Anexe o PDF do boleto: ele vai no mesmo e-mail da nota fiscal.'}
      </p>
      {semBoleto && config.isSuccess && desligados.length > 0 && (
        <p className="text-xs text-texto-suave">
          {desligados.map((b) => NOME_BANCO[b]).join(' e ')}{' '}
          {desligados.length > 1 ? 'ainda não estão valendo' : 'ainda não está valendo'}: ligue em
          Financeiro → Cadastros → Boleto pelo sistema.
        </p>
      )}

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

      {qtdExtras > 0 && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-texto-suave">Boletos a mais (vão no mesmo e-mail):</p>
          <ul className="flex flex-col gap-1">
            {(extras.data ?? []).map((a, i) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {i + 2}. {a.nome_original}
                </span>
                <Button
                  variante="secundario"
                  onClick={() => abrirArquivo(a).catch((e: unknown) => setErro(mensagemDeErro(e)))}
                >
                  <FileText className="size-4" aria-hidden /> Ver
                </Button>
                <Button
                  variante="secundario"
                  disabled={ocupado}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Tirar "${a.nome_original}" desta nota? Ele não vai mais no e-mail.`,
                      )
                    )
                      return
                    void acao(async () => {
                      await tirarExtra.mutateAsync({ nota, arquivoId: a.id })
                      return null
                    })
                  }}
                >
                  <X className="size-4" aria-hidden /> Tirar
                </Button>
              </li>
            ))}
          </ul>
        </div>
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

      {podeNaEmissao && geraNaEmissao && ligados.length > 1 && (
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

        {semBoleto &&
          !naEmissao &&
          BANCOS_DA_UNIDADE.map((banco) => (
            <Button
              key={banco}
              disabled={ocupado || !ligados.includes(banco)}
              title={
                ligados.includes(banco)
                  ? undefined
                  : `O ${NOME_BANCO[banco]} ainda não está valendo.`
              }
              onClick={() => gerarNo(banco)}
            >
              <Landmark className="size-4" aria-hidden />
              {gerar.isPending && gerar.variables?.banco === banco
                ? `Gerando no ${NOME_BANCO[banco]}…`
                : `Gerar boleto no ${NOME_BANCO[banco]}`}
            </Button>
          ))}

        {podeEnviar && (
          <Button disabled={ocupado} onClick={enviarBoleto}>
            <Mail className="size-4" aria-hidden />
            {enviar.isPending
              ? 'Enviando…'
              : qtdExtras > 0
                ? 'Enviar nota e boletos'
                : 'Enviar nota e boleto'}
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

        {podeAnexarExtra && (
          <Button
            variante="secundario"
            disabled={ocupado}
            title="Outro boleto emitido por fora (outro prazo, parcela): vai junto no e-mail."
            onClick={() => entradaExtra.current?.click()}
          >
            <Plus className="size-4" aria-hidden />
            {anexarExtra.isPending ? 'Anexando…' : 'Anexar outro boleto'}
          </Button>
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
        <input
          ref={entradaExtra}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          aria-label="PDF de outro boleto"
          onChange={(e) => void aoEscolherExtra(e.target.files?.[0])}
        />
      </div>
    </Card>
  )
}
