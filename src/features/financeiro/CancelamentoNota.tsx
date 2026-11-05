import { Ban, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { formatarDataHora } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import {
  useAmbienteNfse,
  useCancelarNota,
  useCorrigirNota,
  type MotivoCancelamento,
  type NotaFiscalCompleta,
} from './notasApi'

const MOTIVOS: Record<MotivoCancelamento, string> = {
  '1': 'Erro na emissão',
  '2': 'Serviço não prestado',
  '9': 'Outros',
}

/**
 * NFS-e emitida não se edita: cancela-se no Sistema Nacional e emite-se outra. Aqui o
 * financeiro cancela e, na cancelada, abre a cópia em rascunho para corrigir e emitir.
 */
export function CancelamentoNota({ nota }: { nota: NotaFiscalCompleta }) {
  const ambiente = useAmbienteNfse()
  const cancelar = useCancelarNota()
  const corrigir = useCorrigirNota()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState<MotivoCancelamento>('1')
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const podeCancelar =
    nota.status === 'emitida' && !!nota.chave_acesso && ambiente.data === 'producao'
  if (nota.status !== 'cancelada' && !podeCancelar) return null

  async function confirmar() {
    setErro(null)
    try {
      await cancelar.mutateAsync({ notaId: nota.id, motivo, justificativa })
      setAberto(false)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function abrirCorrecao() {
    setErro(null)
    try {
      navegar(`/financeiro/notas/${await corrigir.mutateAsync(nota)}`)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-bold">
        {nota.status === 'cancelada' ? 'Nota cancelada' : 'Cancelar a nota'}
      </h2>
      {nota.status === 'cancelada' ? (
        <p className="text-sm">
          {nota.cancelada_em ? (
            <>
              Cancelada no Sistema Nacional em{' '}
              <strong>{formatarDataHora(nota.cancelada_em)}</strong>
              {nota.motivo_cancelamento && <> · {nota.motivo_cancelamento}</>}.
            </>
          ) : (
            'Esta nota está marcada como cancelada.'
          )}{' '}
          Para corrigir, abra uma cópia em rascunho, acerte o que estava errado e emita de novo.
        </p>
      ) : (
        <p className="text-sm text-texto-suave">
          A nota emitida não pode ser editada. Se algo saiu errado, cancele no Sistema Nacional e
          emita outra com os dados certos (o cliente deve ser avisado do cancelamento).
        </p>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        {podeCancelar && (
          <Button variante="secundario" onClick={() => setAberto(true)}>
            <Ban className="size-4" aria-hidden /> Cancelar NFS-e
          </Button>
        )}
        {nota.status === 'cancelada' && (
          <Button disabled={corrigir.isPending} onClick={() => void abrirCorrecao()}>
            <RotateCcw className="size-4" aria-hidden />
            {corrigir.isPending ? 'Abrindo…' : 'Corrigir e emitir de novo'}
          </Button>
        )}
      </div>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo="Cancelar NFS-e">
        <div className="flex flex-col gap-4">
          <Aviso tipo="erro">
            O cancelamento vale no governo na hora e não pode ser desfeito. NF {nota.numero ?? '—'}{' '}
            de {nota.cliente?.nome_fantasia || nota.cliente?.nome}.
          </Aviso>
          <Campo rotulo="Motivo" htmlFor="motivo-canc">
            <Select
              id="motivo-canc"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoCancelamento)}
            >
              {Object.entries(MOTIVOS).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo
            rotulo="Explique o motivo"
            htmlFor="justificativa-canc"
            obrigatorio
            dica={`Vai para o governo. Mínimo 15 letras (${justificativa.trim().length}/255).`}
          >
            <Textarea
              id="justificativa-canc"
              maxLength={255}
              placeholder="Ex.: valor líquido errado, PIS e COFINS retidos não descontados"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </Campo>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button
              disabled={cancelar.isPending || justificativa.trim().length < 15}
              onClick={() => void confirmar()}
            >
              <Ban className="size-4" aria-hidden />
              {cancelar.isPending ? 'Cancelando…' : 'Cancelar no Sistema Nacional'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
