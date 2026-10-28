import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import { useServicos, useVencimentos } from '../../servicos/api'
import { ListaServicos } from '../../servicos/ServicosPages'
import { ListaVencimentos } from '../../servicos/Vencimentos'
import { Secao, Vazio } from './Secao'

type Props = { clienteId: string; clienteNome: string; podeCriar: boolean }

/** Vencimentos ("quando volta") e histórico de serviços do cliente. */
export function SecaoServicos({ clienteId, clienteNome, podeCriar }: Props) {
  const vencimentos = useVencimentos({ clienteId })
  const servicos = useServicos({ clienteId })
  const [verTodos, setVerTodos] = useState(false)
  const lista = servicos.data ?? []
  const novo = `/servicos/novo?cliente=${clienteId}&cliente_nome=${encodeURIComponent(clienteNome)}`

  return (
    <Secao
      titulo="Serviços e vencimentos"
      acao={
        podeCriar && (
          <Link
            to={novo}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <Plus className="size-4" aria-hidden /> Registrar
          </Link>
        )
      }
    >
      {(vencimentos.isPending || servicos.isPending) && <Carregando />}
      {vencimentos.isError && <Aviso tipo="erro">{mensagemDeErro(vencimentos.error)}</Aviso>}

      {!!vencimentos.data?.length && (
        <>
          <h3 className="text-sm font-bold text-texto-suave uppercase">Próximos vencimentos</h3>
          <ListaVencimentos vencimentos={vencimentos.data} />
        </>
      )}

      {servicos.isSuccess && lista.length === 0 && (
        <Vazio>Nenhum serviço registrado para este cliente.</Vazio>
      )}
      {lista.length > 0 && (
        <>
          <h3 className="mt-4 mb-2 text-sm font-bold text-texto-suave uppercase">Histórico</h3>
          <div className="-mx-5 border-t border-borda">
            <ListaServicos servicos={verTodos ? lista : lista.slice(0, 5)} semBorda />
          </div>
          {lista.length > 5 && !verTodos && (
            <button
              type="button"
              onClick={() => setVerTodos(true)}
              className="mt-3 text-sm font-semibold text-verde underline"
            >
              Ver todos ({lista.length})
            </button>
          )}
        </>
      )}
    </Secao>
  )
}
