import { zodResolver } from '@hookform/resolvers/zod'
import { CreditCard, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO, somarMeses } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import {
  useCartoes,
  useComprasNoCartao,
  useContas,
  usePagarFatura,
  useSalvarCartao,
  type CartaoCredito,
  type LancamentoCompleto,
} from './api'
import { fechamentoDaFatura } from './fatura'

type Fatura = {
  vencimento: string
  compras: LancamentoCompleto[]
  /** O que ainda falta pagar. */
  emAberto: number
  total: number
  paga: boolean
  pagaEm: string | null
}

/** Agrupa as compras de um cartão por fatura (o vencimento delas). */
function faturasDoCartao(compras: LancamentoCompleto[]): Fatura[] {
  const porVencimento = new Map<string, LancamentoCompleto[]>()
  for (const c of compras) {
    const lista = porVencimento.get(c.vencimento!) ?? []
    lista.push(c)
    porVencimento.set(c.vencimento!, lista)
  }
  return [...porVencimento.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([vencimento, lista]) => {
      const abertas = lista.filter((c) => c.status !== 'realizado')
      return {
        vencimento,
        compras: lista,
        emAberto: abertas.reduce((s, c) => s + Number(c.valor), 0),
        total: lista.reduce(
          (s, c) => s + Number(c.status === 'realizado' ? c.valor_pago : c.valor),
          0,
        ),
        paga: abertas.length === 0,
        pagaEm: lista.find((c) => c.status === 'realizado')?.data_pagamento ?? null,
      }
    })
}

/** /financeiro/cartoes — cartões de crédito e as faturas de cada um. */
export function CartoesPage() {
  const cartoes = useCartoes()
  // Faturas pagas: mostra as dos últimos 3 meses.
  const compras = useComprasNoCartao(somarMeses(hojeISO(), -3))
  const [editando, setEditando] = useState<CartaoCredito | null | undefined>(undefined)

  if (cartoes.isPending) return <Carregando />
  if (cartoes.isError) return <Aviso tipo="erro">{mensagemDeErro(cartoes.error)}</Aviso>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">
          Compras no cartão vencem junto com a fatura. Ao pagar a fatura, todas as compras dela são
          confirmadas de uma vez.
        </p>
        <Button variante="secundario" onClick={() => setEditando(null)}>
          <Plus className="size-4" aria-hidden /> Novo cartão
        </Button>
      </div>

      {cartoes.data.length === 0 && (
        <Aviso>
          Cadastre o cartão com o dia do fechamento e o dia do vencimento da fatura. Depois, nos
          lançamentos, escolha a forma “Cartão” e o cartão usado.
        </Aviso>
      )}
      {compras.isError && <Aviso tipo="erro">{mensagemDeErro(compras.error)}</Aviso>}

      {cartoes.data.map((cartao) => (
        <SecaoCartao
          key={cartao.id}
          cartao={cartao}
          compras={(compras.data ?? []).filter((c) => c.cartao_credito_id === cartao.id)}
          carregando={compras.isPending}
          aoEditar={() => setEditando(cartao)}
        />
      ))}

      <Modal
        aberto={editando !== undefined}
        aoFechar={() => setEditando(undefined)}
        titulo={editando ? 'Editar cartão' : 'Novo cartão'}
      >
        <FormCartao cartao={editando ?? null} aoTerminar={() => setEditando(undefined)} />
      </Modal>
    </div>
  )
}

