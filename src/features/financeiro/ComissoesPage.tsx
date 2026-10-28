import { ChevronDown, ChevronUp, HandCoins } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarMes, hojeISO, somarMeses } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { useContas } from './api'
import {
  useComissoesEmAberto,
  useDiaUtil,
  useFecharComissoes,
  useFechamentos,
  type ComissaoAberta,
} from './comissoesApi'

type Grupo = { vendedorId: string; nome: string; total: number; itens: ComissaoAberta[] }

/**
 * Comissões: 8% (ou o % do vendedor) de cada parcela vendida, pela competência.
 * No começo do mês, o financeiro "fecha" o mês anterior de cada vendedor:
 * isso cria a saída a pagar. Quando a saída é paga, as comissões ficam pagas.
 */
export function ComissoesPage() {
  // Por padrão: fechar o mês passado (a comissão é paga no mês seguinte).
  const mesPassado = somarMeses(`${hojeISO().slice(0, 7)}-01`, -1).slice(0, 7)
  const [mes, setMes] = useState(mesPassado)
  const ateMes = `${mes}-01`
  const abertas = useComissoesEmAberto(ateMes)
  const fechamentos = useFechamentos()
  const [fechando, setFechando] = useState<Grupo | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const grupos = Object.values(
    (abertas.data ?? []).reduce<Record<string, Grupo>>((acc, c) => {
      const g = (acc[c.vendedor_id] ??= {
        vendedorId: c.vendedor_id,
        nome: c.vendedor?.nome ?? '—',
        total: 0,
        itens: [],
      })
      g.total += Number(c.valor)
      g.itens.push(c)
      return acc
    }, {}),
  ).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comissões</h1>
          <p className="text-sm text-texto-suave">
            Comissão de cada parcela vendida, pela competência, sem esperar o cliente pagar.
          </p>
        </div>
        <Campo rotulo="Fechar até o mês" htmlFor="mes-comissao">
          <Input
            id="mes-comissao"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
          />
        </Campo>
      </div>

      {mensagem && <Aviso tipo="sucesso">{mensagem}</Aviso>}
      {abertas.isError && <Aviso tipo="erro">{mensagemDeErro(abertas.error)}</Aviso>}

      <section>
        <h2 className="mb-2 text-lg font-bold">Em aberto até {formatarMes(ateMes)}</h2>
        {abertas.isPending && <Carregando />}
        {abertas.isSuccess && grupos.length === 0 && (
          <Card className="text-sm text-texto-suave">Nenhuma comissão em aberto até este mês.</Card>
        )}
        <ul className="flex flex-col gap-3">
          {grupos.map((g) => (
            <li key={g.vendedorId}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <HandCoins className="size-6 text-verde" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{g.nome}</p>
                    <p className="text-sm text-texto-suave">
                      {g.itens.length} parcela(s) vendida(s)
                    </p>
                  </div>
                  <strong className="text-lg">{formatarReais(g.total)}</strong>
                  <Button onClick={() => setFechando(g)}>Fechar e lançar pagamento</Button>
                  <button
                    type="button"
                    onClick={() => setAberto(aberto === g.vendedorId ? null : g.vendedorId)}
                    className="grid size-10 place-items-center rounded-xl text-texto-suave hover:bg-lima-claro"
                    aria-label={aberto === g.vendedorId ? 'Esconder detalhes' : 'Ver detalhes'}
                  >
                    {aberto === g.vendedorId ? (
                      <ChevronUp aria-hidden />
                    ) : (
                      <ChevronDown aria-hidden />
                    )}
                  </button>
                </div>
                {aberto === g.vendedorId && (
                  <ul className="mt-3 divide-y divide-borda border-t border-borda text-sm">
                    {g.itens.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span>
                          <strong>{formatarMes(c.competencia)}</strong> ·{' '}
                          <Link
                            to={`/financeiro/lancamentos/${c.lancamento_origem_id}`}
                            className="text-verde underline"
                          >
                            {c.origem?.descricao}
                          </Link>
                          {c.cliente && ` · ${c.cliente.nome_fantasia || c.cliente.nome}`}
                        </span>
                        <span className="text-texto-suave">
                          {Number(c.percentual).toLocaleString('pt-BR')}% de {formatarReais(c.base)}{' '}
                          = <strong className="text-texto">{formatarReais(c.valor)}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Fechamentos</h2>
        {fechamentos.isPending && <Carregando />}
        {fechamentos.data?.length === 0 && (
          <Card className="text-sm text-texto-suave">Nenhum fechamento ainda.</Card>
        )}
        {!!fechamentos.data?.length && (
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
            {fechamentos.data.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <strong>{f.vendedor?.nome}</strong> · até {formatarMes(f.competencia)}
                </span>
                <strong>{formatarReais(f.valor_total)}</strong>
                <Etiqueta cor={f.status === 'pago' ? 'verde' : 'alerta'}>
                  {f.status === 'pago' ? 'Pago' : 'A pagar'}
                </Etiqueta>
                {f.lancamento_pagamento_id && (
                  <Link
                    to={`/financeiro/lancamentos/${f.lancamento_pagamento_id}`}
                    className="text-sm font-semibold text-verde underline"
                  >
                    Ver saída
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal aberto={!!fechando} aoFechar={() => setFechando(null)} titulo="Fechar comissões">
        {fechando && (
          <FormFechar
            grupo={fechando}
            mes={mes}
            aoTerminar={(texto) => {
              setFechando(null)
              setMensagem(texto)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function FormFechar({
  grupo,
  mes,
  aoTerminar,
}: {
  grupo: Grupo
  mes: string
  aoTerminar: (mensagem: string) => void
}) {
  // Sugestão de pagamento: 5º dia útil do mês seguinte ao fechado.
  const seguinte = somarMeses(`${mes}-01`, 1)
  const sugestao = useDiaUtil(Number(seguinte.slice(0, 4)), Number(seguinte.slice(5, 7)), 5)
  const contas = useContas()
  const fechar = useFecharComissoes()
  const [vencimento, setVencimento] = useState<string | null>(null)
  const [conta, setConta] = useState('')
  const dataPagamento = vencimento ?? sugestao.data ?? ''

  async function confirmar() {
    try {
      await fechar.mutateAsync({
        vendedor: grupo.vendedorId,
        mes: `${mes}-01`,
        vencimento: dataPagamento,
        conta: conta || null,
      })
      aoTerminar(
        `Comissões de ${grupo.nome} fechadas: ${formatarReais(grupo.total)} lançados em contas a pagar.`,
      )
    } catch {
      // Mostrado abaixo.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        <strong>{grupo.nome}</strong>: {grupo.itens.length} parcela(s), total{' '}
        <strong>{formatarReais(grupo.total)}</strong>.
      </p>
      <p className="text-sm text-texto-suave">
        Será criada uma conta a pagar (categoria Folha / Pró-labore). Quando ela for confirmada como
        paga, as comissões ficam marcadas como pagas.
      </p>
      {fechar.isError && <Aviso tipo="erro">{mensagemDeErro(fechar.error)}</Aviso>}
      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo="Pagar em"
          htmlFor="fechar-data"
          dica="Sugestão: 5º dia útil do mês seguinte."
        >
          <Input
            id="fechar-data"
            type="date"
            value={dataPagamento}
            onChange={(e) => setVencimento(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Conta" htmlFor="fechar-conta">
          <Select id="fechar-conta" value={conta} onChange={(e) => setConta(e.target.value)}>
            <option value="">Definir ao pagar</option>
            {(contas.data ?? [])
              .filter((c) => c.ativo)
              .map((c) => (
                <option key={c.id} value={c.id!}>
                  {c.nome}
                </option>
              ))}
          </Select>
        </Campo>
      </div>
      <Button disabled={!dataPagamento || fechar.isPending} onClick={() => void confirmar()}>
        {fechar.isPending ? 'Fechando…' : 'Confirmar fechamento'}
      </Button>
    </div>
  )
}
