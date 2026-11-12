import { useQueryClient } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Modal } from '@/components/ui/Modal'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { useEmailsDocumentos, useOsDoCliente, type CertificadoResumo } from './api'

const horario = (iso: string) =>
  `${formatarData(iso)} às ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

/**
 * Botão "Enviar ao cliente": manda o certificado e as OS marcadas num e-mail só, pelo
 * e-mail do ADM. Os destinatários vêm do cadastro (sem os e-mails do financeiro) e dá
 * para trocar antes de enviar.
 */
export function EnviarAoCliente({
  certificado,
  bloqueado,
}: {
  certificado: CertificadoResumo
  /** Com alterações não salvas, o PDF sairia diferente do que está gravado. */
  bloqueado?: string | null
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button variante="secundario" onClick={() => setAberto(true)}>
        <Mail className="size-5" aria-hidden /> Enviar ao cliente
      </Button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Enviar ao cliente">
        {bloqueado ? (
          <Aviso>{bloqueado}</Aviso>
        ) : (
          <Formulario certificado={certificado} aoTerminar={() => setAberto(false)} />
        )}
      </Modal>
    </>
  )
}

function Formulario({
  certificado: c,
  aoTerminar,
}: {
  certificado: CertificadoResumo
  aoTerminar: () => void
}) {
  const queryClient = useQueryClient()
  const emails = useEmailsDocumentos(c.cliente_id)
  const ordens = useOsDoCliente(c.cliente_id)
  const [para, setPara] = useState<string | null>(null)
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(c.os_id ? [c.os_id] : []))
  const [etapa, setEtapa] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  if (emails.isPending || ordens.isPending) return <Carregando />
  if (emails.isError) return <Aviso tipo="erro">{mensagemDeErro(emails.error)}</Aviso>

  const destinatarios = para ?? emails.data.emails.join(', ')
  // A OS do certificado sempre aparece, mesmo que ainda não esteja concluída.
  const lista: {
    id: string
    numero: string
    data_agendada: string
    tipo: { nome: string } | null
  }[] = [...(ordens.data ?? [])]
  if (c.os && !lista.some((o) => o.id === c.os!.id))
    lista.unshift({ id: c.os.id, numero: c.os.numero, data_agendada: '', tipo: null })

  function alternar(id: string) {
    setMarcadas((atual) => {
      const nova = new Set(atual)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
      return nova
    })
  }

  async function enviar() {
    setMensagem(null)
    try {
      const { enviarCertificadoEOs } = await import('./pdf/enviarDocumentos')
      // Na ordem da lista (a OS do certificado primeiro).
      const ids = lista.map((o) => o.id).filter((id) => marcadas.has(id))
      const r = await enviarCertificadoEOs(queryClient, c, ids, destinatarios, setEtapa)
      await queryClient.invalidateQueries({ queryKey: ['certificados'] })
      setMensagem({
        tipo: 'sucesso',
        texto: `Enviado para ${r.para.join(', ')}${r.os.length ? `, com ${r.os.join(', ')}` : ''}.`,
      })
    } catch (e) {
      void queryClient.invalidateQueries({ queryKey: ['certificados'] })
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(e) })
    } finally {
      setEtapa(null)
    }
  }

  const enviando = etapa !== null

  return (
    <div className="flex flex-col gap-4">
      {c.enviado_em ? (
        <p className="text-sm">
          Já enviado em <strong>{horario(c.enviado_em)}</strong>
          {c.enviado_para && <> · {c.enviado_para}</>}
          {c.enviado_com_os && <> · com {c.enviado_com_os}</>}
        </p>
      ) : c.erro_envio ? (
        <Aviso tipo="erro">Último envio falhou: {c.erro_envio}</Aviso>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="font-bold">O que vai no e-mail</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-verde" checked disabled />
          Certificado {c.numero}
        </label>
        {lista.length === 0 && (
          <p className="text-sm text-texto-suave">Nenhuma OS concluída deste cliente.</p>
        )}
        {lista.map((o) => (
          <label key={o.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-verde"
              checked={marcadas.has(o.id)}
              disabled={enviando}
              onChange={() => alternar(o.id)}
            />
            <span>
              {o.numero}
              <span className="text-sm text-texto-suave">
                {[o.tipo?.nome, o.data_agendada && formatarData(o.data_agendada)]
                  .filter(Boolean)
                  .map((t) => ` · ${t}`)
                  .join('')}
                {o.id === c.os_id && ' · deste certificado'}
              </span>
            </span>
          </label>
        ))}
      </div>

      <Campo
        rotulo="Para"
        htmlFor="para-documentos"
        dica={
          emails.data.financeiroSeparado
            ? 'Este cliente separou o e-mail do financeiro: ele não recebe o certificado. Separe vários com ;'
            : 'Vazio usa o do cadastro. Separe vários com ;'
        }
      >
        <Input
          id="para-documentos"
          type="email"
          multiple
          value={destinatarios}
          disabled={enviando}
          onChange={(e) => setPara(e.target.value)}
        />
      </Campo>

      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <div className="flex flex-wrap gap-2">
        {mensagem?.tipo === 'sucesso' ? (
          <Button onClick={aoTerminar}>Fechar</Button>
        ) : (
          <Button disabled={enviando} onClick={() => void enviar()}>
            <Mail className="size-4" aria-hidden />
            {etapa ?? (c.enviado_em ? 'Enviar de novo' : 'Enviar')}
          </Button>
        )}
      </div>
    </div>
  )
}
