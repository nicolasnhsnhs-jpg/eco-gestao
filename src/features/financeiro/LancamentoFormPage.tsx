import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Ban, CheckCircle2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, formatarDataHora, hojeISO, mesDe } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { useEquipe } from '../clientes/api'
import { ClienteSeletor } from '../clientes/ClienteSeletor'
import {
  useAtualizarLancamento,
  useCategorias,
  useContas,
  useCriarLancamentos,
  useFornecedores,
  useLancamento,
  type LancamentoCompleto,
} from './api'
import { ConfirmarModal } from './ConfirmarModal'
import { esquemaLancamento, lancamentoParaBanco, type FormLancamento } from './esquemaLancamento'
import { NovoFornecedorModal } from './NovoFornecedorModal'
import { gerarParcelas } from './parcelas'
import { COR_SITUACAO, EXPLICACAO_STATUS, FORMAS, NOME_SITUACAO, type Situacao } from './rotulos'

/** /financeiro/lancamentos/novo e /financeiro/lancamentos/:id */
export function LancamentoFormPage() {
  const { id } = useParams()
  const lancamento = useLancamento(id)

  if (!id) return <Formulario key="novo" />
  if (lancamento.isPending) return <Carregando />
  if (lancamento.isError) return <Aviso tipo="erro">{mensagemDeErro(lancamento.error)}</Aviso>
  if (!lancamento.data) return <Aviso tipo="erro">Lançamento não encontrado.</Aviso>
  return <Formulario key={lancamento.data.id} lancamento={lancamento.data} />
}

function valoresIniciais(
  l: LancamentoCompleto | undefined,
  parametros: URLSearchParams,
): FormLancamento {
  if (l) {
    return {
      tipo: l.tipo!,
      descricao: l.descricao ?? '',
      cliente_id: l.cliente_id ?? '',
      cliente_nome: l.cliente?.nome_fantasia || l.cliente?.nome || '',
      fornecedor_id: l.fornecedor_id ?? '',
      categoria_id: l.categoria_id ?? '',
      valor: valorParaCampo(l.valor),
      vencimento: l.vencimento ?? '',
      competencia: mesDe(l.competencia ?? ''),
      status: l.status!,
      data_pagamento: l.data_pagamento ?? hojeISO(),
      conta_bancaria_id: l.conta_bancaria_id ?? '',
      forma_pagamento: l.forma_pagamento ?? '',
      numero_nota_fiscal: l.numero_nota_fiscal ?? '',
      parcelas: 1,
      observacoes: l.observacoes ?? '',
    }
  }
  const hoje = hojeISO()
  return {
    tipo: parametros.get('tipo') === 'saida' ? 'saida' : 'entrada',
    descricao: '',
    cliente_id: parametros.get('cliente') ?? '',
    cliente_nome: parametros.get('cliente_nome') ?? '',
    fornecedor_id: '',
    categoria_id: '',
    valor: '',
    vencimento: hoje,
    competencia: mesDe(hoje),
    status: 'pendente',
    data_pagamento: hoje,
    conta_bancaria_id: '',
    forma_pagamento: 'pix',
    numero_nota_fiscal: '',
    parcelas: 1,
    observacoes: '',
  }
}

