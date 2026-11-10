import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'

import { usePerfil } from '../auth/useAuth'
import { equipeComercial, useCliente, useEquipe } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import { useProposta, useSalvarProposta, type PropostaCompleta } from './api'
import {
  esquemaProposta,
  formParaBase,
  ITEM_VAZIO,
  propostaParaBanco,
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
  type ChaveModelo,
} from './modelos'
import { PreviaPdf } from './pdf/PdfProposta'
import { pdfDaProposta, useVendedorPdf } from './pdf/usoPdf'

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
        periodicidade_meses: i.periodicidade_meses?.toString() ?? '',
        cobranca: (i.cobranca as FormItem['cobranca']) ?? 'unica',
      })),
    }
  }
  const hoje = hojeISO()
  return {
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

  // Cliente escolhido (proposta nova): puxa o contato principal para o "A/C".
  useEffect(() => {
    const c = cliente.data
    if (!c || editando) return
    const { contato_nome, contato_telefone, contato_email } = form.getValues()
    if (contato_nome || contato_telefone || contato_email) return
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
      contato?.email || [c.email, ...(c.emails_extras ?? [])].filter(Boolean).join('; '),
    )
  }, [cliente.data, editando, form])

  function aoEscolherCliente(c: ClienteEscolhido | null) {
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
            <Campo
              rotulo="Apresentação"
              htmlFor="introducao"
              className="sm:col-span-2"
              dica="Em branco, vai o texto padrão (o que aparece aqui dentro, em cinza)."
            >
              <Textarea
                id="introducao"
                rows={4}
                placeholder={introducaoPadrao(
                  nomeApresentacao || '...',
                  assuntoDosItens(valores.itens ?? []),
                ).replace(/\*\*/g, '')}
                {...form.register('introducao')}
              />
            </Campo>
            <Campo
              rotulo="Prazo de pagamento (dias)"
              htmlFor="prazo"
              erro={errors.prazo_pagamento_dias?.message}
              dica="Também gera a conta a receber quando o serviço for concluído."
            >
              <Input id="prazo" inputMode="numeric" {...form.register('prazo_pagamento_dias')} />
            </Campo>
            <Campo
              rotulo="Forma de pagamento"
              htmlFor="condicao"
              dica="Ex.: boleto bancário, PIX, depósito"
            >
              <Input
                id="condicao"
                placeholder="boleto bancário"
                {...form.register('condicao_pagamento')}
              />
            </Campo>
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
}: {
  form: UseFormReturn<FormProposta>
  i: number
  tipos: Tipo[]
  podeRemover: boolean
  remover: () => void
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
            <option key={f.meses} value={f.meses}>
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

function CampoValor({
  form,
  nome,
  rotulo,
  dica,
  erro,
  className,
}: {
  form: UseFormReturn<FormProposta>
  nome: 'acrescimo_fora_horario' | `itens.${number}.valor_unitario`
  rotulo: string
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
        placeholder="0,00"
        {...registro}
        onChange={(e) => {
          e.target.value = mascaraValor(e.target.value)
          void registro.onChange(e)
        }}
      />
    </Campo>
  )
}
