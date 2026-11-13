import { FileText, Mail, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { formatarData } from '@/lib/datas'
import { juntarEmails } from '@/lib/emails'
import { mensagemDeErro } from '@/lib/erros'

import { abrirArquivo } from '../arquivos/api'
import { oQueFoiEnviado } from './notas'
import {
  useAnexarPdfNota,
  useEnviarNotaPorEmail,
  useMarcarNotaEnviada,
  type NotaFiscalCompleta,
} from './notasApi'

const horario = (iso: string) =>
  `${formatarData(iso)} às ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

/**
 * PDF da nota emitida e envio ao cliente. Ao anexar o PDF, o sistema já manda por
 * e-mail; sem e-mail cadastrado, fica o aviso de envio pendente para o financeiro.
 */
export function EnvioNota({ nota }: { nota: NotaFiscalCompleta }) {
  const anexar = useAnexarPdfNota()
  const enviar = useEnviarNotaPorEmail()
  const marcar = useMarcarNotaEnviada()
  const entrada = useRef<HTMLInputElement>(null)
  // Cliente que separou os e-mails do financeiro: a nota vai só para eles.
  const [para, setPara] = useState(
    juntarEmails(
      nota.cliente?.emails_financeiro?.length
        ? nota.cliente.emails_financeiro
        : [nota.cliente?.email, ...(nota.cliente?.emails_extras ?? [])],
    ),
  )
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const ocupado = anexar.isPending || enviar.isPending || marcar.isPending

  async function mandar() {
    setMensagem(null)
    try {
      const r = await enviar.mutateAsync({ notaId: nota.id, para: para.trim() || undefined })
      setMensagem(
        r.enviada
          ? {
              tipo: 'sucesso',
              texto: `${oQueFoiEnviado(r.comBoleto, r.boletos)} para ${juntarEmails(r.para)}.`,
            }
          : { tipo: 'erro', texto: `${r.motivo} Ficou o aviso de envio pendente.` },
      )
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) })
    }
  }

  async function aoEscolherPdf(arquivo: File | undefined) {
    if (!arquivo) return
    setMensagem(null)
    try {
      await anexar.mutateAsync({ nota, arquivo })
      await mandar()
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(erro) })
    } finally {
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-bold">PDF e envio ao cliente</h2>
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      {nota.enviada_em ? (
        <p className="text-sm">
          Enviada em <strong>{horario(nota.enviada_em)}</strong>
          {nota.enviada_para && <> · {nota.enviada_para}</>}
        </p>
      ) : nota.erro_envio ? (
        <Aviso tipo="erro">Envio pendente: {nota.erro_envio}</Aviso>
      ) : !nota.pdf ? (
        <p className="text-sm text-texto-suave">
          Anexe o PDF da nota emitida: o sistema manda para o e-mail do cliente na hora.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {nota.pdf && (
          <Button
            variante="secundario"
            onClick={() =>
              abrirArquivo(nota.pdf!).catch((e: unknown) =>
                setMensagem({ tipo: 'erro', texto: mensagemDeErro(e) }),
              )
            }
          >
            <FileText className="size-4" aria-hidden /> Ver PDF
          </Button>
        )}
        <Button variante="secundario" disabled={ocupado} onClick={() => entrada.current?.click()}>
          <Upload className="size-4" aria-hidden />
          {anexar.isPending ? 'Anexando…' : nota.pdf ? 'Trocar PDF' : 'Anexar PDF e enviar'}
        </Button>
        <input
          ref={entrada}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          aria-label="PDF da nota fiscal"
          onChange={(e) => void aoEscolherPdf(e.target.files?.[0])}
        />
      </div>

      {nota.pdf && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Campo
            rotulo="E-mail do cliente"
            htmlFor="email-nota"
            dica="Vazio usa o do cadastro (ou do contato principal). Separe vários com ;"
          >
            <Input
              id="email-nota"
              type="text"
              inputMode="email"
              autoComplete="off"
              value={para}
              onChange={(e) => setPara(e.target.value)}
            />
          </Campo>
          <div className="flex flex-wrap gap-2">
            <Button disabled={ocupado} onClick={() => void mandar()}>
              <Mail className="size-4" aria-hidden />
              {enviar.isPending ? 'Enviando…' : nota.enviada_em ? 'Enviar de novo' : 'Enviar'}
            </Button>
            {!nota.enviada_em && (
              <Button
                variante="secundario"
                disabled={ocupado}
                onClick={() =>
                  marcar
                    .mutateAsync({ notaId: nota.id, como: 'enviada à mão pelo financeiro' })
                    .then(() => setMensagem(null))
                    .catch((e: unknown) => setMensagem({ tipo: 'erro', texto: mensagemDeErro(e) }))
                }
              >
                Já enviei à mão
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
