import { useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData, hojeISO, mesDe, somarDias, somarMeses } from '@/lib/datas'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useFaturamento, type NotaFiscalCompleta } from './notasApi'
import { LinhaNota } from './NotasFiscaisPage'

/** "2026-11" → primeiro e último dia do mês. */
function diasDoMes(mes: string): [string, string] {
  const inicio = `${mes}-01`
  return [inicio, somarDias(somarMeses(inicio, 1), -1)]
}

/**
 * Quanto a empresa faturou num mês ou num período (de tal dia até tal dia):
 * as notas emitidas nessas datas, na ordem de emissão, com os totais.
 */
export function FaturamentoPage() {
  // Filtro no endereço (?mes=2026-11 ou ?de=…&ate=…): "voltar" da nota mantém tudo.
  const [parametros, setParametros] = useSearchParams()
  const porPeriodo = parametros.get('modo') === 'periodo'
  const mes = parametros.get('mes') || mesDe(hojeISO())
  const [inicioMes, fimMes] = diasDoMes(mes)
  const de = porPeriodo ? (parametros.get('de') ?? inicioMes) : inicioMes
  const ate = porPeriodo ? (parametros.get('ate') ?? fimMes) : fimMes
  const periodoInvalido = !de || !ate || de > ate

  const notas = useFaturamento(de, ate)
  const lista = periodoInvalido ? [] : (notas.data ?? [])

  function mudar(valores: Record<string, string>) {
    const novos = new URLSearchParams(parametros)
    for (const [chave, valor] of Object.entries(valores)) {
      if (valor) novos.set(chave, valor)
      else novos.delete(chave)
    }
    setParametros(novos, { replace: true })
  }

  const somar = (l: NotaFiscalCompleta[]) => l.reduce((s, n) => s + Number(n.valor_servico), 0)
  const deContrato = lista.filter((n) => n.tipo === 'contrato')
  const avulsas = lista.filter((n) => n.tipo === 'avulsa')
  const total = somar(lista)

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Faturamento</h1>

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div
          role="group"
          aria-label="Escolher por"
          className="flex rounded-xl border border-borda bg-white p-1"
        >
          {[
            { rotulo: 'Mês', ligado: !porPeriodo, modo: '' },
            { rotulo: 'Período', ligado: porPeriodo, modo: 'periodo' },
          ].map((b) => (
            <button
              key={b.rotulo}
              type="button"
              aria-pressed={b.ligado}
              className={cn(
                'min-h-10 rounded-lg px-4 text-sm font-semibold',
                b.ligado ? 'bg-verde text-white' : 'text-texto-suave hover:bg-lima-claro',
              )}
              // Ao trocar para período, já começa com o mês que estava escolhido.
              onClick={() =>
                mudar(
                  b.modo
                    ? { modo: 'periodo', de: inicioMes, ate: fimMes }
                    : { modo: '', de: '', ate: '' },
                )
              }
            >
              {b.rotulo}
            </button>
          ))}
        </div>

        {porPeriodo ? (
          <>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              De
              <Input type="date" value={de} onChange={(e) => mudar({ de: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Até
              <Input type="date" value={ate} onChange={(e) => mudar({ ate: e.target.value })} />
            </label>
          </>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Mês da emissão
            <Input type="month" value={mes} onChange={(e) => mudar({ mes: e.target.value })} />
          </label>
        )}
      </Card>

      {periodoInvalido && (
        <Aviso tipo="erro">Escolha as duas datas, com a data inicial antes da final.</Aviso>
      )}
      {notas.isError && <Aviso tipo="erro">{mensagemDeErro(notas.error)}</Aviso>}
      {!periodoInvalido && notas.isPending && <Carregando />}

      {!periodoInvalido && notas.isSuccess && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-texto-suave">
                Faturamento de {formatarData(de)} a {formatarData(ate)}
              </p>
              <p className="text-2xl font-bold text-verde">{formatarReais(total)}</p>
              <p className="text-sm text-texto-suave">{lista.length} nota(s) emitida(s)</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-texto-suave">De contrato</p>
              <p className="text-xl font-bold">{formatarReais(somar(deContrato))}</p>
              <p className="text-sm text-texto-suave">{deContrato.length} nota(s)</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-texto-suave">Avulsas</p>
              <p className="text-xl font-bold">{formatarReais(somar(avulsas))}</p>
              <p className="text-sm text-texto-suave">{avulsas.length} nota(s)</p>
            </Card>
          </div>

          {lista.length === 0 ? (
            <Card className="py-10 text-center text-texto-suave">
              Nenhuma nota emitida nessas datas.
            </Card>
          ) : (
            <>
              <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
                {lista.map((n) => (
                  <LinhaNota key={n.id} n={n} />
                ))}
              </ul>
              <p className="mt-3 text-right text-sm">
                Total: <strong>{formatarReais(total)}</strong>
              </p>
            </>
          )}
          <p className="mt-2 text-sm text-texto-suave">
            Conta o valor do serviço das notas emitidas, pela data de emissão. Notas canceladas e
            rascunhos ficam de fora.
          </p>
        </>
      )}
    </>
  )
}
