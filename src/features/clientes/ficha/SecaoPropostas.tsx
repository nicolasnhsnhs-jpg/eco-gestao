import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import { usePropostas } from '../../propostas/api'
import { ListaPropostas } from '../../propostas/PropostasPage'
import { Secao, Vazio } from './Secao'

type Props = {
  clienteId: string
  clienteNome: string
  vendedorId: string | null
  podeCriar: boolean
}

/** Histórico de propostas do cliente. Não aparece para a recepção. */
export function SecaoPropostas({ clienteId, clienteNome, vendedorId, podeCriar }: Props) {
  const propostas = usePropostas({ clienteId })
  const novaLink =
    `/propostas/nova?cliente=${clienteId}&cliente_nome=${encodeURIComponent(clienteNome)}` +
    (vendedorId ? `&vendedor=${vendedorId}` : '')

  return (
    <Secao
      titulo="Propostas"
      acao={
        podeCriar && (
          <Link
            to={novaLink}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Plus className="size-4" aria-hidden /> Nova
          </Link>
        )
      }
    >
      {propostas.isPending && <Carregando />}
      {propostas.isError && <Aviso tipo="erro">{mensagemDeErro(propostas.error)}</Aviso>}
      {propostas.data?.length === 0 && <Vazio>Nenhuma proposta para este cliente.</Vazio>}
      {!!propostas.data?.length && (
        <div className="-mx-5 border-t border-borda">
          <ListaPropostas propostas={propostas.data} semBorda />
        </div>
      )}
    </Secao>
  )
}