function SecaoCartao({
  cartao,
  compras,
  carregando,
  aoEditar,
}: {
  cartao: CartaoCredito
  compras: LancamentoCompleto[]
  carregando: boolean
  aoEditar: () => void
}) {
  const contas = useContas()
  const [pagando, setPagando] = useState<Fatura | null>(null)
  const faturas = faturasDoCartao(compras)
  const abertas = faturas.filter((f) => !f.paga)
  const pagas = faturas.filter((f) => f.paga).reverse()
  const usado = abertas.reduce((s, f) => s + f.emAberto, 0)
  const conta = contas.data?.find((c) => c.id === cartao.conta_bancaria_id)
  const hoje = hojeISO()

  return (
    <Card className={cn(!cartao.ativo && 'opacity-70')}>
      {/* No celular, os botões descem para a linha de baixo. */}
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <CreditCard className="mt-0.5 size-6 shrink-0 text-verde" aria-hidden />
        <div className="min-w-0 flex-1 basis-52">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {cartao.nome}
            {!cartao.ativo && <Etiqueta>Inativo</Etiqueta>}
          </h2>
          <p className="text-sm text-texto-suave">
            {[
              `Fecha dia ${cartao.dia_fechamento}`,
              `vence dia ${cartao.dia_vencimento}`,
              conta && `paga pela ${conta.nome}`,
              cartao.limite != null &&
                `limite disponível ${formatarReais(Number(cartao.limite) - usado)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {cartao.ativo && (
            <Link
              to={`/financeiro/lancamentos/novo?tipo=saida&cartao=${cartao.id}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-borda px-3 text-sm font-semibold text-verde-escuro hover:bg-lima-claro"
            >
              <Plus className="size-4" aria-hidden /> Compra
            </Link>
          )}
          <BotaoIcone rotulo={`Editar ${cartao.nome}`} onClick={aoEditar}>
            <Pencil className="size-4" />
          </BotaoIcone>
        </div>
      </div>

      {carregando && <Carregando />}
      {!carregando && faturas.length === 0 && (
        <p className="text-sm text-texto-suave">Nenhuma compra lançada neste cartão.</p>
      )}

      <div className="flex flex-col gap-3">
        {abertas.map((f, i) => {
          const fechamento = fechamentoDaFatura(f.vencimento, cartao)
          const fechada = hoje >= fechamento
          const atrasada = f.vencimento < hoje
          return (
            <details
              key={f.vencimento}
              open={i === 0}
              className="rounded-xl border border-borda open:bg-fundo-suave/40"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-semibold">Fatura de {formatarData(f.vencimento)}</span>
                <Etiqueta cor={atrasada ? 'perigo' : fechada ? 'alerta' : 'verde'}>
                  {atrasada
                    ? 'Atrasada'
                    : fechada
                      ? 'Fechada'
                      : `Aberta até ${formatarData(fechamento)}`}
                </Etiqueta>
                <strong className="ml-auto text-perigo">{formatarReais(f.emAberto)}</strong>
              </summary>
              <ListaCompras compras={f.compras} />
              <div className="flex justify-end px-4 pb-4">
                <Button onClick={() => setPagando(f)}>Pagar fatura</Button>
              </div>
            </details>
          )
        })}

        {pagas.map((f) => (
          <details key={f.vencimento} className="rounded-xl border border-borda">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-texto-suave">
              <span className="font-semibold">Fatura de {formatarData(f.vencimento)}</span>
              <Etiqueta>Paga em {formatarData(f.pagaEm)}</Etiqueta>
              <span className="ml-auto font-semibold">{formatarReais(f.total)}</span>
            </summary>
            <ListaCompras compras={f.compras} />
          </details>
        ))}
      </div>

      <Modal aberto={!!pagando} aoFechar={() => setPagando(null)} titulo="Pagar fatura">
        {pagando && (
          <FormPagarFatura cartao={cartao} fatura={pagando} aoTerminar={() => setPagando(null)} />
        )}
      </Modal>
    </Card>
  )
}

