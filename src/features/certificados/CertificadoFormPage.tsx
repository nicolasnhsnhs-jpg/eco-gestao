import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, FileDown, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { SelectForm } from '@/components/ui/SelectForm'
import { formatarData, hojeISO } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { UNIDADE } from '@/lib/unidade'
import { cn } from '@/lib/utils'

import { useCliente } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useTiposServico } from '../servicos/api'
import {
  useCancelarCertificado,
  useCertificado,
  useOrigemOs,
  useOrigemServico,
  usePeriodicidadeDoCliente,
  useProdutosCatalogo,
  useSalvarCertificado,
  type CertificadoResumo,
  type Origem,
  type ProdutoCatalogo,
} from './api'
import {
  calcularValidade,
  lerProdutos,
  lerReservatorios,
  linhasDoProduto,
  MODELO,
  MODELOS,
  modeloDoTipo,
  padraoDoModelo,
  PERIODICIDADES,
  textoValidadeMeses,
  textoValidoAte,
  type ModeloCertificado,
} from './modelos'

const produto = z.object({
  nome_comercial: z.string(),
  principio_ativo: z.string().trim().min(2, 'Informe o produto.'),
  registro: z.string(),
  quantidade: z.string(),
  lote: z.string(),
  fabricacao: z.string(),
  validade: z.string(),
})

const esquema = z.object({
  cliente_id: z.string().min(1, 'Escolha o cliente.'),
  cliente_nome: z.string(),
  endereco_id: z.string(),
  tipo_servico_id: z.string().min(1, 'Escolha o serviço.'),
  modelo: z.enum(MODELOS),
  titulo: z.string().trim().min(3, 'Escreva o título.'),
  pragas_alvo: z.string().trim(),
  servico_descrito: z.string().trim().min(3, 'Escreva o serviço.'),
  complemento: z.string().trim(),
  data_execucao: z.string().min(1, 'Informe a data.'),
  outras_datas: z.array(z.object({ data: z.string() })),
  tipo_validade: z.enum(['contrato', 'avulso']),
  validade_meses: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 60), 'Entre 1 e 60 meses.'),
  areas: z.string(),
  produtos: z.array(produto),
  reservatorios: z.array(
    z.object({
      quantidade: z.string(),
      local: z.string(),
      metragem: z.string(),
      produto: z.string(),
    }),
  ),
  descricao: z.string(),
  mtr: z.string().trim(),
  volume: z.string().trim(),
  observacao_final: z.string().trim(),
  responsavel_nome: z.string().trim(),
  responsavel_registro: z.string().trim(),
})
type Dados = z.infer<typeof esquema>

/** /certificados/novo (com ?os= ou ?servico=) e /certificados/:id */
export function CertificadoFormPage() {
  const { id } = useParams()
  const [p] = useSearchParams()
  const certificado = useCertificado(id)
  const origemOs = useOrigemOs(id ? null : p.get('os'))
  const origemServico = useOrigemServico(id ? null : p.get('servico'))
  const tipos = useTiposServico()

  if (tipos.isPending || (id && certificado.isPending)) return <Carregando />
  if (!id && p.get('os') && origemOs.isPending) return <Carregando />
  if (!id && p.get('servico') && origemServico.isPending) return <Carregando />
  if (id && !certificado.data) return <Aviso tipo="erro">Certificado não encontrado.</Aviso>
  const erro = origemOs.error ?? origemServico.error ?? tipos.error
  if (erro) return <Aviso tipo="erro">{mensagemDeErro(erro)}</Aviso>

  return (
    <Formulario
      key={id ?? 'novo'}
      certificado={certificado.data ?? undefined}
      origem={origemOs.data ?? origemServico.data ?? undefined}
      tipos={tipos.data ?? []}
    />
  )
}

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())

type Tipo = NonNullable<ReturnType<typeof useTiposServico>['data']>[number]

