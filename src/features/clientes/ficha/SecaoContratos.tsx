import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { useContratos } from '../../contratos/api'
import { ListaContratos } from '../../contratos/ContratosPages'
import { Secao } from './Secao'

type Props = { clienteId: string; clienteNome: string; podeCriar: boolean }

/** Contratos recorrentes do cliente. Só aparece se houver contrato (ou para criar um). */
export function SecaoContratos({ clienteId, clienteNome, podeCriar }: Props) {
  const contratos = useContratos({ clienteId })
  if (!contratos.data?.length && !podeCriar) return null

  return (
    <Secao
      titulo="Contratos"
      acao={
        podeCriar && (
          <Link
            to={`/contratos/novo?cliente=${clienteId}&cliente_nome=${encodeURIComponent(clienteNome)}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Plus className="size-4" aria-hidden /> Novo
          </Link>
        )
      }
    >
      {contratos.data?.length === 0 && (
        <p className="text-sm text-texto-suave">Nenhum contrato com mensalidade.</p>
      )}
      {!!contratos.data?.length && (
        <div className="-mx-5 border-t border-borda">
          <ListaContratos contratos={contratos.data} semBorda />
        </div>
      )}
    </Secao>
  )
}
