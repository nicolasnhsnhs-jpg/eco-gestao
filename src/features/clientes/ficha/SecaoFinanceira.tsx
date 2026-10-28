import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Carregando } from '@/components/ui/Carregando'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useLancamentosDoCliente, type LancamentoCompleto } from '../../financeiro/api'
import { ConfirmarModal } from '../../financeiro/ConfirmarModal'
import { LinhaLancamento } from '../../financeiro/LancamentosPage'
import { Secao, Vazio } from './Secao'

type Props = { clienteId: string; clienteNome: string }

/** Situação financeira do cliente. Só aparece para Admin e Financeiro (e o banco só entrega a eles). */
export function SecaoFinanceira({ clienteId, clienteNome }: Props) {
  const lancamentos = useLancamentosDoCliente(clienteId, true)
  const [confirmando, setConfirmando] = useState<LancamentoCompleto | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  const lista = lancamentos.data ?? []
  const soma = (filtro: (l: LancamentoCompleto) => boolean) =>
    lista
      .filter(filtro)
      .reduce((s, l) => s + Number(l.status === 'realizado' ? l.valor_pago : l.valor), 0)
  const emAberto = soma((l) => l.status === 'pendente' || l.status === 'agendado')
  const atrasado = soma((l) => !!l.atrasado)
  const recebido = soma((l) => l.status === 'realizado')
  const visiveis = verTodos ? lista : lista.slice(0, 5)

  const novoLink = `/financeiro/lancamentos/novo?tipo=entrada&cliente=${clienteId}&cliente_nome=${encodeURIComponent(clienteNome)}`

  return (
    <Secao
      titulo="Situação financeira"
      acao={
        <Link
          to={novoLink}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda bg-white px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
        >
          <Plus className="size-4" aria-hidden /> A receber
        </Link>
      }
    >
      {lancamentos.isPending && <Carregando />}
      {lancamentos.isError && <Aviso tipo="erro">{mensagemDeErro(lancamentos.error)}</Aviso>}

      {lancamentos.isSuccess && (
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
          <Numero rotulo="Em aberto" valor={emAberto} />
          <Numero rotulo="Atrasado" valor={atrasado} perigo={atrasado > 0} />
          <Numero rotulo="Recebido" valor={recebido} />
        </dl>
      )}

      {lancamentos.isSuccess && lista.length === 0 && (
        <Vazio>Nenhum lançamento para este cliente.</Vazio>
      )}

      {lista.length > 0 && (
        <ul className="-mx-5 divide-y divide-borda border-t border-borda">
          {visiveis.map((l) => (
            <LinhaLancamento key={l.id} l={l} aoConfirmar={() => setConfirmando(l)} />
          ))}
        </ul>
      )}
      {lista.length > 5 && !verTodos && (
        <button
          type="button"
          onClick={() => setVerTodos(true)}
          className="mt-3 text-sm font-semibold text-verde underline"
        >
          Ver todos ({lista.length})
        </button>
      )}

      <ConfirmarModal lancamento={confirmando} aoFechar={() => setConfirmando(null)} />
    </Secao>
  )
}

function Numero({ rotulo, valor, perigo }: { rotulo: string; valor: number; perigo?: boolean }) {
  return (
    <div className={cn('rounded-xl p-2', perigo ? 'bg-red-50 text-perigo' : 'bg-fundo-suave')}>
      <dt className="text-xs text-texto-suave">{rotulo}</dt>
      <dd className="text-sm font-bold">{formatarReais(valor)}</dd>
    </div>
  )
}