function valoresIniciais(tipos: Tipo[], c?: CertificadoResumo, origem?: Origem): Dados {
  if (c) {
    return {
      cliente_id: c.cliente_id,
      cliente_nome: c.cliente?.nome_fantasia || c.cliente?.nome || '',
      endereco_id: c.endereco_id ?? '',
      tipo_servico_id: c.tipo_servico_id,
      modelo: c.modelo as ModeloCertificado,
      titulo: c.titulo,
      pragas_alvo: c.pragas_alvo ?? '',
      servico_descrito: c.servico_descrito,
      complemento: c.complemento ?? '',
      data_execucao: c.data_execucao,
      outras_datas: (c.outras_datas ?? []).map((data) => ({ data })),
      tipo_validade: c.tipo_validade as 'contrato' | 'avulso',
      validade_meses: c.validade_meses?.toString() ?? '',
      areas: c.areas ?? '',
      produtos: lerProdutos(c.produtos),
      reservatorios: lerReservatorios(c.reservatorios),
      descricao: c.descricao ?? '',
      mtr: c.mtr ?? '',
      volume: c.volume ?? '',
      observacao_final: c.observacao_final ?? '',
      responsavel_nome: c.responsavel_nome ?? '',
      responsavel_registro: c.responsavel_registro ?? '',
    }
  }
  const tipo = tipos.find((t) => t.id === origem?.tipoId)
  const modelo = modeloDoTipo(tipo)
  const padrao = padraoDoModelo(modelo, tipo?.nome ?? '')
  const meses = origem?.periodicidade ?? tipo?.periodicidade_meses_padrao ?? null
  return {
    cliente_id: origem?.clienteId ?? '',
    cliente_nome: origem?.clienteNome ?? '',
    endereco_id: origem?.enderecoId ?? '',
    tipo_servico_id: origem?.tipoId ?? '',
    modelo,
    titulo: padrao.titulo,
    pragas_alvo: padrao.pragasAlvo,
    servico_descrito: padrao.servicoDescrito,
    complemento: padrao.complemento,
    data_execucao: origem?.dataExecucao ?? hojeISO(),
    outras_datas: [],
    tipo_validade: origem?.deContrato ? 'contrato' : 'avulso',
    validade_meses: meses?.toString() ?? '',
    areas: origem?.areas ?? '',
    produtos: [],
    reservatorios:
      modelo === 'reservatorio' ? [{ quantidade: '', local: '', metragem: '', produto: '' }] : [],
    descricao: '',
    mtr: '',
    volume: '',
    observacao_final: '',
    responsavel_nome: '',
    responsavel_registro: '',
  }
}

