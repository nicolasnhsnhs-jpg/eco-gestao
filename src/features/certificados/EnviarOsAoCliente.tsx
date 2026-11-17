import { useQueryClient } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Modal } from '@/components/ui/Modal'
import { formatarData } from '@/lib/datas'
import { juntarEmails } from '@/lib/emails'
import { mensagemDeErro } from '@/lib/erros'

import { useEmailsDocumentos, useOsDoCliente } from './api'

/**
 * Botão "Enviar ao cliente" da OS: manda o PDF da OS (e outras OS marcadas do mesmo
 * cliente) por e-mail, sem certificado, pelo e-mail do ADM. Para os serviços que não
 * emitem certificado; quando há certificado, o envio é pela tela dele.
 */
export function EnviarOsAoCliente({
  os,
}: {
  os: { id: string; numero: string; cliente_id: string }
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button variante="secundario" onClick={() => setAberto(true)}>
        <Mail className="size-5" aria-hidden /> Enviar ao cliente
      </Button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Enviar OS ao cliente">
        <Formulario os={os} aoTerminar={() => setAberto(false)} />
      </Modal>
    </>
  )
}

function Formulario({
  os,
  aoTerminar,
}: {
  os: { id: string; numero: string; cliente_id: string }
  aoTerminar: () => void
}) {
  const queryClient = useQueryClient()
  const emails = useEmailsDocumentos(os.cliente_id)
  const ordens = useOsDoCliente(os.cliente_id)
  const [para, setPara] = useState<string | null>(null)
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set([os.id]))
  const [etapa, setEtapa] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  if (emails.isPending || ordens.isPending) return <Carregando />
  if (emails.isError) return <Aviso tipo="erro">{mensagemDeErro(emails.error)}</Aviso>

  const destinatarios = para ?? juntarEmails(emails.data.emails)
  // Esta OS primeiro.
  const lista: {
    id: string
    numero: string
    data_agendada: string
    tipo: { nome: string } | null
  }[] = [...(ordens.data ?? [])]
  const atual = lista.findIndex((o) => o.id === os.id)
  if (atual > 0) lista.unshift(...lista.splice(atual, 1))
  if (atual < 0) lista.unshift({ id: os.id, numero: os.numero, data_agendada: '', tipo: null })

  function alternar(id: string) {
    setMarcadas((agora) => {
      const nova = new Set(agora)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
      return nova
    })
  }

  const ids = lista.map((o) => o.id).filter((id) => marcadas.has(id))

  async function enviar() {
    setMensagem(null)
    try {
      const { enviarSoOs } = await import('./pdf/enviarDocumentos')
      const r = await enviarSoOs(queryClient, ids, destinatarios, setEtapa)
      setMensagem({
        tipo: 'sucesso',
        texto: `Enviado para ${juntarEmails(r.para)}, com ${r.os.join(', ')}.`,
      })
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: mensagemDeErro(e) })
    } finally {
      setEtapa(null)
    }
  }

  const enviando = etapa !== null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="font-bold">O que vai no e-mail</p>
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
                {o.id === os.id && ' · esta OS'}
              </span>
            </span>
          </label>
        ))}
        <p className="text-sm text-texto-suave">
          Vai sem certificado. Se o serviço tem certificado, envie pela tela do certificado.
        </p>
      </div>

      <Campo
        rotulo="Para"
        htmlFor="para-os"
        dica={
          emails.data.financeiroSeparado
            ? 'Este cliente separou o e-mail do financeiro: ele não recebe a OS. Separe vários com ;'
            : 'Vazio usa o do cadastro. Separe vários com ;'
        }
      >
        <Input
          id="para-os"
          type="text"
          inputMode="email"
          autoComplete="off"
          value={destinatarios}
          disabled={enviando}
          onChange={(e) => setPara(e.target.value)}
        />
      </Campo>

      <p className="text-sm text-texto-suave">O ADM recebe uma cópia oculta do e-mail.</p>

      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

      <div className="flex flex-wrap gap-2">
        {mensagem?.tipo === 'sucesso' ? (
          <Button onClick={aoTerminar}>Fechar</Button>
        ) : (
          <Button disabled={enviando || ids.length === 0} onClick={() => void enviar()}>
            <Mail className="size-4" aria-hidden />
            {etapa ?? 'Enviar'}
          </Button>
        )}
      </div>
    </div>
  )
}
