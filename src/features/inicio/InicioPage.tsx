import { CheckCircle2, Circle } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'

const FASES = [
  { numero: 0, nome: 'Preparação do projeto', pronta: true },
  { numero: 1, nome: 'Login, perfis e clientes', pronta: false },
  { numero: 2, nome: 'Financeiro', pronta: false },
  { numero: 3, nome: 'Propostas', pronta: false },
  { numero: 4, nome: 'Serviços e vencimentos', pronta: false },
  { numero: 5, nome: 'Contratos e comissões', pronta: false },
  { numero: 6, nome: 'Vendedores e recepção', pronta: false },
  { numero: 7, nome: 'Avisos por WhatsApp e e-mail', pronta: false },
]

export function InicioPage() {
  return (
    <>
      <PageHeader
        titulo="Olá!"
        descricao="Este é o sistema de gestão da Eco Ambiental SC. Ele está sendo construído por fases."
      />
      <Card>
        <h2 className="mb-4 text-lg font-bold">Andamento</h2>
        <ol className="space-y-3">
          {FASES.map((fase) => (
            <li key={fase.numero} className="flex items-center gap-3">
              {fase.pronta ? (
                <CheckCircle2 className="size-5 shrink-0 text-verde" aria-label="Pronta" />
              ) : (
                <Circle className="size-5 shrink-0 text-borda" aria-label="Pendente" />
              )}
              <span className={fase.pronta ? 'font-semibold' : 'text-texto-suave'}>
                Fase {fase.numero}: {fase.nome}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  )
}
