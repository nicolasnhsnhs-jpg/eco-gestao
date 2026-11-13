import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import type { Json } from '@/lib/database.types'
import { mensagemDeErro } from '@/lib/erros'

import { useSalvarEscopo, type AlvoEscopo } from './pragasApi'

/** Escopo da OS simples de insetos ou roedores (guardado no escopo da OS e do modelo). */
export type EscopoAreas = { areas_atendidas?: string; todas_areas?: boolean }
export type ChecklistAreas = { conforme_planejado?: boolean }

export const TODAS_AREAS = 'Todas as dependências do cliente'

/** "Todas as dependências do cliente" ou as áreas escritas pelo escritório. */
export function areasAtendidas(escopo: unknown) {
  const e = (escopo ?? {}) as EscopoAreas
  return e.todas_areas ? TODAS_AREAS : (e.areas_atendidas ?? '').trim()
}

/** Escritório: as áreas atendidas no controle só de insetos ou só de roedores. */
export function EscopoAreasAtendidas({ alvo }: { alvo: AlvoEscopo }) {
  const escopo = (alvo.escopo ?? {}) as EscopoAreas
  const salvar = useSalvarEscopo(alvo.osId, alvo.modeloId)
  const [areas, setAreas] = useState(escopo.areas_atendidas ?? '')
  const [todas, setTodas] = useState(escopo.todas_areas ?? false)
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">Áreas atendidas</h2>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input
          type="checkbox"
          className="size-5 accent-verde"
          checked={todas}
          onChange={(e) => setTodas(e.target.checked)}
        />
        {TODAS_AREAS}
      </label>
      {!todas && (
        <Campo
          rotulo="Áreas"
          htmlFor="esc-areas-atendidas"
          dica='Ex.: "Cozinha, depósito e área externa".'
        >
          <Textarea
            id="esc-areas-atendidas"
            rows={3}
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
          />
        </Campo>
      )}
      <Button
        variante="secundario"
        disabled={salvar.isPending}
        onClick={() => {
          setAviso(null)
          salvar
            .mutateAsync({ ...escopo, areas_atendidas: areas.trim(), todas_areas: todas } as Json)
            .then(() => setAviso({ tipo: 'sucesso', texto: 'Áreas salvas neste local.' }))
            .catch((e: unknown) => setAviso({ tipo: 'erro', texto: mensagemDeErro(e) }))
        }}
      >
        Salvar áreas
      </Button>
    </Card>
  )
}