function ListaCompras({ compras }: { compras: LancamentoCompleto[] }) {
  return (
    <ul className="divide-y divide-borda border-t border-borda">
      {compras.map((c) => (
        <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
          <Link to={`/financeiro/lancamentos/${c.id}`} className="min-w-0 flex-1 hover:underline">
            <p className="truncate font-semibold">
              {c.descricao}
              {c.parcela_numero && (
                <span className="font-normal text-texto-suave">
                  {' '}
                  ({c.parcela_numero}/{c.parcela_total})
                </span>
              )}
            </p>
            <p className="truncate text-texto-suave">
              {[c.data_compra && `Compra ${formatarData(c.data_compra)}`, c.categoria?.nome]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </Link>
          <span className="shrink-0 font-semibold">
            {formatarReais(c.status === 'realizado' ? c.valor_pago : c.valor)}
          </span>
        </li>
      ))}
    </ul>
  )
}

// -----------------------------------------------------------------------------
// Pagar a fatura
// -----------------------------------------------------------------------------

const esquemaPagamento = z.object({
  data_pagamento: z.string().min(1, 'Informe a data.'),
  conta_bancaria_id: z.string().min(1, 'Escolha a conta.'),
})
type DadosPagamento = z.infer<typeof esquemaPagamento>

function FormPagarFatura({
  cartao,
  fatura,
  aoTerminar,
}: {
  cartao: CartaoCredito
  fatura: Fatura
  aoTerminar: () => void
}) {
  const contas = useContas()
  const pagar = usePagarFatura()
  const ativas = (contas.data ?? []).filter((c) => c.ativo)
  const form = useForm<DadosPagamento>({
    resolver: zodResolver(esquemaPagamento),
    values: {
      data_pagamento: hojeISO(),
      conta_bancaria_id: cartao.conta_bancaria_id ?? ativas[0]?.id ?? '',
    },
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isSubmitting } = form.formState
  const quantas = fatura.compras.filter((c) => c.status !== 'realizado').length

  async function enviar(d: DadosPagamento) {
    try {
      await pagar.mutateAsync({ cartaoId: cartao.id, vencimento: fatura.vencimento, ...d })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      <div className="rounded-xl bg-fundo-suave p-3 text-sm">
        <p className="font-semibold">
          {cartao.nome} · fatura de {formatarData(fatura.vencimento)}
        </p>
        <p className="text-texto-suave">
          {quantas === 1
            ? '1 compra será confirmada como paga.'
            : `${quantas} compras serão confirmadas como pagas.`}
        </p>
        <p className="mt-1 text-lg font-bold">{formatarReais(fatura.emAberto)}</p>
      </div>
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo="Data em que saiu"
          htmlFor="fatura-data"
          erro={errors.data_pagamento?.message}
        >
          <Input id="fatura-data" type="date" {...form.register('data_pagamento')} />
        </Campo>
        <Campo rotulo="Conta" htmlFor="fatura-conta" erro={errors.conta_bancaria_id?.message}>
          <Select id="fatura-conta" {...form.register('conta_bancaria_id')}>
            <option value="">Escolha…</option>
            {ativas.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Button type="submit" disabled={isSubmitting || ativas.length === 0}>
        {isSubmitting ? 'Confirmando…' : 'Confirmar que a fatura foi paga'}
      </Button>
    </form>
  )
}

// -----------------------------------------------------------------------------
// Cadastro do cartão
// -----------------------------------------------------------------------------

const dia = z
  .number({ error: 'Informe o dia.' })
  .int('Use um dia inteiro.')
  .min(1, 'De 1 a 31.')
  .max(31, 'De 1 a 31.')

const esquemaCartao = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  dia_fechamento: dia,
  dia_vencimento: dia,
  conta_bancaria_id: z.string(),
  limite: z.string().refine((v) => v === '' || lerValor(v) !== null, 'Valor inválido.'),
  ativo: z.boolean(),
})
type DadosCartao = z.infer<typeof esquemaCartao>

function FormCartao({
  cartao,
  aoTerminar,
}: {
  cartao: CartaoCredito | null
  aoTerminar: () => void
}) {
  const contas = useContas()
  const salvar = useSalvarCartao()
  const form = useForm<DadosCartao>({
    resolver: zodResolver(esquemaCartao),
    defaultValues: {
      nome: cartao?.nome ?? '',
      dia_fechamento: cartao?.dia_fechamento ?? 5,
      dia_vencimento: cartao?.dia_vencimento ?? 12,
      conta_bancaria_id: cartao?.conta_bancaria_id ?? '',
      limite: cartao?.limite != null ? valorParaCampo(Number(cartao.limite)) : '',
      ativo: cartao?.ativo ?? true,
    },
  })
  const { errors, isSubmitting } = form.formState
  const limiteCampo = form.register('limite')

  async function enviar(d: DadosCartao) {
    try {
      await salvar.mutateAsync({
        id: cartao?.id,
        dados: {
          nome: d.nome,
          dia_fechamento: d.dia_fechamento,
          dia_vencimento: d.dia_vencimento,
          conta_bancaria_id: d.conta_bancaria_id || null,
          limite: d.limite ? lerValor(d.limite) : null,
          ativo: d.ativo,
        },
      })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <Campo rotulo="Nome" htmlFor="cartao-nome" obrigatorio erro={errors.nome?.message}>
        <Input id="cartao-nome" placeholder="Ex.: Sicredi Visa" {...form.register('nome')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo="Dia do vencimento"
          htmlFor="cartao-vencimento"
          obrigatorio
          erro={errors.dia_vencimento?.message}
          dica="Quando a fatura é paga."
        >
          <Input
            id="cartao-vencimento"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            {...form.register('dia_vencimento', { valueAsNumber: true })}
          />
        </Campo>
        <Campo
          rotulo="Dia do fechamento"
          htmlFor="cartao-fechamento"
          obrigatorio
          erro={errors.dia_fechamento?.message}
          dica="Compras a partir deste dia vão para a fatura seguinte."
        >
          <Input
            id="cartao-fechamento"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            {...form.register('dia_fechamento', { valueAsNumber: true })}
          />
        </Campo>
        <Campo rotulo="Conta que paga a fatura" htmlFor="cartao-conta">
          <Select id="cartao-conta" {...form.register('conta_bancaria_id')}>
            <option value="">Escolher na hora</option>
            {(contas.data ?? [])
              .filter((c) => c.ativo || c.id === cartao?.conta_bancaria_id)
              .map((c) => (
                <option key={c.id} value={c.id!}>
                  {c.nome}
                </option>
              ))}
          </Select>
        </Campo>
        <Campo rotulo="Limite (R$)" htmlFor="cartao-limite" erro={errors.limite?.message}>
          <Input
            id="cartao-limite"
            inputMode="numeric"
            placeholder="Opcional"
            {...limiteCampo}
            onChange={(e) => {
              e.target.value = mascaraValor(e.target.value)
              void limiteCampo.onChange(e)
            }}
          />
        </Campo>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-verde" {...form.register('ativo')} />
        Cartão ativo
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar cartão'}
      </Button>
    </form>
  )
}
