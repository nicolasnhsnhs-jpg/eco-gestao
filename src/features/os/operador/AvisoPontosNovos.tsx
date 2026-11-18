import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'

import type { PontoOs } from '../pragasApi'

/*
 * O escritório incluiu pontos com a OS já em execução (ex.: uma armadilha luminosa
 * nova enquanto o técnico está no cliente). Quando o celular atualiza, o técnico vê
 * o aviso no alto da OS até tocar em "Entendi". O "Entendi" fica no celular.
 */

const NOME_TIPO: Record<PontoOs['tipo'], string> = {
  porta_isca: 'Porta-isca',
  armadilha_luminosa: 'Armadilha luminosa',
  coifa: 'Coifa',
  bebedouro: 'Bebedouro',
  bebedouro_garrafao: 'Bebedouro de garrafão',
  ponto_coleta: 'Ponto de coleta',
  ar_condicionado: 'Ar-condicionado',
  reservatorio: 'Reservatório',
  feromonio: 'Armadilha de feromônio',
  armadilha_moscas: 'Armadilha de moscas',
}

const chave = (osId: string) => `eco-os-pontos-novos-vistos-${osId}`

function lerVistos(osId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chave(osId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function AvisoPontosNovos({ osId, pontos }: { osId: string; pontos: PontoOs[] }) {
  const [vistos, setVistos] = useState(() => lerVistos(osId))
  const novos = pontos
    .filter((p) => p.incluido_na_execucao && !vistos.has(p.id))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero - b.numero)
  if (novos.length === 0) return null

  function entendi() {
    const todos = new Set([...vistos, ...novos.map((p) => p.id)])
    setVistos(todos)
    try {
      localStorage.setItem(chave(osId), JSON.stringify([...todos]))
    } catch {
      // Sem espaço ou navegação privada: o aviso some só enquanto a tela está aberta.
    }
  }

  return (
    <Aviso tipo="info">
      <p className="font-semibold">
        O escritório incluiu {novos.length === 1 ? 'um ponto novo' : `${novos.length} pontos novos`}{' '}
        nesta OS. Confira e preencha:
      </p>
      <ul className="mt-1 flex flex-col">
        {novos.map((p) => (
          <li key={p.id}>
            • {NOME_TIPO[p.tipo]} {String(p.numero).padStart(2, '0')} · {p.area}
          </li>
        ))}
      </ul>
      <Button variante="secundario" className="mt-2" onClick={entendi}>
        Entendi
      </Button>
    </Aviso>
  )
}
