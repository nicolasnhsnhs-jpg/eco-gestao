import { useState } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { hojeISO } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import {
  descontoEmReais,
  porcentagemDoDesconto,
  totalBruto,
  type ModoDesconto,
} from './antecipacao'
import { useAntecipar, useContas } from './api'

/** A conta a receber que vai ser antecipada (vinda dos lançamentos ou das notas). */
export type ContaParaAntecipar = { id: string | null; valor: number | string | null }

type Props = {
  aberto: boolean
  selecionados: ContaParaAntecipar[]
  aoFechar: () => void
  aoAntecipar: () => void
}

/** Antecipar várias contas a receber de uma vez: informa o desconto e onde o dinheiro caiu. */
export function AntecipacaoModal({ aberto, selecionados, aoFechar, aoAntecipar }: Props) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Antecipar recebíveis">
      <Formulario selecionados={selecionados} aoTerminar={aoAntecipar} />
    </Modal>
  )
}

function Formulario({
  selecionados,
  aoTerminar,
}: {
  selecionados: ContaParaAntecipar[]
  aoTerminar: () => void
}) {
  const contas = useContas()
  const antecipar = useAntecipar()
  const ativas = (contas.data ?? []).filter((c) => c.ativo)

  const [data, setData] = useState(hojeISO())
  const [contaEscolhida, setConta] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [modo, setModo] = useState<ModoDesconto>('reais')
  const [descontoTexto, setDescontoTexto] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')

  const conta = contaEscolhida || ativas[0]?.id || ''
  const bruto = totalBruto(selecionados.map((l) => l.valor ?? 0))
  const descontoDigitado =
    modo === 'reais' ? lerValor(descontoTexto) : Number(descontoTexto.replace(',', '.'))
  const descontoValido =
    descontoTexto.trim() !== '' && descontoDigitado != null && Number.isFinite(descontoDigitado)
  const desconto = descontoValido ? descontoEmReais(bruto, modo, descontoDigitado) : 0
  const liquido = Math.round((bruto - desconto) * 100) / 100
  const descontoForaDoLimite = desconto < 0 || desconto >= bruto

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!data) return setErro('Informe a data em que o dinheiro caiu.')
    if (!conta) return setErro('Escolha a conta.')
    if (instituicao.trim().length < 2) return setErro('Informe quem antecipou (ex.: Sicredi).')
    if (!descontoValido) return setErro('Informe o desconto (pode ser zero).')
    if (descontoForaDoLimite) return setErro('O desconto precisa ser menor que o total.')
    try {
      await antecipar.mutateAsync({
        lancamentos: selecionados.map((l) => l.id!),
        data,
        conta_bancaria_id: conta,
        instituicao,
        desconto,
        observacoes,
      })
      aoTerminar()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="rounded-xl bg-fundo-suave p-3 text-sm">
        <p className="text-texto-suave">{selecionados.length} conta(s) a receber</p>
        <p className="text-lg font-bold">{formatarReais(bruto)}</p>
        <p className="mt-1 text-texto-suave">
          Os vencimentos dos clientes continuam registrados. No saldo entra só o valor líquido.
        </p>
      </div>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {contas.isSuccess && ativas.length === 0 && (
        <Aviso tipo="erro">
          Cadastre uma conta bancária antes de antecipar.{' '}
          <Link to="/financeiro/cadastros" className="font-semibold underline">
            Ir para cadastros
          </Link>
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Quem antecipou" htmlFor="instituicao" className="col-span-2">
          <Input
            id="instituicao"
            data-autofocus
            placeholder="Sicredi, financeira…"
            list="instituicoes-antecipacao"
            value={instituicao}
            onChange={(e) => setInstituicao(e.target.value)}
          />
          <datalist id="instituicoes-antecipacao">
            <option value="Sicredi" />
            <option value="Financeira" />
          </datalist>
        </Campo>

        <div className="col-span-2">
          <span className="mb-1 block text-sm font-semibold">Desconto</span>
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-xl border border-borda p-1" role="group">
              {(['reais', 'porcentagem'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={modo === m}
                  onClick={() => {
                    setModo(m)
                    setDescontoTexto('')
                  }}
                  className={cn(
                    'min-h-9 rounded-lg px-3 text-sm font-semibold',
                    modo === m ? 'bg-verde text-white' : 'text-texto-suave hover:bg-lima-claro',
                  )}
                >
                  {m === 'reais' ? 'R$' : '%'}
                </button>
              ))}
            </div>
            <Input
              aria-label={modo === 'reais' ? 'Desconto em reais' : 'Desconto em porcentagem'}
              inputMode="decimal"
              placeholder={modo === 'reais' ? '0,00' : 'ex.: 2,5'}
              value={descontoTexto}
              onChange={(e) =>
                setDescontoTexto(
                  modo === 'reais'
                    ? mascaraValor(e.target.value)
                    : e.target.value.replace(/[^\d,.]/g, ''),
                )
              }
            />
          </div>
        </div>

        <Campo rotulo="Data em que caiu" htmlFor="data_antecipacao">
          <Input
            id="data_antecipacao"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Conta" htmlFor="conta_antecipacao">
          <Select id="conta_antecipacao" value={conta} onChange={(e) => setConta(e.target.value)}>
            {ativas.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Observações" htmlFor="obs_antecipacao" className="col-span-2">
          <Textarea
            id="obs_antecipacao"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </Campo>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-xl border border-borda p-3 text-center text-sm">
        <div>
          <dt className="text-texto-suave">Total</dt>
          <dd className="font-bold">{formatarReais(bruto)}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Desconto</dt>
          <dd className="font-bold text-perigo">
            − {formatarReais(desconto)}
            <span className="block text-xs font-normal text-texto-suave">
              {porcentagemDoDesconto(bruto, desconto).toLocaleString('pt-BR')}%
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-texto-suave">Cai na conta</dt>
          <dd className={cn('font-bold', descontoForaDoLimite ? 'text-perigo' : 'text-verde')}>
            {formatarReais(liquido)}
          </dd>
        </div>
      </dl>

      <Button type="submit" disabled={antecipar.isPending || ativas.length === 0}>
        {antecipar.isPending ? 'Antecipando…' : `Antecipar ${selecionados.length} conta(s)`}
      </Button>
    </form>
  )
}
