import { Ban, Replace, RotateCcw } from 'lucide-react'
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
  useNotaFiscal,
  useSubstituirNota,
  type MotivoCancelamento,
  type MotivoSubstituicao,
  type NotaFiscalCompleta,
} from './notasApi'

const MOTIVOS: Record<MotivoCancelamento, string> = {
  '1': 'Erro na emissão',
  '2': 'Serviço não prestado',
  '9': 'Outros',
}

/** cMotivo da substituição, em palavras simples. */
const MOTIVOS_SUBSTITUICAO: Record<MotivoSubstituicao, string> = {
  '99': 'Outros (erro nos dados, valor, impostos…)',
  '05': 'O cliente recusou a nota',
  '01': 'A empresa saiu do Simples Nacional',
  '02': 'A empresa entrou no Simples Nacional',
  '03': 'Imunidade ou isenção reconhecida depois',
  '04': 'Imunidade ou isenção retirada depois',
}

/**
 * NFS-e emitida não se edita: cancela-se no Sistema Nacional e emite-se outra, ou
 * substitui-se (a nova vai com a chave da antiga, que fica substituída no portal). Aqui o
 * financeiro cancela ou abre a cópia em rascunho para substituir; na cancelada, abre a
 * cópia para corrigir e emitir.
 */
export function CancelamentoNota({ nota }: { nota: NotaFiscalCompleta }) {
  const ambiente = useAmbienteNfse()
  const cancelar = useCancelarNota()
  const corrigir = useCorrigirNota()
  const substituir = useSubstituirNota()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [substituindo, setSubstituindo] = useState(false)
  const [motivoSubst, setMotivoSubst] = useState<MotivoSubstituicao>('99')
  const [justificativaSubst, setJustificativaSubst] = useState('')
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

  async function abrirSubstituicao() {
    setErro(null)
    try {
      const id = await substituir.mutateAsync({
        nota,
        motivo: motivoSubst,
        justificativa: justificativaSubst,
      })
      setSubstituindo(false)
      navegar(`/financeiro/notas/${id}`)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const substituida = nota.motivo_cancelamento?.startsWith('Substituída') ?? false

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
        {nota.status === 'cancelada'
          ? substituida
            ? 'Nota substituída'
            : 'Nota cancelada'
          : 'Cancelar ou substituir a nota'}
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
          {substituida
            ? 'No Sistema Nacional ela aparece como substituída.'
            : 'Para corrigir, abra uma cópia em rascunho, acerte o que estava errado e emita de novo.'}
        </p>
      ) : (
        <p className="text-sm text-texto-suave">
          A nota emitida não pode ser editada. Se algo saiu errado, substitua: o sistema abre uma
          cópia para você acertar e, ao emitir, a nova fica no lugar da antiga no Sistema Nacional.
          Se o serviço não vai ser cobrado, cancele.
        </p>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        {podeCancelar && (
          <Button onClick={() => setSubstituindo(true)}>
            <Replace className="size-4" aria-hidden /> Substituir NFS-e
          </Button>
        )}
        {podeCancelar && (
          <Button variante="secundario" onClick={() => setAberto(true)}>
            <Ban className="size-4" aria-hidden /> Cancelar NFS-e
          </Button>
        )}
        {nota.status === 'cancelada' && (
          <Button disabled={corrigir.isPending} onClick={() => void abrirCorrecao()}>
            <RotateCcw className="size-4" aria-hidden />
            {corrigir.isPending
              ? 'Abrindo…'
              : substituida
                ? 'Ver a nota que a substitui'
                : 'Corrigir e emitir de novo'}
          </Button>
        )}
      </div>

      <Modal
        aberto={substituindo}
        aoFechar={() => setSubstituindo(false)}
        titulo="Substituir NFS-e"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Vamos abrir uma cópia da NF {nota.numero ?? '—'} de{' '}
            {nota.cliente?.nome_fantasia || nota.cliente?.nome} em rascunho. Acerte o que estava
            errado e emita: a nova fica no lugar da antiga no Sistema Nacional, e a antiga aparece
            como substituída. Nada muda até você emitir.
          </p>
          <Aviso tipo="info">
            Na substituição não dá para mudar a data de competência, o código de tributação nem o
            município da prestação. Se um deles estiver errado, cancele e emita outra.
          </Aviso>
          <Campo rotulo="Motivo" htmlFor="motivo-subst">
            <Select
              id="motivo-subst"
              value={motivoSubst}
              onChange={(e) => setMotivoSubst(e.target.value as MotivoSubstituicao)}
            >
              {Object.entries(MOTIVOS_SUBSTITUICAO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo
            rotulo="Explique o motivo"
            htmlFor="justificativa-subst"
            obrigatorio
            dica={`Vai para o governo. Mínimo 15 letras (${justificativaSubst.trim().length}/255).`}
          >
            <Textarea
              id="justificativa-subst"
              maxLength={255}
              placeholder="Ex.: PIS e COFINS retidos não descontados do valor"
              value={justificativaSubst}
              onChange={(e) => setJustificativaSubst(e.target.value)}
            />
          </Campo>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={() => setSubstituindo(false)}>
              Voltar
            </Button>
            <Button
              disabled={substituir.isPending || justificativaSubst.trim().length < 15}
              onClick={() => void abrirSubstituicao()}
            >
              <Replace className="size-4" aria-hidden />
              {substituir.isPending ? 'Abrindo…' : 'Abrir a cópia para substituir'}
            </Button>
          </div>
        </div>
      </Modal>

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

/** No rascunho que substitui outra nota: emitir este coloca a nova no lugar da antiga. */
export function AvisoSubstituicao({ nota }: { nota: NotaFiscalCompleta }) {
  const antiga = useNotaFiscal(nota.substitui_nota_id ?? undefined).data
  if (nota.status !== 'rascunho' || !nota.motivo_substituicao || !nota.substitui_nota_id)
    return null
  return (
    <Aviso tipo="info">
      Este rascunho substitui a NF {antiga?.numero ?? '…'}. Ao emitir, a nova fica no lugar da
      antiga no Sistema Nacional (ela aparece como substituída) e aqui a antiga fica cancelada.
      Motivo: {MOTIVOS_SUBSTITUICAO[nota.motivo_substituicao as MotivoSubstituicao] ?? 'Outros'}
      {nota.justificativa_substituicao ? ` · ${nota.justificativa_substituicao}` : ''}.
    </Aviso>
  )
}
