import { useQuery } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Mail } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Modal } from '@/components/ui/Modal'
import { juntarEmails } from '@/lib/emails'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import { paraBase64, useEmailsDocumentos } from '../certificados/api'
import type { PropostaCompleta } from './api'

/** Começos prontos do e-mail (o primeiro é o padrão); o texto continua editável na janela. */
const MODELOS = {
  nova: {
    nome: 'Proposta nova',
    texto:
      'Conforme conversamos, estou encaminhando em anexo a nossa proposta para o serviço ' +
      'solicitado.\n\nAguardo seu retorno para seguirmos com o agendamento ou esclarecer dúvidas.',
  },
  vencimento: {
    nome: 'Certificado vencendo ou vencido',
    texto:
      'Verificamos que o certificado está próximo do vencimento ou já venceu. Por conta disso, ' +
      'estou encaminhando em anexo uma proposta atualizada para refazermos o serviço.\n\n' +
      'Aguardo seu retorno para seguirmos com o agendamento ou esclarecer dúvidas.',
  },
  livre: { nome: 'Escrever do zero', texto: '' },
} as const
type Modelo = keyof typeof MODELOS

/**
 * Botão "Enviar por e-mail" da proposta: manda o PDF ao cliente no e-mail bonito (igual ao
 * do certificado), saindo do e-mail do vendedor da proposta, com ele em cópia oculta.
 * Quem envia escolhe/edita o início do texto.
 */
export function EnviarPropostaPorEmail({
  p,
  gerarPdf,
  desativado,
}: {
  p: PropostaCompleta
  gerarPdf: () => Promise<Blob>
  desativado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button variante="secundario" disabled={desativado} onClick={() => setAberto(true)}>
        <Mail className="size-4" aria-hidden /> Enviar por e-mail
      </Button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Enviar proposta por e-mail">
        <Formulario p={p} gerarPdf={gerarPdf} aoTerminar={() => setAberto(false)} />
      </Modal>
    </>
  )
}

/** Nome e e-mail do vendedor da proposta (de onde o e-mail sai). */
function useRemetente(id: string | null | undefined) {
  return useQuery({
    queryKey: ['equipe', 'email', id],
    enabled: !!id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('perfis')
        .select('nome, email')
        .eq('id', id!)
        .maybeSingle()
      return data
    },
  })
}

function Formulario({
  p,
  gerarPdf,
  aoTerminar,
}: {
  p: PropostaCompleta
  gerarPdf: () => Promise<Blob>
  aoTerminar: () => void
}) {
  const emails = useEmailsDocumentos(p.cliente_id ?? undefined)
  const remetente = useRemetente(p.vendedor_id)
  const [modelo, setModelo] = useState<Modelo>('nova')
  const [mensagem, setMensagem] = useState<string>(MODELOS.nova.texto)
  const [para, setPara] = useState<string | null>(null)
  const [etapa, setEtapa] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(
    null,
  )

  if (emails.isPending || remetente.isPending) return <Carregando />

  const padrao = p.contato_email?.trim()
    ? p.contato_email.trim()
    : juntarEmails(emails.data?.emails ?? [])
  const destinatarios = para ?? padrao
  const nomeCliente = p.contato_nome?.trim() || p.cliente?.nome_fantasia || p.cliente?.nome || ''

  function trocarModelo(m: Modelo) {
    setModelo(m)
    setMensagem(MODELOS[m].texto)
  }

  async function enviar() {
    setResultado(null)
    try {
      setEtapa('Montando o PDF…')
      const pdf = paraBase64(new Uint8Array(await (await gerarPdf()).arrayBuffer()))
      setEtapa('Enviando o e-mail…')
      const { data, error } = await supabase.functions.invoke('propostas', {
        body: {
          acao: 'enviar',
          propostaId: p.id,
          para: destinatarios.trim() || undefined,
          mensagem,
          pdf,
        },
      })
      if (error) {
        const detalhe =
          error instanceof FunctionsHttpError
            ? ((await error.context.json().catch(() => null)) as { erro?: string } | null)
            : null
        throw new Error(detalhe?.erro ?? 'Não foi possível falar com o servidor de e-mail.')
      }
      const r = data as { para: string[]; de: string }
      setResultado({
        tipo: 'sucesso',
        texto: `Enviada para ${juntarEmails(r.para)}, saindo de ${r.de} (com cópia oculta para ele).`,
      })
    } catch (e) {
      setResultado({ tipo: 'erro', texto: mensagemDeErro(e) })
    } finally {
      setEtapa(null)
    }
  }

  const enviando = etapa !== null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Sai do e-mail de{' '}
        <strong>
          {remetente.data
            ? `${remetente.data.nome}${remetente.data.email ? ` (${remetente.data.email})` : ''}`
            : (p.vendedor?.nome ?? 'vendedor da proposta')}
        </strong>
        , o vendedor da proposta, que recebe uma cópia oculta. A proposta {p.numero} vai em PDF
        anexada.
      </p>

      <Campo rotulo="Início do e-mail" htmlFor="modelo-email">
        <Select
          id="modelo-email"
          value={modelo}
          disabled={enviando}
          onChange={(e) => trocarModelo(e.target.value as Modelo)}
        >
          {(Object.keys(MODELOS) as Modelo[]).map((m) => (
            <option key={m} value={m}>
              {MODELOS[m].nome}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo
        rotulo={`Texto (vem depois de “Olá${nomeCliente ? `, ${nomeCliente}` : ''}!”)`}
        htmlFor="texto-email"
        dica="Pode mudar à vontade. Deixe uma linha em branco para começar outro parágrafo. Abaixo vão os dados da proposta e a sua assinatura."
      >
        <Textarea
          id="texto-email"
          rows={6}
          value={mensagem}
          disabled={enviando}
          onChange={(e) => setMensagem(e.target.value)}
        />
      </Campo>

      <Campo
        rotulo="Para"
        htmlFor="para-proposta"
        dica={
          p.contato_email
            ? 'Veio do A/C da proposta. Separe vários com ;'
            : 'Veio do cadastro do cliente (nunca o e-mail do financeiro). Separe vários com ;'
        }
      >
        <Input
          id="para-proposta"
          type="text"
          inputMode="email"
          autoComplete="off"
          value={destinatarios}
          disabled={enviando}
          onChange={(e) => setPara(e.target.value)}
        />
      </Campo>

      {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}

      <div className="flex flex-wrap gap-2">
        {resultado?.tipo === 'sucesso' ? (
          <Button onClick={aoTerminar}>Fechar</Button>
        ) : (
          <Button
            disabled={enviando || mensagem.trim().length < 5 || !destinatarios.trim()}
            onClick={() => void enviar()}
          >
            <Mail className="size-4" aria-hidden />
            {etapa ?? 'Enviar'}
          </Button>
        )}
      </div>
    </div>
  )
}
