import { Link, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, formatarMes, hojeISO, mesDe, somarMeses } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_GESTAO } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import { equipeComercial, useEquipe } from '../clientes/api'
import { horaCurta, useVendasDoMes } from './api'

/**
 * Tabela de vendas do mês: as propostas aprovadas no mês, com o dia agendado e o
 * valor total. O vendedor vê as dele; a gestão escolhe o vendedor (ou todos).
 */
export function VendasDoMesPage() {
  const perfil = usePerfil()
  const gestao = PAPEIS_GESTAO.includes(perfil.papel)
  const [parametros, setParametros] = useSearchParams()
  const atual = mesDe(hojeISO())
  const mes = parametros.get('mes') || atual
  // Gestão: todos por padrão; vendedor: sempre ele mesmo.
  const escolhido = gestao ? parametros.get('vendedor') || '' : perfil.id
  const vendas = useVendasDoMes(mes, escolhido || undefined)
  const equipe = useEquipe()
  const vendedores = equipeComercial(equipe.data)

  function mudar(chave: string, valor: string) {
    const p = new URLSearchParams(parametros)
    if (valor) p.set(chave, valor)
    else p.delete(chave)
    setParametros(p, { replace: true })
  }

  const lista = vendas.data ?? []
  const total = lista.reduce((s, p) => s + Number(p.valor_total), 0)
  const agendadas = lista.filter((p) => p.execucao_data).length

  // Resumo por vendedor quando a gestão olha todos.
  const porVendedor = new Map<string, { nome: string; qtd: number; valor: number }>()
  if (!escolhido) {
    for (const p of lista) {
      const chave = p.vendedor_id ?? ''
      const linha = porVendedor.get(chave) ?? { nome: p.vendedor?.nome ?? '—', qtd: 0, valor: 0 }
      linha.qtd += 1
      linha.valor += Number(p.valor_total)
      porVendedor.set(chave, linha)
    }
  }
  const resumo = [...porVendedor.entries()].sort((a, b) => b[1].valor - a[1].valor)

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <Input
          type="month"
          aria-label="Mês"
          value={mes}
          onChange={(e) =>
            e.target.value && mudar('mes', e.target.value === atual ? '' : e.target.value)
          }
          className="min-h-10 w-auto"
        />
        <Button
          variante="fantasma"
          className="min-h-10"
          onClick={() => mudar('mes', mesDe(somarMeses(`${mes}-01`, -1)))}
        >
          Mês anterior
        </Button>
        {mes !== atual && (
          <Button variante="fantasma" className="min-h-10" onClick={() => mudar('mes', '')}>
            Este mês
          </Button>
        )}
        {gestao && (
          <Select
            aria-label="Vendedor"
            value={escolhido}
            onChange={(e) => mudar('vendedor', e.target.value)}
            className="min-h-10 w-auto sm:ml-auto"
          >
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </Select>
        )}
      </Card>

      {vendas.isError && <Aviso tipo="erro">{mensagemDeErro(vendas.error)}</Aviso>}
      {vendas.isPending && <Carregando />}

      {vendas.isSuccess && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Numero rotulo={`Vendido em ${formatarMes(`${mes}-01`)}`} valor={formatarReais(total)} />
          <Numero rotulo="Propostas aprovadas" valor={String(lista.length)} />
          <Numero rotulo="Já agendadas" valor={`${agendadas} de ${lista.length}`} />
        </div>
      )}

      {resumo.length > 1 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-fundo-suave text-left text-texto-suave">
              <tr>
                <th className="px-4 py-2 font-semibold">Vendedor</th>
                <th className="px-4 py-2 text-right font-semibold">Propostas</th>
                <th className="px-4 py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {resumo.map(([id, r]) => (
                <tr key={id}>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="font-semibold text-verde underline"
                      onClick={() => mudar('vendedor', id)}
                    >
                      {r.nome}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">{r.qtd}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {formatarReais(r.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {vendas.isSuccess && lista.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          Nenhuma proposta aprovada neste mês.
        </Card>
      )}

      {lista.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-fundo-suave text-left text-texto-suave">
              <tr>
                <th className="px-4 py-2 font-semibold">Aprovada</th>
                <th className="px-4 py-2 font-semibold">Proposta</th>
                <th className="px-4 py-2 font-semibold">Cliente</th>
                {!escolhido && <th className="px-4 py-2 font-semibold">Vendedor</th>}
                <th className="px-4 py-2 font-semibold">Execução</th>
                <th className="px-4 py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {lista.map((p) => (
                <tr key={p.id} className="hover:bg-fundo-suave">
                  <td className="px-4 py-2 whitespace-nowrap">{formatarData(p.data_resposta)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link to={`/propostas/${p.id}`} className="font-semibold text-verde underline">
                      {p.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{p.cliente?.nome_fantasia || p.cliente?.nome}</td>
                  {!escolhido && <td className="px-4 py-2">{p.vendedor?.nome}</td>}
                  <td className="px-4 py-2 whitespace-nowrap">
                    {p.execucao_data ? (
                      `${formatarData(p.execucao_data)}${p.execucao_hora ? ` ${horaCurta(p.execucao_hora)}` : ''}`
                    ) : (
                      <span className="font-semibold text-alerta">Sem agendamento</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {formatarReais(p.valor_total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-fundo-suave font-bold">
              <tr>
                <td className="px-4 py-2" colSpan={escolhido ? 4 : 5}>
                  Total
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{formatarReais(total)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-texto-suave">{rotulo}</p>
      <p className="text-lg font-bold">{valor}</p>
    </Card>
  )
}
