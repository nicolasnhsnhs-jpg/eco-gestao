import { Check } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { mensagemDeErro } from '@/lib/erros'

import { horaCurta, useResponderProposta, type PropostaCompleta } from './api'

/**
 * Aprovar a proposta (ou mudar a data depois): o dia e o horário de execução são
 * opcionais — o vendedor preenche se já combinou com o cliente.
 */
export function JanelaExecucao({
  p,
  modo,
  aoFechar,
}: {
  p: PropostaCompleta
  modo: 'aprovar' | 'alterar' | null
  aoFechar: () => void
}) {
  const responder = useResponderProposta(p.id!)
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<typeof modo>(null)

  // Ao abrir, começa com o que já está gravado.
  if (modo !== aberta) {
    setAberta(modo)
    setData(p.execucao_data ?? '')
    setHora(horaCurta(p.execucao_hora))
    setErro(null)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      await responder.mutateAsync({
        ...(modo === 'aprovar' ? { status: 'aprovada' as const, motivo_recusa: null } : {}),
        execucao_data: data || null,
        execucao_hora: data && hora ? hora : null,
      })
      aoFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <Modal
      aberto={modo !== null}
      aoFechar={aoFechar}
      titulo={modo === 'aprovar' ? `Aprovar proposta ${p.numero}` : 'Data de execução'}
    >
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">
          Já está combinado quando o serviço vai ser feito? Preencha para o ADM ver a proposta na
          consulta por dia e emitir a OS. Se ainda não sabe, deixe em branco e preencha depois.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia da execução" htmlFor="execucao-data">
            <Input
              id="execucao-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              data-autofocus
            />
          </Campo>
          <Campo rotulo="Horário" htmlFor="execucao-hora" dica={data ? 'Opcional' : undefined}>
            <Input
              id="execucao-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              disabled={!data}
            />
          </Campo>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="flex flex-wrap justify-end gap-2">
          {modo === 'alterar' && p.execucao_data && (
            <Button
              type="button"
              variante="fantasma"
              onClick={() => {
                setData('')
                setHora('')
              }}
            >
              Limpar
            </Button>
          )}
          <Button type="submit" disabled={responder.isPending}>
            <Check className="size-4" aria-hidden />
            {responder.isPending
              ? 'Salvando…'
              : modo === 'aprovar'
                ? data
                  ? 'Aprovar com esta data'
                  : 'Aprovar sem data'
                : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
