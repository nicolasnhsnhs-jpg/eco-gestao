import { Hourglass } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'

type Props = {
  titulo: string
  fase: number
  descricao: string
}

/** Página provisória de um módulo que ainda vai ser construído. */
export function EmBreve({ titulo, fase, descricao }: Props) {
  return (
    <>
      <PageHeader titulo={titulo} />
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-lima-claro text-verde">
          <Hourglass aria-hidden />
        </span>
        <p className="font-titulo font-bold text-verde-escuro">Chega na Fase {fase}</p>
        <p className="max-w-md text-texto-suave">{descricao}</p>
      </Card>
    </>
  )
}
