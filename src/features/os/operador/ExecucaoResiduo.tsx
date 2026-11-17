import { useState } from 'react'

import { Campo, Input } from '@/components/ui/Campo'

import type { CamposExecucao } from '../api'
import { RESIDUOS, residuoDoChecklist, type CodigoResiduo, type Residuo } from '../tipos/residuo'

/** "4,5" ou "4.5" → 4.5; vazio ou inválido → null. */
function lerM3(texto: string) {
  const limpo = texto.replace(',', '.').trim()
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null
  return Number(limpo)
}

/**
 * OS de sucção: quanto foi sugado (m³) e qual resíduo (os quatro códigos).
 * Os dois são obrigatórios para concluir; ficam em checklist.residuo.
 */
export function ExecucaoResiduo({
  campos,
  alterar,
  aberta,
}: {
  campos: CamposExecucao
  alterar: (parcial: Partial<CamposExecucao>) => void
  aberta: boolean
}) {
  const residuo = residuoDoChecklist(campos.checklist)
  // O texto fica na tela enquanto digita ("4," ainda não é número).
  const [texto, setTexto] = useState(
    residuo.quantidade_m3 != null ? String(residuo.quantidade_m3).replace('.', ',') : '',
  )

  function mudar(parcial: Residuo) {
    alterar({
      checklist: {
        ...((campos.checklist ?? {}) as object),
        residuo: { ...residuo, ...parcial },
      },
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-alerta/40 bg-alerta/10 p-3">
      <Campo
        rotulo="Quantidade sugada (m³)"
        htmlFor="ex-residuo-qtd"
        obrigatorio
        dica="Ex.: 4,5. Use vírgula para a parte quebrada."
      >
        <Input
          id="ex-residuo-qtd"
          inputMode="decimal"
          disabled={!aberta}
          value={texto}
          onChange={(e) => {
            const valor = e.target.value.replace(/[^\d.,]/g, '')
            setTexto(valor)
            mudar({ quantidade_m3: lerM3(valor) })
          }}
        />
      </Campo>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">
          O que foi sugado <span className="text-perigo">*</span>
        </legend>
        {RESIDUOS.map((r) => {
          const marcado = residuo.codigo === r.codigo
          return (
            <button
              key={r.codigo}
              type="button"
              disabled={!aberta}
              aria-pressed={marcado}
              onClick={() => mudar({ codigo: r.codigo as CodigoResiduo })}
              className={
                marcado
                  ? 'flex min-h-12 items-center gap-3 rounded-xl border-2 border-verde bg-verde px-4 text-left font-bold text-white'
                  : 'flex min-h-12 items-center gap-3 rounded-xl border-2 border-borda bg-white px-4 text-left font-bold'
              }
            >
              <span className="font-mono">{r.codigo}</span>
              <span>{r.nome}</span>
            </button>
          )
        })}
      </fieldset>
    </div>
  )
}
