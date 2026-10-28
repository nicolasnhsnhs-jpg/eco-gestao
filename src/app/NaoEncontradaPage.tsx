import { Link } from 'react-router'

import { Card } from '@/components/ui/Card'

export function NaoEncontradaPage() {
  return (
    <Card className="py-12 text-center">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-texto-suave">
        O endereço pode estar errado ou a página mudou de lugar.
      </p>
      <Link to="/" className="mt-4 inline-block font-semibold text-verde underline">
        Voltar para o início
      </Link>
    </Card>
  )
}
