import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Campo'

export type ItemOcorrencia = {
  id?: string
  texto: string
  /** Veio de visita anterior (ainda não sanada). */
  anterior?: boolean
}

/**
 * Lista de ocorrências que o escritório põe na OS, com o "+" para mais de uma.
 * O técnico responde cada uma no celular: sanado ou reforço na próxima visita.
 */
export function CampoOcorrencias({
  itens,
  aoMudar,
  prefixoId,
}: {
  itens: ItemOcorrencia[]
  aoMudar: (itens: ItemOcorrencia[]) => void
  prefixoId: string
}) {
  const mudar = (i: number, texto: string) =>
    aoMudar(itens.map((it, j) => (j === i ? { ...it, texto } : it)))
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Ocorrências (o técnico responde cada uma)</legend>
      <p className="text-sm text-texto-suave">
        Só quando houver. Ex.: &quot;Ocorrência com roedores no setor de expedição&quot;. O técnico
        marca <strong>sanado</strong> (some das próximas OS) ou <strong>necessita reforço</strong>{' '}
        (continua nas próximas OS deste serviço até ser sanada).
      </p>
      {itens.map((it, i) => (
        <div key={it.id ?? `nova-${i}`} className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`${prefixoId}-${i}`} className="text-sm font-semibold">
              Ocorrência {i + 1}
              {it.anterior && (
                <span className="ml-2 font-normal text-alerta">· em aberto de visita anterior</span>
              )}
            </label>
            <Textarea
              id={`${prefixoId}-${i}`}
              rows={2}
              value={it.texto}
              onChange={(e) => mudar(i, e.target.value)}
            />
          </div>
          <button
            type="button"
            className="mt-7 flex size-11 shrink-0 items-center justify-center rounded-xl border border-borda text-perigo hover:bg-red-50"
            title={it.anterior ? 'Tirar (dá a ocorrência como sanada)' : 'Tirar esta ocorrência'}
            aria-label={`Tirar a ocorrência ${i + 1}`}
            onClick={() => aoMudar(itens.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </div>
      ))}
      <Button
        variante="secundario"
        className="self-start"
        onClick={() => aoMudar([...itens, { texto: '' }])}
      >
        <Plus className="size-5" aria-hidden /> Adicionar ocorrência
      </Button>
    </fieldset>
  )
}