function Formulario({ lancamento }: { lancamento?: LancamentoCompleto }) {
  const editando = !!lancamento
  const perfil = usePerfil()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const categorias = useCategorias()
  const contas = useContas()
  const fornecedores = useFornecedores()
  const equipe = useEquipe()
  const criar = useCriarLancamentos()
  const atualizar = useAtualizarLancamento()
  const [salvoAgora, setSalvoAgora] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [novoFornecedor, setNovoFornecedor] = useState(false)
  // A competência acompanha o vencimento até a pessoa mudá-la à mão.
  const [competenciaManual, setCompetenciaManual] = useState(editando)

  const bloqueado = editando && lancamento.status === 'realizado' && perfil.papel !== 'admin'

  const form = useForm<FormLancamento>({
    resolver: zodResolver(esquemaLancamento),
    defaultValues: valoresIniciais(lancamento, parametros),
  })
  const { errors, isSubmitting } = form.formState
  const [tipo, status, valorTexto, vencimento, parcelas, clienteId, clienteNome, fornecedorId] =
    useWatch({
      control: form.control,
      name: [
        'tipo',
        'status',
        'valor',
        'vencimento',
        'parcelas',
        'cliente_id',
        'cliente_nome',
        'fornecedor_id',
      ],
    })

  const categoriasDoTipo = (categorias.data ?? []).filter(
    (c) =>
      c.tipo === (tipo === 'entrada' ? 'receita' : 'despesa') &&
      (c.ativo || c.id === lancamento?.categoria_id),
  )
  const contasAtivas = (contas.data ?? []).filter(
    (c) => c.ativo || c.id === lancamento?.conta_bancaria_id,
  )
  const valorNumero = lerValor(valorTexto ?? '') ?? 0
  const previa =
    !editando && parcelas > 1 && valorNumero > 0 && vencimento
      ? gerarParcelas(valorNumero, parcelas, vencimento)
      : []

  async function salvar(dados: FormLancamento, continuar: boolean) {
    try {
      const base = lancamentoParaBanco(dados)

      if (editando) {
        // Lançamento já realizado que continua realizado: mantém o valor pago (juros/desconto).
        const manterPagamento = lancamento.status === 'realizado' && dados.status === 'realizado'
        const { valor_pago, ...resto } = base
        await atualizar.mutateAsync({
          id: lancamento.id!,
          dados: manterPagamento ? resto : { ...resto, valor_pago },
        })
        navegar(-1)
        return
      }

      if (dados.parcelas > 1) {
        const grupo = crypto.randomUUID()
        await criar.mutateAsync(
          gerarParcelas(base.valor, dados.parcelas, dados.vencimento).map((p) => ({
            ...base,
            valor: p.valor,
            vencimento: p.vencimento,
            competencia: p.competencia,
            parcela_numero: p.numero,
            parcela_total: dados.parcelas,
            grupo_parcelamento_id: grupo,
          })),
        )
      } else {
        await criar.mutateAsync([base])
      }

      if (continuar) {
        // "Salvar e lançar outro": mantém tipo, categoria, conta e datas; limpa o resto.
        setSalvoAgora(`“${dados.descricao}” salvo.`)
        form.reset({
          ...dados,
          descricao: '',
          valor: '',
          cliente_id: '',
          cliente_nome: '',
          fornecedor_id: '',
          numero_nota_fiscal: '',
          parcelas: 1,
          observacoes: '',
        })
        // Espera a tela redesenhar o formulário limpo antes de pôr o cursor na descrição.
        setTimeout(() => form.setFocus('descricao'))
      } else {
        navegar('/financeiro/lancamentos')
      }
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function mudarStatus(novo: 'cancelado' | 'pendente', pergunta: string) {
    if (!window.confirm(pergunta)) return
    try {
      await atualizar.mutateAsync({ id: lancamento!.id!, dados: { status: novo } })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  const valorCampo = form.register('valor')
  const vencimentoCampo = form.register('vencimento')
  const nomeDe = (id: string | null) => equipe.data?.find((p) => p.id === id)?.nome ?? '—'
  const situacao = (lancamento?.situacao ?? lancamento?.status) as Situacao | undefined
  const emAberto = lancamento?.status === 'pendente' || lancamento?.status === 'agendado'

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navegar(-1)}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar
      </button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {editando
              ? lancamento.descricao
              : tipo === 'entrada'
                ? 'Nova conta a receber'
                : 'Nova conta a pagar'}
          </h1>
          {editando && situacao && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Etiqueta cor={COR_SITUACAO[situacao]}>{NOME_SITUACAO[situacao]}</Etiqueta>
              <span className="font-bold">{formatarReais(lancamento.valor)}</span>
              {lancamento.parcela_numero && (
                <span className="text-sm text-texto-suave">
                  Parcela {lancamento.parcela_numero} de {lancamento.parcela_total}
                </span>
              )}
            </div>
          )}
        </div>
        {editando && (
          <div className="flex flex-wrap gap-2">
            {emAberto && (
              <Button onClick={() => setConfirmando(true)}>
                <CheckCircle2 className="size-5" aria-hidden />
                {lancamento.tipo === 'entrada' ? 'Confirmar recebimento' : 'Confirmar pagamento'}
              </Button>
            )}
            {emAberto && (
              <Button
                variante="secundario"
                onClick={() =>
                  void mudarStatus('cancelado', 'Cancelar este lançamento? Ele fica no histórico.')
                }
              >
                <Ban className="size-4" aria-hidden /> Cancelar lançamento
              </Button>
            )}
            {lancamento.status !== 'pendente' && !emAberto && perfil.papel === 'admin' && (
              <Button
                variante="secundario"
                onClick={() =>
                  void mudarStatus(
                    'pendente',
                    'Reabrir este lançamento? Ele volta a ficar pendente e sai do saldo.',
                  )
                }
              >
                <RotateCcw className="size-4" aria-hidden /> Reabrir
              </Button>
            )}
          </div>
        )}
      </header>

      {salvoAgora && <Aviso tipo="sucesso">{salvoAgora} Pode lançar o próximo.</Aviso>}
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      {bloqueado && (
        <Aviso>
          Este lançamento já foi confirmado e entrou no saldo. Só o administrador pode alterá-lo.
        </Aviso>
      )}

      {editando && lancamento.status === 'realizado' && (
        <Card className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-texto-suave">
              {lancamento.tipo === 'entrada' ? 'Recebido em' : 'Pago em'}:
            </span>{' '}
            <strong>{formatarData(lancamento.data_pagamento)}</strong>
          </p>
          <p>
            <span className="text-texto-suave">Valor:</span>{' '}
            <strong>{formatarReais(lancamento.valor_pago)}</strong>
          </p>
          <p>
            <span className="text-texto-suave">Conta:</span>{' '}
            <strong>{lancamento.conta?.nome}</strong>
          </p>
          <p>
            <span className="text-texto-suave">Confirmado por:</span>{' '}
            <strong>{nomeDe(lancamento.confirmado_por)}</strong> em{' '}
            {formatarDataHora(lancamento.confirmado_em)}
          </p>
        </Card>
      )}

      <form
        onSubmit={form.handleSubmit((d) => salvar(d, false))}
        noValidate
        className="flex flex-col gap-5"
      >
        <fieldset disabled={bloqueado} className="flex flex-col gap-5">
          <Card className="grid gap-4 sm:grid-cols-2">
            {!editando && (
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:max-w-sm">
                {(['entrada', 'saida'] as const).map((t) => (
                  <label
                    key={t}
                    className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-borda font-semibold has-checked:border-verde has-checked:bg-lima-claro has-checked:text-verde-escuro"
                  >
                    <input
                      type="radio"
                      value={t}
                      className="sr-only"
                      {...form.register('tipo', {
                        onChange: () => form.setValue('categoria_id', ''),
                      })}
                    />
                    {t === 'entrada' ? 'A receber' : 'A pagar'}
                  </label>
                ))}
              </div>
            )}

            <Campo
              rotulo="Descrição"
              htmlFor="descricao"
              obrigatorio
              erro={errors.descricao?.message}
              className="sm:col-span-2"
            >
              <Input
                id="descricao"
                autoFocus={!editando}
                placeholder={tipo === 'entrada' ? 'Ex.: Limpeza de coifa' : 'Ex.: Combustível'}
                aria-invalid={!!errors.descricao}
                {...form.register('descricao')}
              />
            </Campo>

            {tipo === 'entrada' ? (
              <Campo rotulo="Cliente" htmlFor="cliente" className="sm:col-span-2">
                <ClienteSeletor
                  id="cliente"
                  valor={clienteId ? { id: clienteId, nome: clienteNome } : null}
                  aoMudar={(c) => {
                    form.setValue('cliente_id', c?.id ?? '')
                    form.setValue('cliente_nome', c?.nome ?? '')
                  }}
                />
              </Campo>
            ) : (
              <Campo rotulo="Fornecedor" htmlFor="fornecedor" className="sm:col-span-2">
                <div className="flex gap-2">
                  {/* Controlado (value=…): um fornecedor recém-criado aparece selecionado assim que entra na lista. */}
                  <Select
                    id="fornecedor"
                    value={fornecedorId}
                    onChange={(e) => form.setValue('fornecedor_id', e.target.value)}
                  >
                    <option value="">Sem fornecedor</option>
                    {(fornecedores.data ?? [])
                      .filter((f) => f.ativo || f.id === lancamento?.fornecedor_id)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                  </Select>
                  <Button
                    variante="secundario"
                    className="shrink-0"
                    onClick={() => setNovoFornecedor(true)}
                  >
                    Novo
                  </Button>
                </div>
              </Campo>
            )}

            <Campo
              rotulo="Categoria"
              htmlFor="categoria"
              obrigatorio
              erro={errors.categoria_id?.message}
            >
              <Select
                id="categoria"
                aria-invalid={!!errors.categoria_id}
                {...form.register('categoria_id')}
              >
                <option value="">Escolha…</option>
                {categoriasDoTipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo
              rotulo={parcelas > 1 ? 'Valor total (R$)' : 'Valor (R$)'}
              htmlFor="valor"
              obrigatorio
              erro={errors.valor?.message}
            >
              <Input
                id="valor"
                inputMode="numeric"
                placeholder="0,00"
                aria-invalid={!!errors.valor}
                {...valorCampo}
                onChange={(e) => {
                  e.target.value = mascaraValor(e.target.value)
                  void valorCampo.onChange(e)
                }}
              />
            </Campo>

            <Campo
              rotulo={parcelas > 1 ? '1º vencimento' : 'Vencimento'}
              htmlFor="vencimento"
              obrigatorio
              erro={errors.vencimento?.message}
            >
              <Input
                id="vencimento"
                type="date"
                {...vencimentoCampo}
                onChange={(e) => {
                  void vencimentoCampo.onChange(e)
                  if (!competenciaManual && e.target.value) {
                    form.setValue('competencia', mesDe(e.target.value))
                  }
                }}
              />
            </Campo>

            <Campo
              rotulo="Competência (mês do faturamento)"
              htmlFor="competencia"
              erro={errors.competencia?.message}
              dica="Mês a que o valor pertence. Para o fluxo de caixa vale a data do pagamento."
            >
              <Input
                id="competencia"
                type="month"
                {...form.register('competencia', { onChange: () => setCompetenciaManual(true) })}
              />
            </Campo>

            {!editando && (
              <Campo
                rotulo="Parcelas"
                htmlFor="parcelas"
                erro={errors.parcelas?.message}
                dica={parcelas > 1 ? 'Uma por mês, a partir do 1º vencimento.' : 'À vista = 1'}
              >
                <Input
                  id="parcelas"
                  type="number"
                  min={1}
                  max={60}
                  inputMode="numeric"
                  {...form.register('parcelas', { valueAsNumber: true })}
                />
              </Campo>
            )}

            <Campo rotulo="Nº da nota fiscal" htmlFor="nf">
              <Input id="nf" {...form.register('numero_nota_fiscal')} />
            </Campo>

            {previa.length > 0 && (
              <div className="rounded-xl bg-fundo-suave p-3 text-sm sm:col-span-2">
                <p className="mb-1 font-semibold">Parcelas que serão criadas:</p>
                <ul className="grid gap-x-4 sm:grid-cols-2">
                  {previa.map((p) => (
                    <li key={p.numero}>
                      {p.numero}/{previa.length} · {formatarData(p.vencimento)} ·{' '}
                      {formatarReais(p.valor)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Situação</h2>
            <fieldset className="sm:col-span-2">
              <legend className="sr-only">Situação</legend>
              <div className="grid grid-cols-3 gap-2">
                {(['pendente', 'agendado', 'realizado'] as const).map((s) => (
                  <label
                    key={s}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-borda text-sm font-semibold',
                      'has-checked:border-verde has-checked:bg-lima-claro has-checked:text-verde-escuro',
                      // Na edição: em aberto alterna entre pendente/agendado (confirmar é pelo botão);
                      // já realizado mostra só "realizado".
                      editando &&
                        (s === 'realizado' ? lancamento.status !== 'realizado' : !emAberto) &&
                        'hidden',
                    )}
                  >
                    <input
                      type="radio"
                      value={s}
                      className="sr-only"
                      {...form.register('status')}
                    />
                    {s === 'realizado'
                      ? tipo === 'entrada'
                        ? 'Já recebido'
                        : 'Já pago'
                      : NOME_SITUACAO[s]}
                  </label>
                ))}
              </div>
              {status !== 'cancelado' && (
                <p className="mt-2 text-sm text-texto-suave">{EXPLICACAO_STATUS[status]}</p>
              )}
            </fieldset>

            {status === 'realizado' && (
              <Campo
                rotulo={tipo === 'entrada' ? 'Data em que entrou' : 'Data em que saiu'}
                htmlFor="data_pagamento"
                erro={errors.data_pagamento?.message}
              >
                <Input id="data_pagamento" type="date" {...form.register('data_pagamento')} />
              </Campo>
            )}

            <Campo
              rotulo="Conta"
              htmlFor="conta"
              erro={errors.conta_bancaria_id?.message}
              dica={status === 'realizado' ? undefined : 'Opcional enquanto estiver em aberto.'}
            >
              <Select id="conta" {...form.register('conta_bancaria_id')}>
                <option value="">{status === 'realizado' ? 'Escolha…' : 'Ainda não sei'}</option>
                {contasAtivas.map((c) => (
                  <option key={c.id} value={c.id!}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo rotulo="Forma de pagamento" htmlFor="forma">
              <Select id="forma" {...form.register('forma_pagamento')}>
                <option value="">—</option>
                {FORMAS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </Select>
            </Campo>

            <Campo rotulo="Observações" htmlFor="obs" className="sm:col-span-2">
              <Textarea id="obs" {...form.register('observacoes')} />
            </Campo>
          </Card>

          {!bloqueado && (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                to="/financeiro/lancamentos"
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
              >
                Cancelar
              </Link>
              {!editando && (
                <Button
                  variante="secundario"
                  disabled={isSubmitting}
                  onClick={form.handleSubmit((d) => salvar(d, true))}
                >
                  Salvar e lançar outro
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar'}
              </Button>
            </div>
          )}
        </fieldset>
      </form>

      {editando && (
        <p className="text-xs text-texto-suave">
          Criado por {nomeDe(lancamento.criado_por)} em {formatarDataHora(lancamento.criado_em)}
          {lancamento.atualizado_por &&
            ` · última alteração por ${nomeDe(lancamento.atualizado_por)} em ${formatarDataHora(
              lancamento.atualizado_em,
            )}`}
        </p>
      )}

      <ConfirmarModal
        lancamento={confirmando && lancamento ? lancamento : null}
        aoFechar={() => setConfirmando(false)}
      />
      <NovoFornecedorModal
        aberto={novoFornecedor}
        aoFechar={() => setNovoFornecedor(false)}
        aoCriar={(id) => form.setValue('fornecedor_id', id)}
      />
    </div>
  )
}
