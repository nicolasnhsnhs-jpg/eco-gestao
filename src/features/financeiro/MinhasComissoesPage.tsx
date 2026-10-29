import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarMes } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { useMinhasComissoes } from './comissoesApi'

/**
 * Comissões do vendedor logado, mês a mês (pela competência da parcela vendida).
 * O banco só devolve as comissões do próprio vendedor.
 */
export function MinhasComissoesPage() {
  const comissoes = useMinhasComissoes()
  const lista = comissoes.data ?? []

  const porMes = Object.entries(
    lista.reduce<Record<string, typeof lista>>((acc, c) => {
      ;(acc[c.competencia] ??= []).push(c)
      return acc
    }, {}),
  ).sort(([a], [b]) => b.localeCompare(a))

  return (
    <>
      <PageHeader
        titulo="Minhas comissões"
        descricao="Cada parcela que você vendeu gera comissão no mês dela, mesmo que o cliente ainda não tenha pago. O pagamento é feito no mês seguinte."
      />
      {comissoes.isPending && <Carregando />}
      {comissoes.isError && <Aviso tipo="erro">{mensagemDeErro(comissoes.error)}</Aviso>}
      {comissoes.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhuma comissão ainda. Ela aparece quando um serviço ou contrato seu vira conta a
          receber.
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {porMes.map(([mes, itens]) => {
          const total = itens.reduce((s, c) => s + Number(c.valor), 0)
          const pago = itens.every((c) => c.status === 'paga')
          return (
            <Card key={mes}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{formatarMes(mes)}</h2>
                <span className="flex items-center gap-2">
                  <strong className="text-lg">{formatarReais(total)}</strong>
                  <Etiqueta cor={pago ? 'verde' : 'alerta'}>{pago ? 'Paga' : 'A receber'}</Etiqueta>
                </span>
              </div>
              <ul className="divide-y divide-borda text-sm">
                {itens.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {c.descricao}
                      {c.cliente && (
                        <span className="text-texto-suave">
                          {' '}
                          · {c.cliente.nome_fantasia || c.cliente.nome}
                        </span>
                      )}
                    </span>
                    <span className="text-texto-suave">
                      {Number(c.percentual).toLocaleString('pt-BR')}% de {formatarReais(c.base)} ={' '}
                      <strong className="text-texto">{formatarReais(c.valor)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </>
  )
}
