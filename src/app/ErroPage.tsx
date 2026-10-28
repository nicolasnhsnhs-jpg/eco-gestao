import { TriangleAlert } from 'lucide-react'
import { useRouteError } from 'react-router'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/** Aparece quando algo quebra numa tela, no lugar da mensagem técnica em inglês. */
export function ErroPage() {
  const erro = useRouteError()
  console.error(erro)

  return (
    <div className="grid min-h-dvh place-items-center bg-fundo-suave p-4">
      <Card className="max-w-sm text-center">
        <TriangleAlert className="mx-auto mb-3 size-10 text-alerta" aria-hidden />
        <h1 className="text-lg font-bold">Algo deu errado nesta tela</h1>
        <p className="mt-2 text-texto-suave">
          Tente recarregar a página. Se o problema continuar, avise o administrador do sistema.
        </p>
        <Button className="mt-4 w-full" onClick={() => window.location.reload()}>
          Recarregar
        </Button>
      </Card>
    </div>
  )
}
