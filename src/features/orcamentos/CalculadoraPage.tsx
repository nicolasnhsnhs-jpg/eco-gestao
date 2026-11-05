import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { usePerfil } from '@/features/auth/useAuth'
import { formatarReais } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { useCustosOrcamento } from './api'
import {
  calcularOrcamento,
  lerNumero,
  NOME_VEICULO,
  SERVICOS,
  type Entrada,
  type Preco,
  type ServicoOrcamento,
  type Veiculo,
} from './calculo'

type Formulario = {
  distancia: string
  tecnicos: string
  horas: string
  extras: string
  veiculo: Veiculo
  valores: Record<string, string>
}

const inicial = (s: ServicoOrcamento, anterior?: Formulario): Formulario => ({
  distancia: anterior?.distancia ?? '',
  tecnicos: anterior?.tecnicos ?? '1',
  horas: '',
  extras: anterior?.extras ?? '',
  veiculo: s.veiculo,
  valores: Object.fromEntries(
    s.entradas.map((e) => [e.id, e.padrao == null ? '' : String(e.padrao)]),
  ),
})

const n = (texto: string) => lerNumero(texto) ?? 0

/** Calculadora: o vendedor informa o serviço e as medidas e recebe os três preços. */
export function CalculadoraPage() {
  const perfil = usePerfil()
  // O vendedor vê só os três preços: custos, lucro e composição ficam para o admin.
  const admin = perfil.papel === 'admin'
  const custos = useCustosOrcamento()
  const [servicoId, setServicoId] = useState(SERVICOS[0].id)
  const servico = SERVICOS.find((s) => s.id === servicoId)!
  const [form, setForm] = useState(() => inicial(servico))

  if (custos.isPending) return <Carregando />
  if (custos.isError) return <Aviso tipo="erro">{mensagemDeErro(custos.error)}</Aviso>

  const trocarServico = (id: string) => {
    const novo = SERVICOS.find((s) => s.id === id)!
    setServicoId(id)
    setForm(inicial(novo, form))
  }

  const r = calcularOrcamento(servico, custos.data, {
    distancia: n(form.distancia),
    tecnicos: n(form.tecnicos),
    horas: n(form.horas),
    extras: n(form.extras),
    veiculo: form.veiculo,
    valores: Object.fromEntries(Object.entries(form.valores).map(([k, v]) => [k, n(v)])),
  })

  const campoNumero = (
    id: string,
    rotulo: string,
    valor: string,
    mudar: (v: string) => void,
    dica?: string,
  ) => (
    <Campo rotulo={rotulo} htmlFor={`calc-${id}`} dica={dica}>
      <Input
        id={`calc-${id}`}
        inputMode="decimal"
        value={valor}
        aria-invalid={valor.trim() !== '' && lerNumero(valor) == null}
        onChange={(e) => mudar(e.target.value)}
      />
    </Campo>
  )

  const campoEntrada = (e: Entrada) =>
    campoNumero(e.id, `${e.rotulo} (${e.unidade})`, form.valores[e.id] ?? '', (v) =>
      setForm({ ...form, valores: { ...form.valores, [e.id]: v } }),
    )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Serviço</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Serviço">
            {SERVICOS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === servicoId}
                onClick={() => trocarServico(s.id)}
                className={cn(
                  'min-h-10 rounded-xl border px-3 text-sm font-semibold',
                  s.id === servicoId
                    ? 'border-verde bg-verde text-white'
                    : 'border-borda bg-white text-texto hover:bg-lima-claro',
                )}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Deslocamento e equipe</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {campoNumero(
              'distancia',
              'Distância até o cliente (km, só ida)',
              form.distancia,
              (v) => setForm({ ...form, distancia: v }),
              r.kmTotal ? `Ida e volta: ${r.kmTotal.toLocaleString('pt-BR')} km` : undefined,
            )}
            <Campo rotulo="Veículo" htmlFor="calc-veiculo">
              <Select
                id="calc-veiculo"
                value={form.veiculo}
                onChange={(e) => setForm({ ...form, veiculo: e.target.value as Veiculo })}
              >
                {Object.entries(NOME_VEICULO).map(([v, nome]) => (
                  <option key={v} value={v}>
                    {nome}
                  </option>
                ))}
              </Select>
            </Campo>
            {campoNumero('tecnicos', 'Técnicos na equipe', form.tecnicos, (v) =>
              setForm({ ...form, tecnicos: v }),
            )}
            {campoNumero(
              'horas',
              'Horas de trabalho no local',
              form.horas,
              (v) => setForm({ ...form, horas: v }),
              'Sem contar a viagem (ela entra sozinha).',
            )}
            {campoNumero('extras', 'Pedágio / estacionamento (R$)', form.extras, (v) =>
              setForm({ ...form, extras: v }),
            )}
          </div>
        </Card>

        {servico.entradas.length > 0 && (
          <Card>
            <h2 className="mb-4 text-lg font-bold">Medidas do serviço</h2>
            <div className="grid gap-4 sm:grid-cols-2">{servico.entradas.map(campoEntrada)}</div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Preço para {servico.nome.toLowerCase()}</h2>
          <div className="grid gap-3">
            <CaixaPreco
              titulo="Mínimo"
              dica="Menor valor para fechar"
              preco={r.minimo}
              detalhes={admin}
            />
            <CaixaPreco
              titulo="Ideal"
              dica="Valor a oferecer"
              preco={r.ideal}
              detalhes={admin}
              destaque
            />
            <CaixaPreco
              titulo="Máximo"
              dica="Teto da negociação"
              preco={r.maximo}
              detalhes={admin}
            />
          </div>
          {admin && (
            <p className="mt-4 text-sm text-texto-suave">
              Custo total: <b className="text-texto">{formatarReais(r.custoTotal)}</b>
              {r.descontos > 0 &&
                ` · impostos + comissão: ${r.descontos.toLocaleString('pt-BR')}% do preço`}
            </p>
          )}
        </Card>

        {r.faltando.length > 0 && !admin && (
          <Aviso tipo="erro">
            Os custos deste serviço ainda não foram todos definidos: o preço ainda não é real. Fale
            com o administrador.
          </Aviso>
        )}

        {r.faltando.length > 0 && admin && (
          <Aviso tipo="erro">
            <p className="font-semibold">Faltam custos ou margens — o preço ainda não é real.</p>
            <ul className="mt-1 list-disc pl-5">
              {r.faltando.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link to="/orcamentos/custos" className="mt-2 inline-block font-semibold underline">
              Preencher custos e margens
            </Link>
          </Aviso>
        )}

        {admin && (
          <Card>
            <h2 className="mb-3 font-bold">Composição do custo</h2>
            <ul className="divide-y divide-borda text-sm">
              {r.linhas.map((l) => (
                <li key={l.rotulo} className="flex items-start justify-between gap-3 py-2">
                  <span>
                    {l.rotulo}
                    {l.detalhe && <span className="block text-texto-suave">{l.detalhe}</span>}
                  </span>
                  <span className="font-semibold whitespace-nowrap">{formatarReais(l.valor)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

function CaixaPreco({
  titulo,
  dica,
  preco,
  detalhes,
  destaque,
}: {
  titulo: string
  dica: string
  preco: Preco | null
  /** Mostra margem e lucro (só para o admin). */
  detalhes: boolean
  destaque?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        destaque ? 'border-verde bg-lima-claro' : 'border-borda bg-white',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{titulo}</span>
        <span className="text-sm text-texto-suave">{dica}</span>
      </div>
      {preco ? (
        <>
          <p className={cn('mt-1 font-bold', destaque ? 'text-3xl text-verde-escuro' : 'text-2xl')}>
            {formatarReais(preco.preco)}
          </p>
          {detalhes && (
            <p className="text-sm text-texto-suave">
              Margem de {preco.margem.toLocaleString('pt-BR')}% · lucro de{' '}
              {formatarReais(preco.lucro)}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-2xl font-bold text-texto-suave">—</p>
      )}
    </div>
  )
}
