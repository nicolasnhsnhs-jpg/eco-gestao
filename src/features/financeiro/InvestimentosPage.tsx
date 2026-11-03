import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDownToLine, ArrowUpFromLine, Pencil, PiggyBank, Plus, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { formatarData, formatarMes, hojeISO, somarMeses } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import {
  useCancelarMovimentoInvestimento,
  useContas,
  useInvestimentos,
  useMovimentosInvestimento,
  useRegistrarMovimentoInvestimento,
  useResumoMensal,
  useSalvarInvestimento,
  type Investimento,
} from './api'
import { NOME_MOVIMENTO_INVESTIMENTO, type TipoMovimentoInvestimento } from './rotulos'

/**
 * /financeiro/investimentos — quanto está investido.
 * O dinheiro aplicado sai da conta, mas fica fora do saldo atual e do projetado.
 */
export function InvestimentosPage() {
  const investimentos = useInvestimentos()
  const movimentos = useMovimentosInvestimento()
  const resumo = useResumoMensal()
  const cancelar = useCancelarMovimentoInvestimento()
  const [editando, setEditando] = useState<Investimento | null | undefined>(undefined)
  const [movimento, setMovimento] = useState<TipoMovimentoInvestimento | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  if (investimentos.isPending) return <Carregando />
  if (investimentos.isError) return <Aviso tipo="erro">{mensagemDeErro(investimentos.error)}</Aviso>

  const ativos = investimentos.data.filter((i) => i.ativo)
  const total = ativos.reduce((s, i) => s + Number(i.saldo_atual ?? 0), 0)
  const rendimento = ativos.reduce((s, i) => s + Number(i.total_rendimento ?? 0), 0)
  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)
  const aplicadoNoMes = (movimentos.data ?? [])
    .filter((m) => !m.cancelado && m.tipo !== 'rendimento' && m.data.slice(0, 7) === mesAtual)
    .reduce((s, m) => s + (m.tipo === 'aporte' ? Number(m.valor) : -Number(m.valor)), 0)
  // O lucro do mês que passou ajuda a decidir quanto investir.
  const mesPassado = resumo.data?.find(
    (m) => m.mes.slice(0, 7) === somarMeses(hoje, -1).slice(0, 7),
  )

  async function cancelarMovimento(id: string) {
    if (!window.confirm('Cancelar este movimento? Ele fica no histórico, mas sai das contas.'))
      return
    setErro(null)
    try {
      await cancelar.mutateAsync(id)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-verde bg-verde p-5 text-white shadow-sm">
          <p className="text-sm text-white/80">Total investido</p>
          <p className="mt-1 font-titulo text-2xl font-bold">{formatarReais(total)}</p>
          <p className="mt-1 text-xs text-white/80">Não entra no saldo atual nem no projetado.</p>
        </div>
        <Card>
          <p className="text-sm text-texto-suave">Aplicado este mês</p>
          <p className="mt-1 font-titulo text-2xl font-bold text-verde-escuro">
            {formatarReais(aplicadoNoMes)}
          </p>
          {mesPassado && (
            <p className="mt-1 text-xs text-texto-suave">
              Resultado de {formatarMes(mesPassado.mes)}: {formatarReais(mesPassado.resultado)}
            </p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-texto-suave">Rendimentos</p>
          <p
            className={cn(
              'mt-1 font-titulo text-2xl font-bold',
              rendimento < 0 ? 'text-perigo' : 'text-verde-escuro',
            )}
          >
            {formatarReais(rendimento)}
          </p>
          <p className="mt-1 text-xs text-texto-suave">Desde o início do controle.</p>
        </Card>
      </div>

      {ativos.length === 0 ? (
        <Aviso>
          Cadastre onde o dinheiro fica aplicado (ex.: CDB Sicredi, poupança). Se já houver valor
          investido, informe o saldo de hoje.
        </Aviso>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMovimento('aporte')}>
            <ArrowDownToLine className="size-5" aria-hidden /> Aplicar
          </Button>
          <Button variante="secundario" onClick={() => setMovimento('resgate')}>
            <ArrowUpFromLine className="size-5" aria-hidden /> Resgatar
          </Button>
          <Button variante="secundario" onClick={() => setMovimento('rendimento')}>
            <TrendingUp className="size-5" aria-hidden /> Atualizar rendimento
          </Button>
        </div>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Aplicações</h2>
          <Button variante="secundario" onClick={() => setEditando(null)}>
            <Plus className="size-4" aria-hidden /> Nova aplicação
          </Button>
        </div>
        {investimentos.data.length === 0 && (
          <p className="text-sm text-texto-suave">Nenhuma aplicação cadastrada.</p>
        )}
        <ul className="divide-y divide-borda">
          {investimentos.data.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <PiggyBank className="size-5 shrink-0 text-verde" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {i.nome}
                  {!i.ativo && <Etiqueta>Inativa</Etiqueta>}
                </p>
                <p className="text-sm text-texto-suave">
                  {[
                    i.instituicao,
                    `aplicado ${formatarReais(i.total_aportado)}`,
                    `rendeu ${formatarReais(i.total_rendimento)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <strong>{formatarReais(i.saldo_atual)}</strong>
              <BotaoIcone rotulo={`Editar ${i.nome}`} onClick={() => setEditando(i)}>
                <Pencil className="size-4" />
              </BotaoIcone>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Histórico</h2>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {movimentos.isPending && <Carregando />}
        {movimentos.data?.length === 0 && (
          <p className="text-sm text-texto-suave">Nenhum movimento ainda.</p>
        )}
        <ul className="divide-y divide-borda">
          {movimentos.data?.map((m) => {
            const saiDoInvestimento = m.tipo === 'resgate' || Number(m.valor) < 0
            return (
              <li
                key={m.id}
                className={cn('flex items-center gap-3 py-3', m.cancelado && 'opacity-60')}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {NOME_MOVIMENTO_INVESTIMENTO[m.tipo]} · {m.investimento?.nome}
                    {m.cancelado && <Etiqueta>Cancelado</Etiqueta>}
                  </p>
                  <p className="truncate text-sm text-texto-suave">
                    {[
                      formatarData(m.data),
                      m.conta &&
                        (m.tipo === 'aporte'
                          ? `saiu de ${m.conta.nome}`
                          : `voltou para ${m.conta.nome}`),
                      m.observacoes,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <strong
                  className={cn(
                    saiDoInvestimento ? 'text-perigo' : 'text-verde',
                    m.cancelado && 'line-through',
                  )}
                >
                  {saiDoInvestimento ? '− ' : '+ '}
                  {formatarReais(Math.abs(Number(m.valor)))}
                </strong>
                {!m.cancelado && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-verde underline"
                    onClick={() => void cancelarMovimento(m.id)}
                  >
                    Cancelar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <Modal
        aberto={editando !== undefined}
        aoFechar={() => setEditando(undefined)}
        titulo={editando ? 'Editar aplicação' : 'Nova aplicação'}
      >
        <FormInvestimento
          investimento={editando ?? null}
          aoTerminar={() => setEditando(undefined)}
        />
      </Modal>
      <Modal
        aberto={!!movimento}
        aoFechar={() => setMovimento(null)}
        titulo={movimento ? TITULO_MOVIMENTO[movimento] : ''}
      >
        {movimento && (
          <FormMovimento
            tipo={movimento}
            investimentos={ativos}
            aoTerminar={() => setMovimento(null)}
          />
        )}
      </Modal>
    </div>
  )
}

const TITULO_MOVIMENTO: Record<TipoMovimentoInvestimento, string> = {
  aporte: 'Aplicar dinheiro',
  resgate: 'Resgatar dinheiro',
  rendimento: 'Atualizar rendimento',
}

// -----------------------------------------------------------------------------
// Cadastro da aplicação
// -----------------------------------------------------------------------------

const esquemaInvestimento = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  instituicao: z.string().trim(),
  saldo_inicial: z.string().refine((v) => v === '' || lerValor(v) !== null, 'Valor inválido.'),
  data_saldo_inicial: z.string().min(1, 'Informe a data.'),
  ativo: z.boolean(),
})
type DadosInvestimento = z.infer<typeof esquemaInvestimento>

function FormInvestimento({
  investimento,
  aoTerminar,
}: {
  investimento: Investimento | null
  aoTerminar: () => void
}) {
  const salvar = useSalvarInvestimento()
  const form = useForm<DadosInvestimento>({
    resolver: zodResolver(esquemaInvestimento),
    defaultValues: {
      nome: investimento?.nome ?? '',
      instituicao: investimento?.instituicao ?? '',
      saldo_inicial: valorParaCampo(Number(investimento?.saldo_inicial ?? 0)),
      data_saldo_inicial: investimento?.data_saldo_inicial ?? hojeISO(),
      ativo: investimento?.ativo ?? true,
    },
  })
  const { errors, isSubmitting } = form.formState
  const saldoCampo = form.register('saldo_inicial')

  async function enviar(d: DadosInvestimento) {
    try {
      await salvar.mutateAsync({
        id: investimento?.id ?? undefined,
        dados: {
          nome: d.nome,
          instituicao: d.instituicao || null,
          saldo_inicial: lerValor(d.saldo_inicial) ?? 0,
          data_saldo_inicial: d.data_saldo_inicial,
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
      <Campo rotulo="Nome" htmlFor="inv-nome" obrigatorio erro={errors.nome?.message}>
        <Input id="inv-nome" placeholder="Ex.: CDB, Poupança, Reserva" {...form.register('nome')} />
      </Campo>
      <Campo rotulo="Banco / corretora" htmlFor="inv-instituicao">
        <Input id="inv-instituicao" {...form.register('instituicao')} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Já investido (R$)" htmlFor="inv-saldo" erro={errors.saldo_inicial?.message}>
          <Input
            id="inv-saldo"
            inputMode="numeric"
            placeholder="0,00"
            {...saldoCampo}
            onChange={(e) => {
              e.target.value = mascaraValor(e.target.value)
              void saldoCampo.onChange(e)
            }}
          />
        </Campo>
        <Campo rotulo="Em" htmlFor="inv-data" erro={errors.data_saldo_inicial?.message}>
          <Input id="inv-data" type="date" {...form.register('data_saldo_inicial')} />
        </Campo>
      </div>
      <p className="text-sm text-texto-suave">
        O valor que já estava aplicado nesta data. Daqui para frente, registre as aplicações pelo
        botão “Aplicar”: o dinheiro sai da conta e vem para cá.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-verde" {...form.register('ativo')} />
        Aplicação ativa
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar aplicação'}
      </Button>
    </form>
  )
}

// -----------------------------------------------------------------------------
// Aplicar, resgatar, atualizar rendimento
// -----------------------------------------------------------------------------

const esquemaMovimento = z.object({
  investimento_id: z.string().min(1, 'Escolha a aplicação.'),
  data: z.string().min(1, 'Informe a data.'),
  valor: z.string().refine((v) => lerValor(v) !== null, 'Informe o valor.'),
  conta_bancaria_id: z.string(),
  observacoes: z.string().trim(),
})
type DadosMovimento = z.infer<typeof esquemaMovimento>

function FormMovimento({
  tipo,
  investimentos,
  aoTerminar,
}: {
  tipo: TipoMovimentoInvestimento
  investimentos: Investimento[]
  aoTerminar: () => void
}) {
  const contas = useContas()
  const registrar = useRegistrarMovimentoInvestimento()
  const contasAtivas = (contas.data ?? []).filter((c) => c.ativo)
  const rendimento = tipo === 'rendimento'

  const form = useForm<DadosMovimento>({
    resolver: zodResolver(esquemaMovimento),
    values: {
      investimento_id: investimentos.length === 1 ? investimentos[0].id! : '',
      data: hojeISO(),
      valor: '',
      conta_bancaria_id: contasAtivas[0]?.id ?? '',
      observacoes: '',
    },
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isSubmitting } = form.formState
  const valorCampo = form.register('valor')
  const [investimentoId, valorTexto] = useWatch({
    control: form.control,
    name: ['investimento_id', 'valor'],
  })
  const escolhido = investimentos.find((i) => i.id === investimentoId)
  const saldoAtual = Number(escolhido?.saldo_atual ?? 0)
  const valor = lerValor(valorTexto ?? '') ?? 0
  // No rendimento a pessoa informa o saldo que o banco mostra; a diferença é o rendimento.
  const diferenca = Math.round((valor - saldoAtual) * 100) / 100

  async function enviar(d: DadosMovimento) {
    const v = lerValor(d.valor)!
    if (rendimento && diferenca === 0) {
      form.setError('valor', { message: 'É o mesmo saldo de agora: não há rendimento a lançar.' })
      return
    }
    if (!rendimento && v <= 0) {
      form.setError('valor', { message: 'Informe o valor.' })
      return
    }
    if (!rendimento && !d.conta_bancaria_id) {
      form.setError('conta_bancaria_id', { message: 'Escolha a conta.' })
      return
    }
    if (tipo === 'resgate' && v > saldoAtual) {
      form.setError('valor', { message: `Só há ${formatarReais(saldoAtual)} nesta aplicação.` })
      return
    }
    try {
      await registrar.mutateAsync({
        investimento_id: d.investimento_id,
        tipo,
        data: d.data,
        valor: rendimento ? diferenca : v,
        conta_bancaria_id: rendimento ? null : d.conta_bancaria_id,
        observacoes: d.observacoes || null,
      })
      aoTerminar()
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      {!rendimento && contas.isSuccess && contasAtivas.length === 0 && (
        <Aviso tipo="erro">
          Cadastre uma conta bancária antes.{' '}
          <Link to="/financeiro/cadastros" className="font-semibold underline">
            Ir para cadastros
          </Link>
        </Aviso>
      )}
      <Campo
        rotulo="Aplicação"
        htmlFor="mov-inv"
        obrigatorio
        erro={errors.investimento_id?.message}
      >
        <Select id="mov-inv" {...form.register('investimento_id')}>
          <option value="">Escolha…</option>
          {investimentos.map((i) => (
            <option key={i.id} value={i.id!}>
              {i.nome} ({formatarReais(i.saldo_atual)})
            </option>
          ))}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo rotulo="Data" htmlFor="mov-data" erro={errors.data?.message}>
          <Input id="mov-data" type="date" {...form.register('data')} />
        </Campo>
        <Campo
          rotulo={rendimento ? 'Saldo no banco hoje (R$)' : 'Valor (R$)'}
          htmlFor="mov-valor"
          obrigatorio
          erro={errors.valor?.message}
        >
          <Input
            id="mov-valor"
            inputMode="numeric"
            placeholder="0,00"
            data-autofocus
            {...valorCampo}
            onChange={(e) => {
              e.target.value = mascaraValor(e.target.value)
              void valorCampo.onChange(e)
            }}
          />
        </Campo>
      </div>
      {rendimento && escolhido && valor > 0 && (
        <p className="rounded-xl bg-fundo-suave p-3 text-sm">
          Hoje no sistema: {formatarReais(saldoAtual)}.{' '}
          <strong className={diferenca < 0 ? 'text-perigo' : 'text-verde-escuro'}>
            {diferenca < 0 ? 'Perda' : 'Rendimento'} de {formatarReais(Math.abs(diferenca))}
          </strong>
          .
        </p>
      )}
      {!rendimento && (
        <Campo
          rotulo={tipo === 'aporte' ? 'Saiu da conta' : 'Voltou para a conta'}
          htmlFor="mov-conta"
          erro={errors.conta_bancaria_id?.message}
          dica={
            tipo === 'aporte'
              ? 'O saldo desta conta diminui; o valor passa a aparecer como investido.'
              : 'O valor volta para o saldo desta conta.'
          }
        >
          <Select id="mov-conta" {...form.register('conta_bancaria_id')}>
            <option value="">Escolha…</option>
            {contasAtivas.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Campo>
      )}
      <Campo rotulo="Observações" htmlFor="mov-obs">
        <Input id="mov-obs" {...form.register('observacoes')} />
      </Campo>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : TITULO_MOVIMENTO[tipo]}
      </Button>
    </form>
  )
}
