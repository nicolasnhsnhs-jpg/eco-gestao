import { Camera, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Campo'
import { mensagemDeErro } from '@/lib/erros'

import { enviarFotoOcorrencia, FotoOcorrencia } from './FotoOcorrencia'

export type ItemOcorrencia = {
  id?: string
  texto: string
  /** Caminho da foto no Storage (null: sem foto). */
  foto?: string | null
  /** Veio de visita anterior (ainda não sanada). */
  anterior?: boolean
}

/** O que vai para salvar_ocorrencias_os / salvar_ocorrencias_local. */
export function itensParaSalvar(itens: ItemOcorrencia[]) {
  return itens
    .filter((o) => o.texto.trim())
    .map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      texto: o.texto.trim(),
      foto: o.foto ?? null,
    }))
}

/**
 * Lista de ocorrências que o escritório põe na OS, com o "+" para mais de uma.
 * Cada uma pode ter uma foto, que o técnico vê na OS do celular.
 * O técnico responde cada uma no celular: sanado ou reforço na próxima visita.
 */
export function CampoOcorrencias({
  itens,
  aoMudar,
  prefixoId,
  clienteId,
}: {
  itens: ItemOcorrencia[]
  aoMudar: (itens: ItemOcorrencia[]) => void
  prefixoId: string
  clienteId: string
}) {
  const [enviando, setEnviando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (i: number, mudanca: Partial<ItemOcorrencia>) =>
    aoMudar(itens.map((it, j) => (j === i ? { ...it, ...mudanca } : it)))

  async function anexar(i: number, arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setEnviando(i)
    try {
      mudar(i, { foto: await enviarFotoOcorrencia(clienteId, arquivo) })
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(null)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Ocorrências (o técnico responde cada uma)</legend>
      <p className="text-sm text-texto-suave">
        Só quando houver. Ex.: &quot;Ocorrência com roedores no setor de expedição&quot;. Dá para
        anexar uma foto (o técnico vê no celular). O técnico marca <strong>sanado</strong> (some das
        próximas OS) ou <strong>necessita reforço</strong> (continua nas próximas OS deste serviço
        até ser sanada).
      </p>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {itens.map((it, i) => (
        <div key={it.id ?? `nova-${i}`} className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
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
              onChange={(e) => mudar(i, { texto: e.target.value })}
            />
            {it.foto && <FotoOcorrencia caminho={it.foto} />}
            <div className="flex flex-wrap gap-2">
              <label
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-borda px-3 text-sm font-semibold hover:bg-black/5 ${enviando === i ? 'pointer-events-none opacity-60' : ''}`}
              >
                <Camera className="size-5" aria-hidden />
                {enviando === i ? 'Enviando foto…' : it.foto ? 'Trocar foto' : 'Anexar foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={enviando !== null}
                  onChange={(e) => {
                    void anexar(i, e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
              {it.foto && (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda px-3 text-sm font-semibold text-perigo hover:bg-red-50"
                  onClick={() => mudar(i, { foto: null })}
                >
                  <X className="size-5" aria-hidden /> Tirar foto
                </button>
              )}
            </div>
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
        disabled={enviando !== null}
        onClick={() => aoMudar([...itens, { texto: '' }])}
      >
        <Plus className="size-5" aria-hidden /> Adicionar ocorrência
      </Button>
    </fieldset>
  )
}
