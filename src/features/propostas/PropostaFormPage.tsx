import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, Pin, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { SelectForm } from '@/components/ui/SelectForm'
import { hojeISO, somarDias } from '@/lib/datas'
import { formatarReais, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { formatarTelefone } from '@/lib/documentos'
import { juntarEmails } from '@/lib/emails'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { equipeComercial, useCliente, useEquipe } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import {
  useProposta,
  useSalvarProposta,
  useAnterioresDoCliente,
  type PagamentoFixo,
  type PropostaCompleta,
} from './api'
import { introducaoContrato, textoContratoPadrao } from './contratual'
import {
  esquemaProposta,
  formParaBase,
  ITEM_VAZIO,
  propostaParaBanco,
  TAXA_VAZIA,
  totalDoItem,
  totalDosItens,
  type FormItem,
  type FormProposta,
} from './esquema'
import {
  assuntoDosItens,
  COBRANCAS,
  FREQUENCIAS,
  introducaoPadrao,
  MODELOS,
  modeloDe,
  recursosDoModelo,
  valorFrequencia,
  ehCartao,
  ehPix,
  type ChaveModelo,
} from './modelos'
import { valoresDoContrato, valorAnualDosItens } from './pdf/dadosPdf'
import { PreviaPdf } from './pdf/PdfProposta'
import { pdfDaProposta, taxasDoItem, useVendedorPdf } from './pdf/usoPdf'

/** /propostas/nova e /propostas/:id/editar */
export function PropostaFormPage() {
  const { id } = useParams()
  const proposta = useProposta(id)
  if (!id) return <Formulario />
  if (proposta.isPending) return <Carregando />
  if (!proposta.data) return <Aviso tipo="erro">Proposta não encontrada.</Aviso>
  return <Formulario proposta={proposta.data} />
}

const VALIDADE_PADRAO_DIAS = 15

const sem = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function valoresIniciais(
  proposta: PropostaCompleta | undefined,
  parametros: URLSearchParams,
  vendedorId: string,
): FormProposta {
  if (proposta) {
    return {
      tipo: proposta.tipo === 'contrato' ? 'contrato' : 'avulsa',
      contrato_valor_anual:
        proposta.contrato_valor_anual == null
          ? ''
          : valorParaCampo(Number(proposta.contrato_valor_anual)),
      contrato_parcelas: proposta.contrato_parcelas?.toString() ?? '12',
      contrato_modelo: proposta.contrato_modelo === 'completo' ? 'completo' : 'tradicional',
      cliente_id: proposta.cliente_id!,
      cliente_nome: proposta.cliente?.nome_fantasia || proposta.cliente?.nome || '',
      endereco_id: proposta.endereco_id ?? '',
      vendedor_id: proposta.vendedor_id!,
      data_envio: proposta.data_envio!,
      validade: proposta.validade ?? '',
      contato_nome: proposta.contato_nome ?? '',
      contato_telefone: proposta.contato_telefone ?? '',
      contato_email: proposta.contato_email ?? '',
      introducao: proposta.introducao ?? '',
      prazo_pagamento_dias: proposta.prazo_pagamento_dias?.toString() ?? '',
      condicao_pagamento: proposta.condicao_pagamento ?? '',
      cartao_parcelas: proposta.cartao_parcelas?.toString() ?? '',
      pagamento_fixo: proposta.pagamento_fixo ?? false,
      cartao_juros: proposta.cartao_juros ?? false,
      acrescimo_fora_horario:
        proposta.acrescimo_fora_horario == null
          ? ''
          : valorParaCampo(Number(proposta.acrescimo_fora_horario)),
      custos_detalhados: proposta.custos_detalhados ?? true,
      observacoes: proposta.observacoes ?? '',
      itens: proposta.itens.map((i) => ({
        modelo: i.modelo ?? '',
        tipo_servico_id: i.tipo_servico_id ?? '',
        titulo: i.titulo ?? '',
        escopo: i.escopo ?? '',
        metodologia: i.metodologia ?? '',
        recursos: i.recursos ?? '',
        descricao: i.descricao,
        quantidade: String(i.quantidade).replace('.', ','),
        valor_unitario: valorParaCampo(i.valor_unitario),
        periodicidade_meses: valorFrequencia(i.periodicidade_meses, i.frequencia),
        cobranca: (i.cobranca as FormItem['cobranca']) ?? 'unica',
        taxas_adicionais: taxasDoItem(i.taxas_adicionais).map((t) => ({
          descricao: t.descricao,
          valor: valorParaCampo(t.valor),
        })),
        texto_contrato: i.texto_contrato ?? '',
      })),
    }
  }
  const hoje = hojeISO()
  return {
    tipo: parametros.get('tipo') === 'contrato' ? 'contrato' : 'avulsa',
    contrato_valor_anual: '',
    contrato_parcelas: '12',
    contrato_modelo: 'tradicional',
    cliente_id: parametros.get('cliente') ?? '',
    cliente_nome: parametros.get('cliente_nome') ?? '',
    endereco_id: '',
    vendedor_id: vendedorId,
    data_envio: hoje,
    validade: somarDias(hoje, VALIDADE_PADRAO_DIAS),
    contato_nome: '',
    contato_telefone: '',
    contato_email: '',
    introducao: '',
    prazo_pagamento_dias: '28',
    condicao_pagamento: 'boleto bancário',
    cartao_parcelas: '',
    cartao_juros: false,
    pagamento_fixo: false,
    acrescimo_fora_horario: valorParaCampo(UNIDADE.proposta.acrescimoPadrao),
    custos_detalhados: true,
    observacoes: '',
    itens: [{ ...ITEM_VAZIO }],
  }
}

function Formulario({ proposta }: { proposta?: PropostaCompleta }) {
  const editando = !!proposta
  const perfil = usePerfil()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const tipos = useTiposServico()
  const equipe = useEquipe()
  const salvar = useSalvarProposta()
  const ehVendedor = perfil.papel === 'vendedor'
  const [mostrarPrevia, setMostrarPrevia] = useState(true)

  const form = useForm<FormProposta>({
    resolver: zodResolver(esquemaProposta),
    defaultValues: valoresIniciais(
      proposta,
      parametros,
      ehVendedor ? perfil.id : (parametros.get('vendedor') ?? ''),
    ),
  })
  const { errors, isSubmitting } = form.formState
  const itens = useFieldArray({ control: form.control, name: 'itens' })
  const valores = useWatch({ control: form.control }) as FormProposta
  const { cliente_id: clienteId, cliente_nome: clienteNome, vendedor_id: vendedorId } = valores

  const cliente = useCliente(clienteId)
  const vendedor = useVendedorPdf(vendedorId)
  const enderecos = cliente.data?.enderecos ?? []
  const comerciais = equipeComercial(equipe.data)
  const total = totalDosItens(valores.itens ?? [])

  // Cliente escolhido (proposta nova): puxa o pagamento fixo do cliente (se houver)
  // e o "A/C" da última proposta dele; sem proposta anterior, o contato principal
  // do cadastro. Roda uma vez por cliente escolhido e não altera o cadastro.
  const anteriores = useAnterioresDoCliente(clienteId, proposta?.id ?? undefined)
  const pagamentoFixo = anteriores.data?.fixo ?? null
  const preenchidoPara = useRef<string | null>(null)
  useEffect(() => {
    const c = cliente.data
    if (!c || editando || c.id !== clienteId || anteriores.isPending) return
    if (preenchidoPara.current === c.id) return
    preenchidoPara.current = c.id
    const { fixo, contato: ultimo } = anteriores.data ?? {}

    form.setValue(
      'prazo_pagamento_dias',
      fixo ? (fixo.prazo_pagamento_dias?.toString() ?? '') : '28',
    )
    form.setValue('condicao_pagamento', fixo?.condicao_pagamento ?? 'boleto bancário')
    form.setValue('cartao_parcelas', fixo?.cartao_parcelas?.toString() ?? '')
    form.setValue('cartao_juros', fixo?.cartao_juros ?? false)
    form.setValue('pagamento_fixo', !!fixo)

    const { contato_nome, contato_telefone, contato_email } = form.getValues()
    if (contato_nome || contato_telefone || contato_email) return
    if (ultimo && (ultimo.contato_nome || ultimo.contato_telefone || ultimo.contato_email)) {
      form.setValue('contato_nome', ultimo.contato_nome ?? '')
      form.setValue('contato_telefone', ultimo.contato_telefone ?? '')
      form.setValue('contato_email', ultimo.contato_email ?? '')
      return
    }
    const contato = c.contatos_cliente?.[0]
    const tratamento = contato?.nome
      ? `${contato.nome}${contato.cargo ? ` - ${contato.cargo}` : ''}`
      : ''
    form.setValue('contato_nome', tratamento)
    form.setValue(
      'contato_telefone',
      formatarTelefone(contato?.telefone || c.whatsapp || c.telefone) || '',
    )
    form.setValue(
      'contato_email',
      contato?.email || juntarEmails([c.email, ...(c.emails_extras ?? [])]),
    )
  }, [cliente.data, clienteId, editando, form, anteriores.isPending, anteriores.data])

  function aoEscolherCliente(c: ClienteEscolhido | null) {
    preenchidoPara.current = null
    form.setValue('cliente_id', c?.id ?? '', { shouldValidate: !!c })
    form.setValue('cliente_nome', c?.nome ?? '')
    form.setValue('endereco_id', '')
    form.setValue('contato_nome', '')
    form.setValue('contato_telefone', '')
    form.setValue('contato_email', '')
    if (!ehVendedor && c?.vendedorId && comerciais.some((p) => p.id === c.vendedorId)) {
      form.setValue('vendedor_id', c.vendedorId, { shouldValidate: true })
    }
  }

  async function enviar(dados: FormProposta) {
    try {
      const { dados: propostaDados, itens: itensBanco } = propostaParaBanco(dados)
      const idSalvo = await salvar.mutateAsync({
        id: proposta?.id ?? undefined,
        dados: propostaDados,
        itens: itensBanco,
      })
      navegar(`/propostas/${idSalvo}?salva=1`, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const nomeApresentacao = cliente.data?.nome_fantasia || cliente.data?.nome || clienteNome
  const base = formParaBase(valores, proposta?.numero)
  const contrato = valores.tipo === 'contrato'
  const completo = contrato && valores.contrato_modelo === 'completo'
  const contratoCalculado = valoresDoContrato(base)

  const chavePrevia = JSON.stringify([base, cliente.data?.id, valores.endereco_id, vendedor.data])

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={editando ? `/propostas/${proposta.id}` : '/propostas'}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {editando ? `Editar proposta ${proposta.numero}` : 'Nova proposta'}
        </h1>
        <Button variante="fantasma" onClick={() => setMostrarPrevia((v) => !v)}>
          {mostrarPrevia ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
          {mostrarPrevia ? 'Esconder prévia' : 'Mostrar prévia'}
        </Button>
      </div>

      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}

      <div className={mostrarPrevia ? 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}>
        <form
          onSubmit={form.handleSubmit(enviar)}
          noValidate
          className="flex min-w-0 flex-col gap-5"
        >
          {/* ---- Avulso ou contrato ---- */}
          <Card className="flex flex-col gap-3">
            <h2 className="font-bold">Tipo de proposta</h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de proposta">
              {(
                [
                  ['avulsa', 'Serviço avulso', 'Valor do serviço, pago uma vez.'],
                  ['contrato', 'Contrato', 'Valor anual, pago em parcelas mensais.'],
                ] as const
              ).map(([valor, nome, dica]) => {
                const marcado = valores.tipo === valor
                return (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={marcado}
                    onClick={() => form.setValue('tipo', valor, { shouldDirty: true })}
                    className={`min-h-11 rounded-xl border-2 p-3 text-left ${
                      marcado
                        ? 'border-verde bg-lima-claro text-verde-escuro'
                        : 'border-borda hover:border-verde'
                    }`}
                  >
                    <strong className="block">{nome}</strong>
                    <span className="text-sm text-texto-suave">{dica}</span>
                  </button>
                )
              })}
            </div>
            {contrato && (
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label="Modelo da proposta de contrato"
              >
                {(
                  [
                    ['tradicional', 'Proposta tradicional', 'O modelo de sempre, com valor anual.'],
                    [
                      'completo',
                      'Proposta contratual completa',
                      'Memorial descritivo: texto técnico de cada serviço e valor mensal.',
                    ],
                  ] as const
                ).map(([valor, nome, dica]) => {
                  const marcado = valores.contrato_modelo === valor
                  return (
                    <button
                      key={valor}
                      type="button"
                      role="radio"
                      aria-checked={marcado}
                      onClick={() => form.setValue('contrato_modelo', valor, { shouldDirty: true })}
                      className={`min-h-11 rounded-xl border p-3 text-left text-sm ${
                        marcado
                          ? 'border-verde bg-lima-claro text-verde-escuro'
                          : 'border-borda hover:border-verde'
                      }`}
                    >
                      <strong className="block">{nome}</strong>
                      <span className="text-texto-suave">{dica}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ---- Cliente ---- */}
          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Cliente</h2>
            <Campo
              rotulo="Cliente"
              htmlFor="cliente"
              obrigatorio
              erro={errors.cliente_id?.message}
              className="sm:col-span-2"
            >
              {editando ? (
                <p className="flex min-h-11 items-center font-semibold">{clienteNome}</p>
              ) : (
                <ClienteSeletor
                  id="cliente"
                  valor={clienteId ? { id: clienteId, nome: clienteNome } : null}
                  aoMudar={aoEscolherCliente}
                />
              )}
            </Campo>

            {enderecos.length > 1 && (
              <Campo
                rotulo="Endereço / unidade"
                htmlFor="endereco"
                className="sm:col-span-2"
                dica="Vai no PDF, embaixo do nome do cliente."
              >
                <SelectForm id="endereco" control={form.control} name="endereco_id">
                  <option value="">Endereço principal</option>
                  {enderecos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {[e.apelido, `${e.logradouro}, ${e.numero ?? 's/n'}`, e.cidade]
                        .filter(Boolean)
                        .join(' · ')}
                    </option>
                  ))}
                </SelectForm>
              </Campo>
            )}

            <Campo rotulo="A/C (contato)" htmlFor="contato_nome" dica="Ex.: Sra. Camila - Compras">
              <Input id="contato_nome" {...form.register('contato_nome')} />
            </Campo>
            <Campo rotulo="Telefone do contato" htmlFor="contato_telefone">
              <Input id="contato_telefone" inputMode="tel" {...form.register('contato_telefone')} />
            </Campo>
            <Campo
              rotulo="E-mail do contato"
              htmlFor="contato_email"
              className="sm:col-span-2"
              dica="Mais de um? Separe com ponto e vírgula."
            >
              <Input id="contato_email" {...form.register('contato_email')} />
            </Campo>

            <Campo
              rotulo="Vendedor"
              htmlFor="vendedor"
              obrigatorio
              erro={errors.vendedor_id?.message}
            >
              {ehVendedor ? (
                <p className="flex min-h-11 items-center">{perfil.nome}</p>
              ) : (
                <SelectForm id="vendedor" control={form.control} name="vendedor_id">
                  <option value="">Escolha…</option>
                  {comerciais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </SelectForm>
              )}
            </Campo>
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Data" htmlFor="data_envio" erro={errors.data_envio?.message}>
                <Input id="data_envio" type="date" {...form.register('data_envio')} />
              </Campo>
              <Campo rotulo="Válida até" htmlFor="validade" erro={errors.validade?.message}>
                <Input id="validade" type="date" {...form.register('validade')} />
              </Campo>
            </div>
          </Card>

          {/* ---- Serviços ---- */}
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="font-bold">Serviços</h2>
              <p className="text-sm text-texto-suave">
                Escolha o serviço e o texto do modelo já entra. Ajuste o que precisar: linha
                começando com “-” vira marcador e **assim** sai em negrito.
              </p>
            </div>
            {errors.itens?.root?.message && <Aviso tipo="erro">{errors.itens.root.message}</Aviso>}
            {errors.itens?.message && <Aviso tipo="erro">{errors.itens.message}</Aviso>}

            {itens.fields.map((campo, i) => (
              <ItemServico
                key={campo.id}
                form={form}
                i={i}
                tipos={tipos.data ?? []}
                podeRemover={itens.fields.length > 1}
                remover={() => itens.remove(i)}
                completo={completo}
              />
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variante="secundario" onClick={() => itens.append({ ...ITEM_VAZIO })}>
                <Plus className="size-4" aria-hidden /> Adicionar outro serviço
              </Button>
              <p className="text-lg">
                Total: <strong>{formatarReais(total)}</strong>
              </p>
            </div>
          </Card>

          {/* ---- Textos e custos ---- */}
          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Apresentação e custos</h2>
            {completo && (
              <div className="grid gap-4 rounded-xl bg-fundo-suave p-3 sm:col-span-2 sm:grid-cols-2">
                <p className="text-sm sm:col-span-2">
                  <strong>Contrato completo:</strong> o PDF sai como memorial descritivo, com o
                  texto técnico de cada serviço, atendimento, corpo técnico e o investimento com o
                  valor de cada serviço (use a cobrança “Por mês” nos serviços mensais).
                </p>
                <Campo
                  rotulo="Período do contrato (meses)"
                  htmlFor="parcelas"
                  erro={errors.contrato_parcelas?.message}
                >
                  <Input
                    id="parcelas"
                    inputMode="numeric"
                    {...form.register('contrato_parcelas')}
                  />
                </Campo>
              </div>
            )}
            {contrato && !completo && (
              <div className="grid gap-4 rounded-xl bg-fundo-suave p-3 sm:col-span-2 sm:grid-cols-2">
                <p className="text-sm sm:col-span-2">
                  <strong>Contrato:</strong> o PDF mostra o valor anual, os serviços que ele
                  contempla (com a frequência) e as parcelas mensais.
                </p>
                <CampoValor
                  form={form}
                  nome="contrato_valor_anual"
                  rotulo="Valor anual do contrato (R$)"
                  placeholder={valorParaCampo(valorAnualDosItens(base.itens))}
                  dica="Em branco: a soma dos serviços no ano (o valor em cinza)."
                  erro={errors.contrato_valor_anual?.message}
                />
                <Campo
                  rotulo="Parcelas mensais"
                  htmlFor="parcelas"
                  erro={errors.contrato_parcelas?.message}
                  dica={`${contratoCalculado.parcelas}× de ${formatarReais(contratoCalculado.parcela)}`}
                >
                  <Input
                    id="parcelas"
                    inputMode="numeric"
                    {...form.register('contrato_parcelas')}
                  />
                </Campo>
              </div>
            )}
            <Campo
              rotulo="Apresentação"
              htmlFor="introducao"
              className="sm:col-span-2"
              dica="Em branco, vai o texto padrão (o que aparece aqui dentro, em cinza)."
            >
              <Textarea
                id="introducao"
                rows={4}
                placeholder={(completo
                  ? introducaoContrato(nomeApresentacao || '...')
                  : introducaoPadrao(
                      nomeApresentacao || '...',
                      assuntoDosItens(valores.itens ?? []),
                    )
                ).replace(/\*\*/g, '')}
                {...form.register('introducao')}
              />
            </Campo>
            <CamposPagamento form={form} fixo={pagamentoFixo} temCliente={!!clienteId} />
            <CampoValor
              form={form}
              nome="acrescimo_fora_horario"
              rotulo="Acréscimo fora do horário (R$)"
              dica="Após as 18h, fins de semana, feriados e deslocamento sem êxito. Em branco: sem acréscimo."
              erro={errors.acrescimo_fora_horario?.message}
            />
            <label className="flex items-center gap-3 self-center rounded-xl border border-borda p-3">
              <input
                type="checkbox"
                className="size-5 accent-verde"
                {...form.register('custos_detalhados')}
              />
              <span className="text-sm">
                <strong>Mostrar o valor de cada serviço</strong>
                <br />
                <span className="text-texto-suave">Desmarcado, o PDF mostra só o total.</span>
              </span>
            </label>
            <Campo
              rotulo="Observações (vão nos custos)"
              htmlFor="obs"
              className="sm:col-span-2"
              dica="Ex.: **Obs.:** valores considerando a execução dos serviços em conjunto."
            >
              <Textarea id="obs" rows={3} {...form.register('observacoes')} />
            </Campo>
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              to={editando ? `/propostas/${proposta.id}` : '/propostas'}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
            >
              Cancelar
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar e gerar PDF'}
            </Button>
          </div>
        </form>

        {mostrarPrevia && (
          <aside className="h-[80vh] min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
            <PreviaPdf
              chave={chavePrevia}
              gerar={() => pdfDaProposta(base, cliente.data, valores.endereco_id, vendedor.data)}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Um serviço da proposta
// -----------------------------------------------------------------------------

type Tipo = { id: string; nome: string; ativo: boolean }

function ItemServico({
  form,
  i,
  tipos,
  podeRemover,
  remover,
  completo,
}: {
  form: UseFormReturn<FormProposta>
  i: number
  tipos: Tipo[]
  podeRemover: boolean
  remover: () => void
  completo: boolean
}) {
  const erro = form.formState.errors.itens?.[i]
  const modeloAtual = useWatch({ control: form.control, name: `itens.${i}.modelo` })
  const [textosAbertos, setTextosAbertos] = useState(false)

  function textosDoModelo(chave: string) {
    const m = modeloDe(chave)
    if (!m) return null
    return {
      titulo: m.titulo,
      escopo: m.escopo,
      metodologia: m.metodologia,
      recursos: recursosDoModelo(m),
      descricao: m.descricao,
    }
  }

  /** Troca o modelo: substitui só o texto que ainda é o padrão do modelo anterior (ou vazio). */
  function trocarModelo(nova: string, anterior: string) {
    const novo = textosDoModelo(nova)
    const velho = textosDoModelo(anterior)
    const m = modeloDe(nova)
    if (!novo || !m) return
    for (const campo of ['titulo', 'escopo', 'metodologia', 'recursos', 'descricao'] as const) {
      const atual = form.getValues(`itens.${i}.${campo}`)
      if (!atual.trim() || (velho && atual === velho[campo])) {
        form.setValue(`itens.${i}.${campo}`, novo[campo], {
          shouldValidate: campo === 'descricao' && !!novo[campo],
        })
      }
    }
    const tipo = m.tipo ? tipos.find((t) => sem(t.nome) === sem(m.tipo!)) : undefined
    form.setValue(`itens.${i}.tipo_servico_id`, tipo?.id ?? '')
    if (!form.getValues(`itens.${i}.periodicidade_meses`) && m.periodicidade)
      form.setValue(`itens.${i}.periodicidade_meses`, String(m.periodicidade))
  }

  function restaurarTextos() {
    const t = textosDoModelo(modeloAtual)
    if (!t) return
    if (!window.confirm('Voltar metodologia e recursos para o texto padrão do modelo?')) return
    form.setValue(`itens.${i}.metodologia`, t.metodologia)
    form.setValue(`itens.${i}.recursos`, t.recursos)
  }

  return (
    <fieldset className="grid gap-3 rounded-xl border border-borda p-3 sm:grid-cols-12">
      <legend className="px-1 text-sm font-bold text-verde-escuro">Serviço {i + 1}</legend>
      <Campo rotulo="Modelo do serviço" htmlFor={`modelo-${i}`} className="sm:col-span-6">
        <SelectForm
          id={`modelo-${i}`}
          control={form.control}
          name={`itens.${i}.modelo`}
          onChange={(e) => trocarModelo(e.target.value, modeloAtual)}
        >
          <option value="">Escolha…</option>
          {(Object.keys(MODELOS) as ChaveModelo[]).map((k) => (
            <option key={k} value={k}>
              {MODELOS[k].nome}
            </option>
          ))}
        </SelectForm>
      </Campo>
      <Campo
        rotulo="Frequência"
        htmlFor={`freq-${i}`}
        className="sm:col-span-4"
        erro={erro?.periodicidade_meses?.message}
      >
        <SelectForm id={`freq-${i}`} control={form.control} name={`itens.${i}.periodicidade_meses`}>
          {FREQUENCIAS.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.nome}
            </option>
          ))}
        </SelectForm>
      </Campo>
      <div className="flex items-end justify-end sm:col-span-2">
        {podeRemover && (
          <BotaoIcone rotulo={`Remover serviço ${i + 1}`} onClick={remover}>
            <Trash2 className="size-4" />
          </BotaoIcone>
        )}
      </div>

      <Campo
        rotulo="Título da seção no PDF"
        htmlFor={`titulo-${i}`}
        className="sm:col-span-12"
        dica="A frequência entra no fim sozinha (ex.: “/ SEMESTRAL”)."
        erro={erro?.titulo?.message}
      >
        <Input id={`titulo-${i}`} {...form.register(`itens.${i}.titulo`)} />
      </Campo>
      <Campo
        rotulo="O que será feito (escopo)"
        htmlFor={`escopo-${i}`}
        className="sm:col-span-12"
        dica="Troque os “...” pelos dados do cliente: áreas, quantidades, metragem."
        erro={erro?.escopo?.message}
      >
        <Textarea id={`escopo-${i}`} rows={4} {...form.register(`itens.${i}.escopo`)} />
      </Campo>

      <Campo
        rotulo="Linha nos custos"
        htmlFor={`descricao-${i}`}
        erro={erro?.descricao?.message}
        className="sm:col-span-12"
        dica="Ex.: Limpeza de caixas d'água: 4 unidades de 5.000 litros"
      >
        <Input id={`descricao-${i}`} {...form.register(`itens.${i}.descricao`)} />
      </Campo>
      <Campo
        rotulo="Qtd."
        htmlFor={`qtd-${i}`}
        erro={erro?.quantidade?.message}
        className="sm:col-span-2"
      >
        <Input id={`qtd-${i}`} inputMode="decimal" {...form.register(`itens.${i}.quantidade`)} />
      </Campo>
      <CampoValor
        form={form}
        nome={`itens.${i}.valor_unitario`}
        rotulo="Valor (R$)"
        erro={erro?.valor_unitario?.message}
        className="sm:col-span-5"
      />
      <Campo rotulo="Cobrança" htmlFor={`cobranca-${i}`} className="sm:col-span-5">
        <SelectForm id={`cobranca-${i}`} control={form.control} name={`itens.${i}.cobranca`}>
          {COBRANCAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.nome}
            </option>
          ))}
        </SelectForm>
      </Campo>

      <TaxasAdicionais form={form} i={i} />

      {completo && <TextoContrato form={form} i={i} modelo={modeloAtual} />}

      <div className="sm:col-span-12">
        <button
          type="button"
          onClick={() => setTextosAbertos((v) => !v)}
          className="text-sm font-semibold text-verde hover:underline"
          aria-expanded={textosAbertos}
        >
          {textosAbertos ? '▾' : '▸'} Metodologia e recursos
        </button>
        {textosAbertos && (
          <div className="mt-3 grid gap-3">
            <Campo rotulo="Metodologia" htmlFor={`met-${i}`} erro={erro?.metodologia?.message}>
              <Textarea id={`met-${i}`} rows={4} {...form.register(`itens.${i}.metodologia`)} />
            </Campo>
            <Campo
              rotulo="Recursos (um por linha)"
              htmlFor={`rec-${i}`}
              erro={erro?.recursos?.message}
              dica="Com mais de um serviço, as linhas iguais aparecem uma vez só."
            >
              <Textarea id={`rec-${i}`} rows={6} {...form.register(`itens.${i}.recursos`)} />
            </Campo>
            {modeloAtual && (
              <Button variante="fantasma" className="self-start" onClick={restaurarTextos}>
                <RotateCcw className="size-4" aria-hidden /> Voltar ao texto padrão
              </Button>
            )}
          </div>
        )}
      </div>
    </fieldset>
  )
}

/**
 * Texto do serviço no contrato completo. Abre com o texto padrão do modelo; as
 * marcas {cliente}, {escopo} e {frequencia} o PDF troca sozinho.
 */
function TextoContrato({
  form,
  i,
  modelo,
}: {
  form: UseFormReturn<FormProposta>
  i: number
  modelo: string
}) {
  const [aberto, setAberto] = useState(false)
  const campo = `itens.${i}.texto_contrato` as const
  const editado = !!useWatch({ control: form.control, name: campo })?.trim()
  const padrao = () => textoContratoPadrao(modelo, form.getValues(`itens.${i}.metodologia`))

  function abrir() {
    if (!aberto && !form.getValues(campo).trim()) form.setValue(campo, padrao())
    setAberto((v) => !v)
  }

  return (
    <div className="sm:col-span-12">
      <button
        type="button"
        onClick={abrir}
        className="text-sm font-semibold text-verde hover:underline"
        aria-expanded={aberto}
      >
        {aberto ? '▾' : '▸'} Texto no contrato completo
        {!aberto && (
          <span className="font-normal text-texto-suave">
            {editado ? ' (editado)' : ' (padrão do modelo)'}
          </span>
        )}
      </button>
      {aberto && (
        <div className="mt-3 grid gap-3">
          <Campo
            rotulo="Texto do serviço no memorial"
            htmlFor={`contrato-${i}`}
            erro={form.formState.errors.itens?.[i]?.texto_contrato?.message}
            dica="{escopo} vira o “o que será feito”, {cliente} o nome do cliente e {FREQUENCIA} a frequência. Troque os “...” pelos dados do cliente."
          >
            <Textarea id={`contrato-${i}`} rows={14} {...form.register(campo)} />
          </Campo>
          <Button
            variante="fantasma"
            className="self-start"
            onClick={() => {
              if (window.confirm('Voltar o texto do contrato para o padrão do modelo?'))
                form.setValue(campo, padrao())
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> Voltar ao texto padrão
          </Button>
        </div>
      )}
    </div>
  )
}

/** Taxas adicionais do serviço (ex.: trabalho ao domingo, noturno). Somam no valor do serviço. */
function TaxasAdicionais({ form, i }: { form: UseFormReturn<FormProposta>; i: number }) {
  const taxas = useFieldArray({ control: form.control, name: `itens.${i}.taxas_adicionais` })
  const item = useWatch({ control: form.control, name: `itens.${i}` })
  const erros = form.formState.errors.itens?.[i]?.taxas_adicionais
  const temTaxas = taxas.fields.length > 0

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-fundo-suave p-3 sm:col-span-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">Taxas adicionais</p>
        <Button variante="fantasma" onClick={() => taxas.append({ ...TAXA_VAZIA })}>
          <Plus className="size-4" aria-hidden /> Adicionar taxa
        </Button>
      </div>
      {!temTaxas && (
        <p className="text-sm text-texto-suave">
          Ex.: adicional para trabalho ao domingo, adicional noturno. Soma no valor do serviço.
        </p>
      )}
      {taxas.fields.map((campo, j) => {
        const registroValor = form.register(`itens.${i}.taxas_adicionais.${j}.valor`)
        return (
          <div key={campo.id} className="grid gap-3 sm:grid-cols-12">
            <Campo
              rotulo="O que é a taxa"
              htmlFor={`taxa-${i}-${j}`}
              className="sm:col-span-7"
              erro={erros?.[j]?.descricao?.message}
            >
              <Input
                id={`taxa-${i}-${j}`}
                placeholder="Adicional para trabalho ao domingo"
                {...form.register(`itens.${i}.taxas_adicionais.${j}.descricao`)}
              />
            </Campo>
            <Campo
              rotulo="Valor (R$)"
              htmlFor={`taxa-valor-${i}-${j}`}
              className="sm:col-span-4"
              erro={erros?.[j]?.valor?.message}
            >
              <Input
                id={`taxa-valor-${i}-${j}`}
                inputMode="numeric"
                placeholder="0,00"
                {...registroValor}
                onChange={(e) => {
                  e.target.value = mascaraValor(e.target.value)
                  void registroValor.onChange(e)
                }}
              />
            </Campo>
            <div className="flex items-end justify-end sm:col-span-1">
              <BotaoIcone rotulo={`Remover taxa ${j + 1}`} onClick={() => taxas.remove(j)}>
                <Trash2 className="size-4" />
              </BotaoIcone>
            </div>
          </div>
        )
      })}
      {temTaxas && item && (
        <p className="text-right text-sm">
          Valor do serviço com as taxas: <strong>{formatarReais(totalDoItem(item))}</strong>
        </p>
      )}
    </div>
  )
}

function CampoValor({
  form,
  nome,
  rotulo,
  dica,
  erro,
  className,
  placeholder = '0,00',
}: {
  form: UseFormReturn<FormProposta>
  nome: 'acrescimo_fora_horario' | 'contrato_valor_anual' | `itens.${number}.valor_unitario`
  rotulo: string
  placeholder?: string
  dica?: string
  erro?: string
  className?: string
}) {
  const registro = form.register(nome)
  return (
    <Campo rotulo={rotulo} htmlFor={nome} erro={erro} dica={dica} className={className}>
      <Input
        id={nome}
        inputMode="numeric"
        placeholder={placeholder}
        {...registro}
        onChange={(e) => {
          e.target.value = mascaraValor(e.target.value)
          void registro.onChange(e)
        }}
      />
    </Campo>
  )
}

const FORMAS_RAPIDAS = ['boleto bancário', 'PIX', 'cartão de crédito']

/**
 * Prazo e forma de pagamento. A forma é escrita à mão (com atalhos). Com PIX ou
 * cartão dá para tirar o prazo; no cartão, em quantas vezes e se tem juros.
 */
function CamposPagamento({
  form,
  fixo,
  temCliente,
}: {
  form: UseFormReturn<FormProposta>
  /** Pagamento fixo do cliente (de uma proposta anterior), se houver. */
  fixo: PagamentoFixo | null
  temCliente: boolean
}) {
  const { errors } = form.formState
  const [condicao, prazo, parcelas, juros] = useWatch({
    control: form.control,
    name: ['condicao_pagamento', 'prazo_pagamento_dias', 'cartao_parcelas', 'cartao_juros'],
  })
  const cartao = ehCartao(condicao)
  const podeSemPrazo = cartao || ehPix(condicao)
  const semPrazo = podeSemPrazo && prazo.trim() === ''
  const mudar = { shouldDirty: true, shouldValidate: true } as const

  return (
    <>
      <Campo
        rotulo="Forma de pagamento"
        htmlFor="condicao"
        dica="Escreva como quiser ou use um atalho."
      >
        <Input
          id="condicao"
          placeholder="boleto bancário"
          {...form.register('condicao_pagamento')}
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FORMAS_RAPIDAS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => form.setValue('condicao_pagamento', f, mudar)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                condicao.trim().toLowerCase() === f.toLowerCase()
                  ? 'border-verde bg-verde text-white'
                  : 'border-borda text-texto-suave hover:border-verde',
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </Campo>
      <Campo
        rotulo="Prazo de pagamento (dias)"
        htmlFor="prazo"
        erro={errors.prazo_pagamento_dias?.message}
        dica={
          semPrazo
            ? 'Sem prazo: o PDF não fala em dias e a conta a receber vence no dia do serviço.'
            : 'Também gera a conta a receber quando o serviço for concluído.'
        }
      >
        {!semPrazo && (
          <Input id="prazo" inputMode="numeric" {...form.register('prazo_pagamento_dias')} />
        )}
        {podeSemPrazo && (
          <label className="mt-1.5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-verde"
              checked={semPrazo}
              onChange={(e) =>
                form.setValue('prazo_pagamento_dias', e.target.checked ? '' : '28', mudar)
              }
            />
            Sem prazo de pagamento
          </label>
        )}
      </Campo>
      {cartao && (
        <>
          <Campo
            rotulo="Parcelas no cartão"
            htmlFor="cartao_parcelas"
            erro={errors.cartao_parcelas?.message}
            dica="1 = à vista. Em branco, o PDF não fala em parcelas."
          >
            <Input
              id="cartao_parcelas"
              inputMode="numeric"
              placeholder="Ex.: 3"
              {...form.register('cartao_parcelas')}
            />
          </Campo>
          {Number(parcelas) > 1 && (
            <Campo rotulo="Juros no cartão" htmlFor="cartao_juros">
              <div className="flex gap-1.5">
                {[
                  { v: false, t: 'Sem juros' },
                  { v: true, t: 'Com juros' },
                ].map(({ v, t }) => (
                  <button
                    key={t}
                    type="button"
                    id={v ? undefined : 'cartao_juros'}
                    aria-pressed={form.watch('cartao_juros') === v}
                    onClick={() => form.setValue('cartao_juros', v, mudar)}
                    className={cn(
                      'min-h-11 flex-1 rounded-xl border-2 px-3 text-sm font-semibold',
                      form.watch('cartao_juros') === v
                        ? 'border-verde bg-verde text-white'
                        : 'border-borda text-texto-suave',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Campo>
          )}
        </>
      )}
      {temCliente && (
        <PagamentoFixoDoCliente
          form={form}
          fixo={fixo}
          igual={!!fixo && mesmoPagamento(fixo, { condicao, prazo, parcelas, juros })}
        />
      )}
    </>
  )
}

/** O que está na tela é o mesmo pagamento fixo do cliente? */
function mesmoPagamento(
  fixo: PagamentoFixo,
  atual: { condicao: string; prazo: string; parcelas: string; juros: boolean },
) {
  const parcelas = ehCartao(atual.condicao) ? atual.parcelas.trim() : ''
  return (
    (fixo.condicao_pagamento ?? '').trim().toLowerCase() === atual.condicao.trim().toLowerCase() &&
    (fixo.prazo_pagamento_dias?.toString() ?? '') === atual.prazo.trim() &&
    (fixo.cartao_parcelas?.toString() ?? '') === parcelas &&
    (Number(parcelas) > 1 ? !!fixo.cartao_juros === atual.juros : true)
  )
}

function descreverPagamento(p: PagamentoFixo) {
  return [
    p.prazo_pagamento_dias != null ? `${p.prazo_pagamento_dias} dias` : 'sem prazo',
    p.condicao_pagamento,
    p.cartao_parcelas ? `${p.cartao_parcelas}x` : null,
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * Fixar o pagamento para as próximas propostas do cliente, ou usar um prazo
 * diferente só nesta (ex.: prazo reduzido num serviço avulso).
 */
function PagamentoFixoDoCliente({
  form,
  fixo,
  igual,
}: {
  form: UseFormReturn<FormProposta>
  fixo: PagamentoFixo | null
  igual: boolean
}) {
  const marcado = useWatch({ control: form.control, name: 'pagamento_fixo' })
  const mudar = { shouldDirty: true } as const

  if (fixo && igual) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-verde/10 px-3 py-2 text-sm font-semibold text-verde">
        <Pin className="size-4 shrink-0" aria-hidden />
        Prazo fixo deste cliente: vale também para os próximos orçamentos.
      </p>
    )
  }

  if (!fixo) {
    return (
      <label className="flex items-start gap-2 rounded-xl border border-borda px-3 py-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-verde"
          checked={marcado}
          onChange={(e) => form.setValue('pagamento_fixo', e.target.checked, mudar)}
        />
        <span>
          <span className="font-semibold">Manter este prazo fixo</span> para os próximos orçamentos
          deste cliente
        </span>
      </label>
    )
  }

  function voltarAoFixo(f: PagamentoFixo) {
    const opcoes = { shouldDirty: true, shouldValidate: true } as const
    form.setValue('prazo_pagamento_dias', f.prazo_pagamento_dias?.toString() ?? '', opcoes)
    form.setValue('condicao_pagamento', f.condicao_pagamento ?? '', opcoes)
    form.setValue('cartao_parcelas', f.cartao_parcelas?.toString() ?? '', opcoes)
    form.setValue('cartao_juros', f.cartao_juros ?? false, opcoes)
    form.setValue('pagamento_fixo', true, mudar)
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-borda px-3 py-2">
      <p className="text-sm">
        Prazo fixo deste cliente: <strong>{descreverPagamento(fixo)}</strong>.{' '}
        <button
          type="button"
          className="font-semibold text-verde underline"
          onClick={() => voltarAoFixo(fixo)}
        >
          Voltar ao fixo
        </button>
      </p>
      <div className="flex flex-col gap-1.5 sm:flex-row">
        {[
          { v: false, t: 'Só para esta proposta' },
          { v: true, t: 'Fixar para os próximos' },
        ].map(({ v, t }) => (
          <button
            key={t}
            type="button"
            aria-pressed={marcado === v}
            onClick={() => form.setValue('pagamento_fixo', v, mudar)}
            className={cn(
              'min-h-11 flex-1 rounded-xl border-2 px-3 text-sm font-semibold',
              marcado === v ? 'border-verde bg-verde text-white' : 'border-borda text-texto-suave',
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
