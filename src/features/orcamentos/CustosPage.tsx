import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import { useCustosOrcamento, useSalvarCustos } from './api'
import {
  chave,
  CUSTOS_GERAIS,
  DICA_GERAL,
  lerNumero,
  MARGENS,
  NOME_VEICULO,
  numeroParaCampo,
  SERVICOS,
  type Custos,
} from './calculo'

/** Aba do Admin: custos de cada serviço e as margens de lucro (mínima, ideal e máxima). */
export function CustosPage() {
  const custos = useCustosOrcamento()
  const salvar = useSalvarCustos()
  /** Só o que foi digitado e ainda não salvo. */
  const [editados, setEditados] = useState<Record<string, string>>({})

  if (custos.isPending) return <Carregando />
  if (custos.isError) return <Aviso tipo="erro">{mensagemDeErro(custos.error)}</Aviso>

  const texto = (k: string) => editados[k] ?? numeroParaCampo(custos.data[k])
  const invalidos = Object.entries(editados).filter(([k, v]) => {
    if (v.trim() === '') return false
    const valor = lerNumero(v)
    return valor == null || (k.includes('.margem_') && valor >= 100)
  })
  const pendentes = Object.keys(editados).length

  const gravar = () => {
    const alterados: Custos = Object.fromEntries(
      Object.entries(editados).map(([k, v]) => [k, lerNumero(v)]),
    )
    salvar.mutate(alterados, { onSuccess: () => setEditados({}) })
  }

  const campo = (k: string, rotulo: string, unidade: string, dica?: string) => {
    const v = texto(k)
    const errado = invalidos.some(([c]) => c === k)
    return (
      <Campo
        key={k}
        rotulo={`${rotulo} (${unidade})`}
        htmlFor={`custo-${k}`}
        dica={dica}
        erro={
          errado
            ? k.includes('.margem_')
              ? 'Precisa ser menor que 100.'
              : 'Número inválido.'
            : undefined
        }
      >
        <Input
          id={`custo-${k}`}
          inputMode="decimal"
          placeholder="Em branco"
          value={v}
          aria-invalid={errado}
          onChange={(e) => setEditados({ ...editados, [k]: e.target.value })}
        />
      </Campo>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Aviso>
        Use números com vírgula (ex.: 2,35). Campos em branco contam como zero na calculadora e
        aparecem como pendência para o vendedor. As margens são o lucro sobre o preço de venda,
        depois de pagar custos, impostos e comissão.
      </Aviso>

      <Card>
        <h2 className="mb-4 text-lg font-bold">Custos gerais (todos os serviços)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CUSTOS_GERAIS.map((c) =>
            campo(chave('geral', c.id), c.rotulo, c.unidade, DICA_GERAL[c.id]),
          )}
        </div>
      </Card>

      {SERVICOS.map((s) => (
        <Card key={s.id}>
          <h2 className="text-lg font-bold">{s.nome}</h2>
          <p className="mb-4 text-sm text-texto-suave">
            Vai de {NOME_VEICULO[s.veiculo].toLowerCase()} (o vendedor pode trocar).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {s.custos.map((c) => campo(chave(s.id, c.id), c.rotulo, c.unidade))}
          </div>
          <h3 className="mt-6 mb-3 font-semibold">Margens de lucro</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {MARGENS.map((m) => campo(chave(s.id, m.id), m.rotulo, '%'))}
          </div>
        </Card>
      ))}

      <div className="sticky bottom-20 z-10 rounded-2xl border border-borda bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:bottom-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {salvar.isError && (
            <span className="text-sm text-perigo">{mensagemDeErro(salvar.error)}</span>
          )}
          {salvar.isSuccess && !pendentes && (
            <span className="text-sm text-verde-escuro">Custos salvos.</span>
          )}
          {pendentes > 0 && (
            <Button variante="fantasma" onClick={() => setEditados({})}>
              Desfazer
            </Button>
          )}
          <Button
            onClick={gravar}
            disabled={!pendentes || invalidos.length > 0 || salvar.isPending}
          >
            {salvar.isPending ? 'Salvando…' : `Salvar${pendentes ? ` (${pendentes})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