function Formulario({
  certificado,
  origem,
  tipos,
}: {
  certificado?: CertificadoResumo
  origem?: Origem
  tipos: Tipo[]
}) {
  const editando = !!certificado
  const cancelado = !!certificado?.cancelado_em
  const navegar = useNavigate()
  const salvar = useSalvarCertificado()
  const catalogo = useProdutosCatalogo()
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciais(tipos, certificado, origem),
  })
  const { errors, isSubmitting } = form.formState
  const outrasDatas = useFieldArray({ control: form.control, name: 'outras_datas' })
  const produtos = useFieldArray({ control: form.control, name: 'produtos' })
  const reservatorios = useFieldArray({ control: form.control, name: 'reservatorios' })
  const [clienteId, clienteNome, enderecoId, tipoId, modelo, dataExecucao, meses, tipoValidade] =
    useWatch({
      control: form.control,
      name: [
        'cliente_id',
        'cliente_nome',
        'endereco_id',
        'tipo_servico_id',
        'modelo',
        'data_execucao',
        'validade_meses',
        'tipo_validade',
      ],
    })
  const cliente = useCliente(clienteId)
  const enderecos = cliente.data?.enderecos ?? []
  const tipo = tipos.find((t) => t.id === tipoId)
  const m = MODELO[modelo]
  const validade = calcularValidade(dataExecucao, meses ? Number(meses) : null, tipoValidade)
  const responsavelPadrao =
    m.responsavelSuccao && UNIDADE.certificado.responsavelSuccao
      ? UNIDADE.certificado.responsavelSuccao
      : UNIDADE.certificado.responsavel

  // Certificado avulso, sem origem: quando escolhe cliente e serviço, sugere a
  // periodicidade combinada com aquele cliente.
  const periodicidade = usePeriodicidadeDoCliente(
    editando || origem ? '' : clienteId,
    enderecoId || null,
    tipoId,
  )
  useEffect(() => {
    if (periodicidade.data && !form.getFieldState('validade_meses').isDirty)
      form.setValue('validade_meses', String(periodicidade.data))
  }, [periodicidade.data, form])

  function aoEscolherCliente(c: ClienteEscolhido | null) {
    form.setValue('cliente_id', c?.id ?? '', { shouldValidate: !!c })
    form.setValue('cliente_nome', c?.nome ?? '')
    form.setValue('endereco_id', '')
  }

  /** Trocar o serviço troca o modelo e os textos sugeridos (se ainda não foram mexidos). */
  function aoEscolherTipo(id: string) {
    const t = tipos.find((x) => x.id === id)
    const novo = modeloDoTipo(t)
    aplicarModelo(novo, t?.nome ?? '')
    if (!form.getFieldState('validade_meses').isDirty && t?.periodicidade_meses_padrao)
      form.setValue('validade_meses', String(t.periodicidade_meses_padrao))
  }

  function aplicarModelo(novo: ModeloCertificado, nomeServico = tipo?.nome ?? '') {
    form.setValue('modelo', novo)
    const p = padraoDoModelo(novo, nomeServico)
    const campos = [
      ['titulo', p.titulo],
      ['servico_descrito', p.servicoDescrito],
      ['pragas_alvo', p.pragasAlvo],
      ['complemento', p.complemento],
    ] as const
    for (const [campo, valor] of campos)
      if (!form.getFieldState(campo).isDirty) form.setValue(campo, valor)
    if (novo === 'reservatorio' && form.getValues('reservatorios').length === 0)
      reservatorios.append({ quantidade: '', local: '', metragem: '', produto: '' })
  }

  function adicionarProduto(item: ProdutoCatalogo) {
    produtos.append({
      nome_comercial: item.nome_comercial ?? '',
      principio_ativo: item.principio_ativo,
      registro: item.registro ?? '',
      quantidade: item.quantidade_padrao ?? '',
      lote: item.lote ?? '',
      fabricacao: item.fabricacao ?? '',
      validade: item.validade ?? '',
    })
  }

  async function enviar(d: Dados) {
    setAviso(null)
    try {
      const id = await salvar.mutateAsync({
        id: certificado?.id,
        dados: {
          cliente_id: d.cliente_id,
          endereco_id: ouNulo(d.endereco_id) ?? (enderecos.length === 1 ? enderecos[0].id : null),
          tipo_servico_id: d.tipo_servico_id,
          os_id: certificado ? certificado.os_id : (origem?.osId ?? null),
          servico_id: certificado ? certificado.servico_id : (origem?.servicoId ?? null),
          modelo: d.modelo,
          titulo: d.titulo,
          pragas_alvo: MODELO[d.modelo].temPragas ? ouNulo(d.pragas_alvo) : null,
          servico_descrito: d.servico_descrito,
          complemento: ouNulo(d.complemento),
          data_execucao: d.data_execucao,
          outras_datas: d.outras_datas.map((o) => o.data).filter((x) => x && x !== d.data_execucao),
          tipo_validade: d.tipo_validade,
          validade_meses: d.validade_meses ? Number(d.validade_meses) : null,
          validade:
            calcularValidade(
              d.data_execucao,
              d.validade_meses ? Number(d.validade_meses) : null,
              d.tipo_validade,
            ) || null,
          areas: ouNulo(d.areas),
          produtos: d.produtos,
          reservatorios: d.modelo === 'reservatorio' ? lerReservatorios(d.reservatorios) : [],
          descricao: ouNulo(d.descricao),
          mtr: ouNulo(d.mtr),
          volume: ouNulo(d.volume),
          observacao_final: ouNulo(d.observacao_final),
          responsavel_nome: ouNulo(d.responsavel_nome),
          responsavel_registro: ouNulo(d.responsavel_registro),
        },
      })
      if (editando) {
        form.reset(d)
        setAviso('Alterações salvas.')
      } else navegar(`/certificados/${id}`, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function baixarPdf() {
    if (!certificado) return
    if (form.formState.isDirty) {
      setAviso('Salve as alterações antes de baixar o PDF.')
      return
    }
    setGerandoPdf(true)
    const aba = window.open('', '_blank')
    try {
      const { abrirPdfCertificado } = await import('./pdf/gerarPdfCertificado')
      await abrirPdfCertificado(certificado, aba)
    } catch (e) {
      aba?.close()
      form.setError('root', { message: mensagemDeErro(e) })
    } finally {
      setGerandoPdf(false)
    }
  }

  const ativos = catalogo.data?.filter((p) => p.ativo) ?? []

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/certificados"
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Certificados
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {editando ? `Certificado ${certificado.numero}` : 'Emitir certificado'}
          </h1>
          {origem?.osNumero && (
            <p className="text-texto-suave">Preenchido a partir da {origem.osNumero}.</p>
          )}
          {certificado?.os && <p className="text-texto-suave">Da {certificado.os.numero}.</p>}
        </div>
        {editando && (
          <Button onClick={() => void baixarPdf()} disabled={gerandoPdf}>
            <FileDown className="size-5" aria-hidden />
            {gerandoPdf ? 'Gerando PDF…' : 'Baixar PDF'}
          </Button>
        )}
      </div>
      {cancelado && (
        <Aviso tipo="erro">
          Certificado cancelado em {formatarData(certificado.cancelado_em)}:{' '}
          {certificado.motivo_cancelamento}
        </Aviso>
      )}
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      {aviso && <Aviso>{aviso}</Aviso>}

      <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-5">
        <fieldset disabled={cancelado} className="flex flex-col gap-5">
          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Cliente e serviço</h2>
            <Campo
              rotulo="Cliente"
              htmlFor="cliente"
              obrigatorio
              erro={errors.cliente_id?.message}
              className="sm:col-span-2"
            >
              {editando || origem ? (
                <p className="flex min-h-11 items-center font-semibold">{clienteNome}</p>
              ) : (
                <ClienteSeletor
                  id="cliente"
                  valor={clienteId ? { id: clienteId, nome: clienteNome } : null}
                  aoMudar={aoEscolherCliente}
                />
              )}
            </Campo>
            <Campo rotulo="Unidade / endereço" htmlFor="endereco">
              <SelectForm id="endereco" control={form.control} name="endereco_id">
                <option value="">
                  {enderecos.length === 1
                    ? 'O endereço cadastrado'
                    : enderecos.length
                      ? 'Escolha…'
                      : 'Sem endereço'}
                </option>
                {enderecos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.apelido, `${e.logradouro}, ${e.numero ?? 's/n'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </option>
                ))}
              </SelectForm>
            </Campo>
            <Campo
              rotulo="Serviço"
              htmlFor="tipo"
              obrigatorio
              erro={errors.tipo_servico_id?.message}
            >
              <SelectForm
                id="tipo"
                control={form.control}
                name="tipo_servico_id"
                onChange={(e) => aoEscolherTipo(e.target.value)}
              >
                <option value="">Escolha…</option>
                {tipos
                  .filter((t) => t.ativo || t.id === certificado?.tipo_servico_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
              </SelectForm>
            </Campo>
            <Campo
              rotulo="Modelo do certificado"
              htmlFor="modelo"
              dica="Muda a cor e os blocos do PDF."
            >
              <Select
                id="modelo"
                value={modelo}
                onChange={(e) => aplicarModelo(e.target.value as ModeloCertificado)}
              >
                {MODELOS.map((x) => (
                  <option key={x} value={x}>
                    {MODELO[x].nome}
                  </option>
                ))}
              </Select>
            </Campo>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Texto do certificado</h2>
            <Campo
              rotulo="Título"
              htmlFor="titulo"
              obrigatorio
              erro={errors.titulo?.message}
              className="sm:col-span-2"
            >
              <Input id="titulo" {...form.register('titulo')} />
            </Campo>
            {m.temPragas && (
              <Campo
                rotulo="Pragas-alvo"
                htmlFor="pragas"
                dica='Sai como "Pragas Alvo (baratas, formigas…)".'
                className="sm:col-span-2"
              >
                <Input id="pragas" {...form.register('pragas_alvo')} />
              </Campo>
            )}
            <Campo
              rotulo="Serviço na frase"
              htmlFor="servico-descrito"
              obrigatorio
              erro={errors.servico_descrito?.message}
              dica='"…foram realizados os serviços de [este texto] nas dependências de…"'
              className="sm:col-span-2"
            >
              <Input id="servico-descrito" {...form.register('servico_descrito')} />
            </Campo>
            <Campo
              rotulo="Frase extra (opcional)"
              htmlFor="complemento"
              dica="Vai logo depois do CNPJ do cliente."
              className="sm:col-span-2"
            >
              <Input id="complemento" {...form.register('complemento')} />
            </Campo>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Data e validade</h2>
            <Campo
              rotulo="Data do serviço"
              htmlFor="data"
              obrigatorio
              erro={errors.data_execucao?.message}
            >
              <Input id="data" type="date" {...form.register('data_execucao')} />
            </Campo>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Outros dias do mesmo serviço</span>
              {outrasDatas.fields.map((campo, i) => (
                <div key={campo.id} className="flex gap-2">
                  <Input
                    type="date"
                    aria-label={`Outro dia ${i + 1}`}
                    {...form.register(`outras_datas.${i}.data`)}
                  />
                  <BotaoIcone rotulo="Tirar este dia" onClick={() => outrasDatas.remove(i)}>
                    <Trash2 className="size-5" aria-hidden />
                  </BotaoIcone>
                </div>
              ))}
              <Button
                variante="fantasma"
                className="self-start"
                onClick={() => outrasDatas.append({ data: '' })}
              >
                <Plus className="size-4" aria-hidden /> Adicionar dia
              </Button>
            </div>

            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-semibold">Tipo de certificado</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ['contrato', 'De contrato', 'Vale até o último dia do mês.'],
                    [
                      'avulso',
                      'Avulso',
                      'Vale até a data exata; a data vai embaixo e a validade ao lado.',
                    ],
                  ] as const
                ).map(([valor, nome, explicacao]) => (
                  <label
                    key={valor}
                    className={cn(
                      'flex cursor-pointer flex-col rounded-xl border border-borda p-3',
                      'has-checked:border-verde has-checked:bg-lima-claro',
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input type="radio" value={valor} {...form.register('tipo_validade')} />
                      {nome}
                    </span>
                    <span className="text-sm text-texto-suave">{explicacao}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-semibold">Renovação</span>
              <div className="flex flex-wrap gap-2">
                {PERIODICIDADES.map((p) => (
                  <button
                    key={p.meses}
                    type="button"
                    onClick={() =>
                      form.setValue('validade_meses', String(p.meses), { shouldDirty: true })
                    }
                    className={cn(
                      'min-h-10 rounded-xl border px-3 text-sm font-semibold',
                      meses === String(p.meses)
                        ? 'border-verde bg-lima-claro text-verde-escuro'
                        : 'border-borda bg-white text-texto-suave hover:bg-lima-claro',
                    )}
                  >
                    {p.nome}
                  </button>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  ou
                  <Input
                    className="w-20"
                    inputMode="numeric"
                    aria-label="Meses de validade"
                    {...form.register('validade_meses')}
                  />
                  meses
                </label>
              </div>
              {errors.validade_meses && (
                <p className="text-sm text-perigo" role="alert">
                  {errors.validade_meses.message}
                </p>
              )}
              <p className="text-sm text-texto-suave">
                {validade
                  ? tipoValidade === 'contrato'
                    ? `No PDF: "${textoValidoAte(validade)}"`
                    : `No PDF: "${textoValidadeMeses(Number(meses))}" (vale até ${formatarData(validade)}).`
                  : 'Sem renovação: o certificado sai sem validade.'}
              </p>
            </div>
            <Campo
              rotulo="Observação no fim (opcional)"
              htmlFor="obs-final"
              dica='Ex.: "Monitoramento quinzenal durante o período de 6 meses."'
              className="sm:col-span-2"
            >
              <Input id="obs-final" {...form.register('observacao_final')} />
            </Campo>
          </Card>

          {m.arranjo === 'descricao' ? (
            <Card className="grid gap-4 sm:grid-cols-2">
              <h2 className="font-bold sm:col-span-2">Descrição do serviço</h2>
              <Campo
                rotulo="Descrição"
                htmlFor="descricao"
                dica="Uma linha para cada item."
                className="sm:col-span-2"
              >
                <Textarea id="descricao" rows={5} {...form.register('descricao')} />
              </Campo>
              <Campo rotulo="Nº do MTR" htmlFor="mtr">
                <Input id="mtr" {...form.register('mtr')} />
              </Campo>
              <Campo rotulo="Quantidade retirada" htmlFor="volume" dica="Ex.: 2,000m³">
                <Input id="volume" {...form.register('volume')} />
              </Campo>
            </Card>
          ) : (
            <Card className="grid gap-4">
              <h2 className="font-bold">
                {m.arranjo === 'reservatorios' ? 'Áreas (opcional)' : 'Áreas atendidas'}
              </h2>
              <Campo
                rotulo="Áreas"
                htmlFor="areas"
                dica="Uma linha para cada área (ex.: 322 apartamentos)."
              >
                <Textarea id="areas" rows={4} {...form.register('areas')} />
              </Campo>
            </Card>
          )}

          {m.arranjo === 'reservatorios' && (
            <Card className="flex flex-col gap-3">
              <h2 className="font-bold">Reservatórios</h2>
              {reservatorios.fields.map((campo, i) => (
                <div
                  key={campo.id}
                  className="grid gap-2 rounded-xl border border-borda p-3 sm:grid-cols-[1fr_2fr_1fr_1fr_auto]"
                >
                  <Input
                    aria-label="Quantidade"
                    placeholder="02 Reservatórios"
                    {...form.register(`reservatorios.${i}.quantidade`)}
                  />
                  <Input
                    aria-label="Local"
                    placeholder="Superior interno em polipropileno"
                    {...form.register(`reservatorios.${i}.local`)}
                  />
                  <Input
                    aria-label="Metragem cúbica"
                    placeholder="10m³/cada"
                    {...form.register(`reservatorios.${i}.metragem`)}
                  />
                  <Input
                    aria-label="Produto utilizado"
                    placeholder="40g Clor-in"
                    {...form.register(`reservatorios.${i}.produto`)}
                  />
                  <BotaoIcone rotulo="Tirar esta linha" onClick={() => reservatorios.remove(i)}>
                    <Trash2 className="size-5" aria-hidden />
                  </BotaoIcone>
                </div>
              ))}
              <Button
                variante="fantasma"
                className="self-start"
                onClick={() =>
                  reservatorios.append({ quantidade: '', local: '', metragem: '', produto: '' })
                }
              >
                <Plus className="size-4" aria-hidden /> Adicionar reservatório
              </Button>
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Produtos utilizados</h2>
              <Link
                to="/certificados/produtos"
                className="text-sm font-semibold text-verde underline"
              >
                Cadastro de produtos
              </Link>
            </div>
            {m.arranjo === 'reservatorios' && (
              <p className="text-sm text-texto-suave">
                No reservatório, o lote do produto aparece ao lado da assinatura.
              </p>
            )}
            {produtos.fields.map((campo, i) => {
              const [linha1, linha2] = linhasDoProduto(form.getValues(`produtos.${i}`))
              return (
                <div
                  key={campo.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-borda p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{linha1}</p>
                    {linha2 && <p className="text-sm text-texto-suave">{linha2}</p>}
                  </div>
                  <Input
                    className="w-32"
                    aria-label={`Quantidade de ${campo.principio_ativo}`}
                    placeholder="100ml"
                    {...form.register(`produtos.${i}.quantidade`)}
                  />
                  <BotaoIcone rotulo="Tirar este produto" onClick={() => produtos.remove(i)}>
                    <Trash2 className="size-5" aria-hidden />
                  </BotaoIcone>
                </div>
              )
            })}
            <Select
              aria-label="Adicionar produto do cadastro"
              value=""
              onChange={(e) => {
                const item = ativos.find((p) => p.id === e.target.value)
                if (item) adicionarProduto(item)
              }}
            >
              <option value="">
                {ativos.length
                  ? '+ Adicionar produto do cadastro…'
                  : 'Nenhum produto cadastrado ainda'}
              </option>
              {ativos.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.nome_comercial, p.principio_ativo].filter(Boolean).join(' ')}
                  {p.lote ? ` · lote ${p.lote}` : ''}
                </option>
              ))}
            </Select>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Responsável técnico</h2>
            <Campo
              rotulo="Nome"
              htmlFor="resp-nome"
              dica={responsavelPadrao.nome ? `Vazio = ${responsavelPadrao.nome}` : undefined}
            >
              <Input id="resp-nome" {...form.register('responsavel_nome')} />
            </Campo>
            <Campo
              rotulo="Registro"
              htmlFor="resp-registro"
              dica={
                responsavelPadrao.registro
                  ? `Vazio = ${responsavelPadrao.registro}`
                  : 'Ex.: CRQ 000000'
              }
            >
              <Input id="resp-registro" {...form.register('responsavel_registro')} />
            </Campo>
          </Card>
        </fieldset>

        {!cancelado && (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {editando ? <CancelarCertificado id={certificado.id} /> : <span />}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Emitir certificado'}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}

function CancelarCertificado({ id }: { id: string }) {
  const cancelar = useCancelarCertificado(id)
  const [erro, setErro] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <Button
        variante="fantasma"
        disabled={cancelar.isPending}
        onClick={() => {
          const motivo = window
            .prompt('Por que cancelar este certificado? (fica registrado)')
            ?.trim()
          if (!motivo) return
          if (motivo.length < 5) {
            setErro('Escreva um motivo com pelo menos 5 letras.')
            return
          }
          cancelar.mutate(motivo, { onError: (e) => setErro(mensagemDeErro(e)) })
        }}
      >
        Cancelar certificado
      </Button>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  )
}
