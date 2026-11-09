import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Copy, MapPin, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { SelectForm } from '@/components/ui/SelectForm'
import type { Tables } from '@/lib/database.types'
import { formatarData, formatarMes, hojeISO, mesDe, somarMeses } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useContratos } from '../contratos/api'
import { BoletoNota } from './BoletoNota'
import { CampoCodigoNfse } from './CampoCodigoNfse'
import { AvisoSubstituicao, CancelamentoNota } from './CancelamentoNota'
import { EmissaoNota } from './EmissaoNota'
import { EnvioNota } from './EnvioNota'
import {
  calcularPisCofins,
  notaDoContrato,
  proximaNota,
  RETENCOES_PISCOFINS,
  retemPisCofins,
  tipoRetencaoPisCofins,
  retencoes,
  somaRetencoes,
  valorPorAliquota,
  vencimentoDoContrato,
} from './notas'
import {
  useAliquotaCsll,
  useAliquotaIssDaCidade,
  useDescartarRascunho,
  useIbsCbs,
  useMensalidadesDoContrato,
  useNotaFiscal,
  useSalvarNotaFiscal,
  useUltimaNotaDoContrato,
  type NotaFiscalCompleta,
  type StatusNota,
} from './notasApi'
import { FORMAS, type FormaPagamento } from './rotulos'

const valorOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || lerValor(v) !== null, 'Valor inválido.')

const esquema = z
  .object({
    tipo: z.enum(['contrato', 'avulsa']),
    status: z.enum(['rascunho', 'emitida', 'cancelada']),
    cliente_id: z.string().min(1, 'Escolha o cliente.'),
    cliente_nome: z.string(),
    contrato_id: z.string(),
    lancamento_id: z.string(),
    numero: z.string().trim(),
    data_emissao: z.string().min(1, 'Informe a data de emissão.'),
    competencia: z.string().min(1, 'Informe o mês.'),
    vencimento: z.string(),
    forma_pagamento: z.string(),
    valor_servico: z.string().refine((v) => (lerValor(v) ?? 0) > 0, 'Informe o valor.'),
    descricao: z.string().trim().min(2, 'Descreva o serviço.'),
    codigo_tributacao: z.string().trim(),
    codigo_nbs: z.string().trim(),
    iss_retido: z.boolean(),
    aliquota_iss: valorOpcional,
    pis_cofins_retidos: z.boolean(),
    aliquota_pis: valorOpcional,
    aliquota_cofins: valorOpcional,
    valor_pis: valorOpcional,
    valor_cofins: valorOpcional,
    aliquota_csll: valorOpcional,
    valor_csll: valorOpcional,
    aliquota_irrf: valorOpcional,
    valor_irrf: valorOpcional,
    aliquota_inss: valorOpcional,
    valor_inss: valorOpcional,
    municipio_prestacao: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{7}$/.test(v), 'O código IBGE tem 7 números.'),
    cst_piscofins: z.string(),
    trib_issqn: z.string(),
    tp_imunidade: z.string(),
    tp_ret_piscofins: z.string(),
    observacoes: z.string().trim(),
  })
  .refine((d) => d.tipo === 'avulsa' || d.status === 'cancelada' || d.contrato_id, {
    path: ['contrato_id'],
    message: 'Escolha o contrato desta nota.',
  })
  .refine((d) => d.status !== 'emitida' || d.numero, {
    path: ['numero'],
    message:
      'Informe o número da nota emitida fora do sistema. Para emitir pelo sistema, deixe a situação como Rascunho: o número vem sozinho.',
  })
type Dados = z.infer<typeof esquema>

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())
const numeroOuNulo = (v: string) => (v.trim() === '' ? null : lerValor(v))
/** Percentual com vírgula: 0.65 → "0,65". */
const percentualParaCampo = (v: number | null | undefined) =>
  v == null ? '' : String(v).replace('.', ',')
/** Alíquota da nota; nas antigas (só com o valor em reais), a que dá aquele valor. */
const aliquotaDaNota = (aliquota: number | null, valor: number | null, base: number) =>
  percentualParaCampo(
    aliquota ?? (valor != null && base > 0 ? Math.round((valor / base) * 10000) / 100 : null),
  )

/** /financeiro/notas/nova e /financeiro/notas/:id */
export function NotaFiscalFormPage() {
  const { id } = useParams()
  const nota = useNotaFiscal(id)
  if (!id) return <Formulario />
  if (nota.isPending) return <Carregando />
  if (nota.isError) return <Aviso tipo="erro">{mensagemDeErro(nota.error)}</Aviso>
  if (!nota.data) return <Aviso tipo="erro">Nota fiscal não encontrada.</Aviso>
  return <Formulario nota={nota.data} />
}

function valoresIniciais(nota: NotaFiscalCompleta | undefined, p: URLSearchParams): Dados {
  if (nota)
    return {
      tipo: nota.tipo,
      status: nota.status,
      cliente_id: nota.cliente_id,
      cliente_nome: nota.cliente?.nome_fantasia || nota.cliente?.nome || '',
      contrato_id: nota.contrato_id ?? '',
      lancamento_id: nota.lancamento_id ?? '',
      numero: nota.numero ?? '',
      data_emissao: nota.data_emissao,
      competencia: mesDe(nota.competencia),
      vencimento: nota.vencimento ?? '',
      forma_pagamento: nota.forma_pagamento ?? '',
      valor_servico: valorParaCampo(nota.valor_servico),
      descricao: nota.descricao,
      codigo_tributacao: nota.codigo_tributacao ?? '',
      codigo_nbs: nota.codigo_nbs ?? '',
      iss_retido: nota.iss_retido,
      aliquota_iss: percentualParaCampo(nota.aliquota_iss),
      pis_cofins_retidos: nota.pis_cofins_retidos,
      aliquota_pis: percentualParaCampo(nota.aliquota_pis),
      aliquota_cofins: percentualParaCampo(nota.aliquota_cofins),
      valor_pis: valorParaCampo(nota.valor_pis),
      valor_cofins: valorParaCampo(nota.valor_cofins),
      aliquota_csll: aliquotaDaNota(nota.aliquota_csll, nota.valor_csll, nota.valor_servico),
      valor_csll: valorParaCampo(nota.valor_csll),
      aliquota_irrf: aliquotaDaNota(nota.aliquota_irrf, nota.valor_irrf, nota.valor_servico),
      valor_irrf: valorParaCampo(nota.valor_irrf),
      aliquota_inss: aliquotaDaNota(nota.aliquota_inss, nota.valor_inss, nota.valor_servico),
      valor_inss: valorParaCampo(nota.valor_inss),
      municipio_prestacao: nota.municipio_prestacao ?? '',
      cst_piscofins: nota.cst_piscofins ?? '',
      trib_issqn: String(nota.trib_issqn ?? 1),
      tp_imunidade: nota.tp_imunidade == null ? '' : String(nota.tp_imunidade),
      tp_ret_piscofins: String(tipoRetencaoPisCofins(nota)),
      observacoes: nota.observacoes ?? '',
    }
  const hoje = hojeISO()
  return {
    tipo: p.get('tipo') === 'avulsa' ? 'avulsa' : 'contrato',
    // Nota nova é rascunho: salva e emite pelo sistema (o governo dá o número).
    // "Emitida" é para registrar uma nota feita fora do sistema, com o número dela.
    status: 'rascunho',
    cliente_id: p.get('cliente') ?? '',
    cliente_nome: p.get('cliente_nome') ?? '',
    contrato_id: p.get('contrato') ?? '',
    lancamento_id: '',
    numero: '',
    data_emissao: hoje,
    competencia: mesDe(hoje),
    vencimento: '',
    forma_pagamento: 'boleto',
    valor_servico: '',
    descricao: '',
    codigo_tributacao: '',
    codigo_nbs: '',
    iss_retido: false,
    aliquota_iss: '',
    pis_cofins_retidos: false,
    // Padrão da empresa (lucro presumido, cumulativo): PIS 0,65% e COFINS 3%.
    aliquota_pis: '0,65',
    aliquota_cofins: '3,00',
    valor_pis: '',
    valor_cofins: '',
    aliquota_csll: '',
    valor_csll: '',
    aliquota_irrf: '',
    valor_irrf: '',
    aliquota_inss: '',
    valor_inss: '',
    municipio_prestacao: '',
    cst_piscofins: '',
    trib_issqn: '1',
    tp_imunidade: '',
    tp_ret_piscofins: '0',
    observacoes: '',
  }
}

function Formulario({ nota }: { nota?: NotaFiscalCompleta }) {
  const editando = !!nota
  const navegar = useNavigate()
  const [p] = useSearchParams()
  const salvar = useSalvarNotaFiscal()
  const descartar = useDescartarRascunho()

  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciais(nota, p),
  })
  const { errors, isSubmitting } = form.formState
  const [tipo, clienteId, clienteNome, contratoId] = useWatch({
    control: form.control,
    name: ['tipo', 'cliente_id', 'cliente_nome', 'contrato_id'],
  })
  const contratos = useContratos({ clienteId: clienteId || undefined })
  const contratosDoCliente = clienteId ? (contratos.data ?? []) : []
  const ultima = useUltimaNotaDoContrato(tipo === 'contrato' ? contratoId || undefined : undefined)
  const mensalidades = useMensalidadesDoContrato(
    tipo === 'contrato' ? contratoId || undefined : undefined,
  )

  // Ao escolher o contrato numa nota nova: valor, vencimento, forma e descrição vêm dele.
  // Se houver nota anterior, "Copiar dados da última" continua disponível por cima disso.
  const preenchido = useRef(editando ? contratoId : '')
  const contratoEscolhido = contratosDoCliente.find((c) => c.id === contratoId)
  useEffect(() => {
    if (editando || tipo !== 'contrato' || !contratoEscolhido || !mensalidades.isFetched) return
    if (preenchido.current === contratoEscolhido.id) return
    preenchido.current = contratoEscolhido.id
    const competencia = form.getValues('competencia')
    const mensalidade = (mensalidades.data ?? []).find(
      (m) => m.competencia.slice(0, 7) === competencia,
    )
    const vencimento =
      mensalidade?.vencimento ?? vencimentoDoContrato(competencia, contratoEscolhido)
    const n = notaDoContrato(contratoEscolhido, vencimento)
    form.setValue('valor_servico', valorParaCampo(mensalidade?.valor ?? n.valor))
    form.setValue('vencimento', vencimento ?? '')
    form.setValue('forma_pagamento', n.forma_pagamento)
    form.setValue('descricao', n.descricao)
    form.setValue('lancamento_id', mensalidade?.id ?? '')
  }, [editando, tipo, contratoEscolhido, mensalidades.isFetched, mensalidades.data, form])

  function aoEscolherCliente(c: ClienteEscolhido | null) {
    form.setValue('cliente_id', c?.id ?? '', { shouldValidate: !!c })
    form.setValue('cliente_nome', c?.nome ?? '')
    form.setValue('contrato_id', '')
    form.setValue('lancamento_id', '')
  }

  function gravar(d: Dados) {
    return salvar.mutateAsync({
      id: nota?.id,
      dados: {
        tipo: d.tipo,
        status: d.status as StatusNota,
        cliente_id: d.cliente_id,
        contrato_id: d.tipo === 'contrato' ? ouNulo(d.contrato_id) : null,
        lancamento_id: ouNulo(d.lancamento_id),
        numero: ouNulo(d.numero),
        data_emissao: d.data_emissao,
        competencia: `${d.competencia}-01`,
        vencimento: ouNulo(d.vencimento),
        forma_pagamento: (ouNulo(d.forma_pagamento) as FormaPagamento | null) ?? null,
        valor_servico: lerValor(d.valor_servico)!,
        descricao: d.descricao.trim(),
        codigo_tributacao: ouNulo(d.codigo_tributacao),
        codigo_nbs: ouNulo(d.codigo_nbs),
        iss_retido: d.iss_retido,
        aliquota_iss: numeroOuNulo(d.aliquota_iss),
        pis_cofins_retidos: retemPisCofins(Number(d.tp_ret_piscofins)),
        aliquota_pis: numeroOuNulo(d.aliquota_pis),
        aliquota_cofins: numeroOuNulo(d.aliquota_cofins),
        valor_pis: numeroOuNulo(d.valor_pis),
        valor_cofins: numeroOuNulo(d.valor_cofins),
        aliquota_csll: numeroOuNulo(d.aliquota_csll),
        valor_csll: numeroOuNulo(d.valor_csll),
        aliquota_irrf: numeroOuNulo(d.aliquota_irrf),
        valor_irrf: numeroOuNulo(d.valor_irrf),
        aliquota_inss: numeroOuNulo(d.aliquota_inss),
        valor_inss: numeroOuNulo(d.valor_inss),
        municipio_prestacao: ouNulo(d.municipio_prestacao),
        cst_piscofins: ouNulo(d.cst_piscofins),
        trib_issqn: Number(d.trib_issqn || 1),
        tp_imunidade: d.trib_issqn === '2' && d.tp_imunidade !== '' ? Number(d.tp_imunidade) : null,
        tp_ret_piscofins: Number(d.tp_ret_piscofins || 0),
        observacoes: ouNulo(d.observacoes),
      },
    })
  }

  function mostrarErro(erro: unknown) {
    form.setError('root', { message: mensagemDeErro(erro) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function enviar(d: Dados) {
    try {
      const id = await gravar(d)
      navegar(`/financeiro/notas/${id}`, { replace: true })
    } catch (erro) {
      mostrarErro(erro)
    }
  }

  /** Antes de emitir: grava o que foi conferido, ainda como rascunho. */
  function salvarRascunho() {
    return new Promise<boolean>((resolve) => {
      void form.handleSubmit(
        async (d) => {
          try {
            await gravar({ ...d, status: 'rascunho' })
            form.reset({ ...d, status: 'rascunho' })
            resolve(true)
          } catch (erro) {
            mostrarErro(erro)
            resolve(false)
          }
        },
        () => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
          resolve(false)
        },
      )()
    })
  }

  const titulo = editando
    ? `${nota.numero ? `NF ${nota.numero}` : 'Nota fiscal'} · ${formatarMes(nota.competencia)}`
    : tipo === 'contrato'
      ? 'Nova nota de contrato'
      : 'Nova nota avulsa'

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navegar(-1)}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar
      </button>
      <h1 className="text-2xl font-bold">{titulo}</h1>
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      {nota?.status === 'rascunho' && (
        <Aviso>
          Rascunho montado pelo sistema a partir da última nota do contrato. Confira e emita pelo
          sistema (mais abaixo) ou, se emitir no Safenota, preencha o número, mude a situação para{' '}
          <strong>Emitida</strong> e anexe o PDF: o sistema manda ao cliente.
        </Aviso>
      )}
      {nota?.importada_de && (
        <Aviso>
          Importada do {nota.importada_de}
          {nota.numero_dps && ` (DPS ${nota.numero_dps})`}.
        </Aviso>
      )}

      <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-5">
        <Card className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tipo de nota" htmlFor="tipo" obrigatorio>
            <SelectForm id="tipo" control={form.control} name="tipo">
              <option value="contrato">Contrato (mensalidade)</option>
              <option value="avulsa">Serviço avulso</option>
            </SelectForm>
          </Campo>
          <Campo rotulo="Situação" htmlFor="status">
            <SelectForm id="status" control={form.control} name="status">
              <option value="rascunho">Rascunho (a emitir)</option>
              <option value="emitida">Emitida</option>
              <option value="cancelada">Cancelada</option>
            </SelectForm>
          </Campo>
          <Campo
            rotulo="Cliente (tomador)"
            htmlFor="cliente"
            obrigatorio
            erro={errors.cliente_id?.message}
            className="sm:col-span-2"
          >
            {editando ? (
              <p className="flex min-h-11 items-center font-semibold">
                <Link to={`/clientes/${clienteId}`} className="text-verde underline">
                  {clienteNome}
                </Link>
              </p>
            ) : (
              <ClienteSeletor
                id="cliente"
                valor={clienteId ? { id: clienteId, nome: clienteNome } : null}
                aoMudar={aoEscolherCliente}
              />
            )}
          </Campo>
          {tipo === 'contrato' && (
            <Campo
              rotulo="Contrato"
              htmlFor="contrato"
              obrigatorio
              erro={errors.contrato_id?.message}
              className="sm:col-span-2"
            >
              <SelectForm
                id="contrato"
                control={form.control}
                name="contrato_id"
                disabled={!clienteId}
              >
                <option value="">{clienteId ? 'Escolha…' : 'Escolha o cliente antes'}</option>
                {contratosDoCliente.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao} · {formatarReais(c.valor_mensal)}/mês
                    {c.status !== 'ativo' ? ` (${c.status})` : ''}
                  </option>
                ))}
              </SelectForm>
            </Campo>
          )}
          {!editando && tipo === 'contrato' && ultima.data && (
            <CopiarUltima
              form={form}
              ultima={ultima.data}
              valorContrato={contratosDoCliente.find((c) => c.id === contratoId)?.valor_mensal}
              mensalidades={mensalidades.data ?? []}
            />
          )}
        </Card>

        <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo rotulo="Número da nota" htmlFor="numero" erro={errors.numero?.message}>
            <Input id="numero" inputMode="numeric" {...form.register('numero')} />
          </Campo>
          <Campo
            rotulo="Emitida em"
            htmlFor="emissao"
            obrigatorio
            erro={errors.data_emissao?.message}
          >
            <Input id="emissao" type="date" {...form.register('data_emissao')} />
          </Campo>
          <Campo
            rotulo="Mês de competência"
            htmlFor="competencia"
            obrigatorio
            erro={errors.competencia?.message}
          >
            <Input id="competencia" type="month" {...form.register('competencia')} />
          </Campo>
          <Campo rotulo="Vencimento" htmlFor="vencimento">
            <Input id="vencimento" type="date" {...form.register('vencimento')} />
          </Campo>
          <Campo rotulo="Forma de pagamento" htmlFor="forma">
            <SelectForm id="forma" control={form.control} name="forma_pagamento">
              <option value="">—</option>
              {FORMAS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </SelectForm>
          </Campo>
          {tipo === 'contrato' && contratoId && (
            <Campo
              rotulo="Conta a receber (mensalidade)"
              htmlFor="lancamento"
              className="sm:col-span-2 lg:col-span-3"
              dica="O número da nota passa a aparecer nesta conta a receber."
            >
              <SelectForm id="lancamento" control={form.control} name="lancamento_id">
                <option value="">Não ligar</option>
                {(mensalidades.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatarMes(m.competencia)} · vence {formatarData(m.vencimento)} ·{' '}
                    {formatarReais(m.valor)}
                    {m.numero_nota_fiscal ? ` · NF ${m.numero_nota_fiscal}` : ''}
                  </option>
                ))}
              </SelectForm>
            </Campo>
          )}
          <Campo
            rotulo="Descrição do serviço (como na nota)"
            htmlFor="descricao"
            obrigatorio
            erro={errors.descricao?.message}
            className="sm:col-span-2 lg:col-span-3"
          >
            <Textarea id="descricao" rows={4} {...form.register('descricao')} />
          </Campo>
        </Card>

        <Impostos form={form} />

        <Card>
          <Campo rotulo="Observações" htmlFor="obs">
            <Textarea id="obs" {...form.register('observacoes')} />
          </Campo>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {nota?.status === 'rascunho' && (
            <Button
              variante="secundario"
              className="sm:mr-auto"
              disabled={descartar.isPending}
              onClick={() => {
                if (!window.confirm('Descartar este rascunho? Ele não vai ser emitido.')) return
                descartar
                  .mutateAsync(nota.id)
                  .then(() => navegar('/financeiro/notas?status=rascunho', { replace: true }))
                  .catch((e: unknown) => form.setError('root', { message: mensagemDeErro(e) }))
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Descartar rascunho
            </Button>
          )}
          <Link
            to="/financeiro/notas"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Registrar nota'}
          </Button>
        </div>
      </form>

      {nota && nota.status !== 'cancelada' && <BoletoNota nota={nota} />}
      {nota && <AvisoSubstituicao nota={nota} />}
      {nota?.status === 'rascunho' && <EmissaoNota nota={nota} salvarAntes={salvarRascunho} />}
      {nota?.status === 'emitida' && <EmissaoNota nota={nota} modelo />}
      {nota?.status === 'emitida' && <EnvioNota nota={nota} />}
      {nota && <CancelamentoNota nota={nota} />}
    </div>
  )
}

/**
 * Preenche a nota nova copiando a última do contrato, como o financeiro faz à mão:
 * mesma descrição e impostos. Se o contrato mudou de valor (aditivo), usa o novo
 * e ajusta os impostos na mesma proporção.
 */
function CopiarUltima({
  form,
  ultima,
  valorContrato,
  mensalidades,
}: {
  form: UseFormReturn<Dados>
  ultima: Tables<'notas_fiscais'>
  valorContrato: number | undefined
  mensalidades: { id: string; competencia: string; vencimento: string }[]
}) {
  const valor = Number(valorContrato ?? ultima.valor_servico)
  const fator = valor / Number(ultima.valor_servico)
  const ajustar = (v: number | null) => valorParaCampo(v == null ? null : v * fator)

  function copiar() {
    const mensalidade = mensalidades.find(
      (m) => m.competencia === somarMeses(ultima.competencia, 1),
    )
    const proxima = proximaNota(ultima, mensalidade?.vencimento)
    form.setValue('competencia', mesDe(proxima.competencia))
    form.setValue('vencimento', proxima.vencimento ?? '')
    form.setValue('lancamento_id', mensalidade?.id ?? '')
    form.setValue('valor_servico', valorParaCampo(valor))
    form.setValue('descricao', proxima.descricao)
    form.setValue('forma_pagamento', ultima.forma_pagamento ?? '')
    form.setValue('codigo_tributacao', ultima.codigo_tributacao ?? '')
    form.setValue('codigo_nbs', ultima.codigo_nbs ?? '')
    form.setValue('iss_retido', ultima.iss_retido)
    form.setValue('aliquota_iss', percentualParaCampo(ultima.aliquota_iss))
    form.setValue('pis_cofins_retidos', ultima.pis_cofins_retidos)
    form.setValue('aliquota_pis', percentualParaCampo(ultima.aliquota_pis))
    form.setValue('aliquota_cofins', percentualParaCampo(ultima.aliquota_cofins))
    form.setValue('valor_pis', ajustar(ultima.valor_pis))
    form.setValue('valor_cofins', ajustar(ultima.valor_cofins))
    // Com alíquota, o valor sai da conta; sem ela (notas antigas), na proporção.
    const porAliquota = (aliquota: number | null, antigo: number | null) =>
      aliquota != null ? valorParaCampo(valorPorAliquota(valor, Number(aliquota))) : ajustar(antigo)
    const base = Number(ultima.valor_servico)
    form.setValue('aliquota_csll', aliquotaDaNota(ultima.aliquota_csll, ultima.valor_csll, base))
    form.setValue('valor_csll', porAliquota(ultima.aliquota_csll, ultima.valor_csll))
    form.setValue('aliquota_irrf', aliquotaDaNota(ultima.aliquota_irrf, ultima.valor_irrf, base))
    form.setValue('valor_irrf', porAliquota(ultima.aliquota_irrf, ultima.valor_irrf))
    form.setValue('aliquota_inss', aliquotaDaNota(ultima.aliquota_inss, ultima.valor_inss, base))
    form.setValue('valor_inss', porAliquota(ultima.aliquota_inss, ultima.valor_inss))
    form.setValue('municipio_prestacao', ultima.municipio_prestacao ?? '')
    form.setValue('cst_piscofins', ultima.cst_piscofins ?? '')
    form.setValue('trib_issqn', String(ultima.trib_issqn ?? 1))
    form.setValue('tp_imunidade', ultima.tp_imunidade == null ? '' : String(ultima.tp_imunidade))
    form.setValue('tp_ret_piscofins', String(tipoRetencaoPisCofins(ultima)))
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-lima-claro p-3 text-sm sm:col-span-2">
      <p>
        Última nota deste contrato: <strong>NF {ultima.numero ?? '—'}</strong> de{' '}
        {formatarMes(ultima.competencia)}, {formatarReais(ultima.valor_servico)}.
        {fator !== 1 && (
          <>
            {' '}
            O contrato agora vale <strong>{formatarReais(valor)}</strong>: os impostos são ajustados
            na mesma proporção.
          </>
        )}{' '}
        A cópia já avança o mês e o vencimento (também na descrição): confira antes de salvar.
      </p>
      <Button variante="secundario" onClick={copiar}>
        <Copy className="size-4" aria-hidden /> Copiar dados da última
      </Button>
    </div>
  )
}

/** Tributação no mesmo arranjo do emissor que o financeiro usava (Safe Nota). */
function Impostos({ form }: { form: UseFormReturn<Dados> }) {
  const d = useWatch({ control: form.control })
  const valor = lerValor(d.valor_servico ?? '') ?? 0
  const csllDaEmpresa = useAliquotaCsll().data ?? 1
  const ibsCbs = useIbsCbs().data
  const tipo = Number(d.tp_ret_piscofins || 0)
  const retemCsll = RETENCOES_PISCOFINS[tipo]?.retidos[2] ?? false

  // Tipo que retém CSLL e a alíquota vazia: a da empresa (configuração).
  useEffect(() => {
    if (retemCsll && !form.getValues('aliquota_csll'))
      form.setValue('aliquota_csll', percentualParaCampo(csllDaEmpresa))
  }, [retemCsll, csllDaEmpresa, form])

  // PIS, COFINS e CSLL saem da conta (o fisco confere): ao mudar o valor, as alíquotas,
  // o tipo de retenção ou o CST, recalcula. Ao abrir uma nota salva, mantém o que ela tem.
  const entrada = [
    d.valor_servico,
    d.aliquota_pis,
    d.aliquota_cofins,
    d.aliquota_csll,
    d.tp_ret_piscofins,
    d.cst_piscofins,
  ].join('|')
  const anterior = useRef(entrada)
  useEffect(() => {
    if (anterior.current === entrada) return
    anterior.current = entrada
    const r = calcularPisCofins({
      valor,
      aliquotaPis: lerValor(d.aliquota_pis ?? ''),
      aliquotaCofins: lerValor(d.aliquota_cofins ?? ''),
      tipoRetencao: tipo,
      cst: d.cst_piscofins ?? '',
      aliquotaCsll: lerValor(d.aliquota_csll ?? ''),
    })
    form.setValue('valor_pis', valorParaCampo(r.pis))
    form.setValue('valor_cofins', valorParaCampo(r.cofins))
    form.setValue('valor_csll', valorParaCampo(r.csll))
  }, [entrada]) // eslint-disable-line react-hooks/exhaustive-deps

  // CP e IRRF pela alíquota: com a porcentagem preenchida, o valor em reais sai da conta.
  // Sem ela, vale o valor digitado.
  const entradaAliquotas = `${d.valor_servico}|${d.aliquota_inss}|${d.aliquota_irrf}`
  const anteriorAliquotas = useRef(entradaAliquotas)
  useEffect(() => {
    if (anteriorAliquotas.current === entradaAliquotas) return
    anteriorAliquotas.current = entradaAliquotas
    for (const [aliquota, campo] of [
      [d.aliquota_inss, 'valor_inss'],
      [d.aliquota_irrf, 'valor_irrf'],
    ] as const) {
      const a = lerValor(aliquota ?? '')
      if (a != null) form.setValue(campo, valorParaCampo(valorPorAliquota(valor, a)))
    }
  }, [entradaAliquotas]) // eslint-disable-line react-hooks/exhaustive-deps

  const contas = {
    aliquota_iss: lerValor(d.aliquota_iss ?? ''),
    valor_servico: valor,
    pis_cofins_retidos: retemPisCofins(tipo),
    tp_ret_piscofins: tipo,
    valor_pis: lerValor(d.valor_pis ?? ''),
    valor_cofins: lerValor(d.valor_cofins ?? ''),
    valor_csll: lerValor(d.valor_csll ?? ''),
    valor_irrf: lerValor(d.valor_irrf ?? ''),
    valor_inss: lerValor(d.valor_inss ?? ''),
  }
  // Uma conta só: cada tributo retido, o total federal (sem ISS) e o total com o ISS.
  const porTributo = retencoes({ ...contas, iss_retido: !!d.iss_retido })
  const federais = somaRetencoes({ ...porTributo, iss: 0 })
  const retido = somaRetencoes(porTributo)
  const [pisRetido, cofinsRetido] = RETENCOES_PISCOFINS[tipo]?.retidos ?? []
  // PIS, COFINS e CSLL: primeiro a soma dos três, depois cada um.
  const contribuicoes = (
    [
      ['PIS', porTributo.pis],
      ['COFINS', porTributo.cofins],
      ['CSLL', porTributo.csll],
    ] as const
  ).filter(([, v]) => v > 0)
  const somaContribuicoes =
    Math.round((porTributo.pis + porTributo.cofins + porTributo.csll) * 100) / 100
  const linhasFederais: { nome: string; valor: number; detalhe?: boolean }[] = [
    ...(contribuicoes.length > 1
      ? [
          { nome: contribuicoes.map(([n]) => n).join(' + '), valor: somaContribuicoes },
          ...contribuicoes.map(([nome, valor]) => ({ nome, valor, detalhe: true })),
        ]
      : contribuicoes.map(([nome, valor]) => ({ nome, valor }))),
    ...(
      [
        ['IRRF', porTributo.irrf],
        ['INSS (CP)', porTributo.inss],
      ] as const
    )
      .filter(([, v]) => v > 0)
      .map(([nome, valor]) => ({ nome, valor })),
  ]

  return (
    <>
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="font-bold sm:col-span-2 lg:col-span-4">Serviço</h2>
        <Campo rotulo="Código de tributação nacional" htmlFor="ctn" className="lg:col-span-2">
          <CampoCodigoNfse
            id="ctn"
            lista="tributacao"
            placeholder="Clique para ver a lista ou digite (ex.: dedetização)"
            valor={d.codigo_tributacao ?? ''}
            aoMudar={(c) => form.setValue('codigo_tributacao', c, { shouldDirty: true })}
          />
        </Campo>
        <Campo rotulo="Código NBS" htmlFor="nbs" className="lg:col-span-2">
          <CampoCodigoNfse
            id="nbs"
            lista="nbs"
            placeholder="Clique para ver a lista ou digite (ex.: pragas)"
            valor={d.codigo_nbs ?? ''}
            aoMudar={(c) => form.setValue('codigo_nbs', c, { shouldDirty: true })}
          />
        </Campo>
        <Campo
          rotulo="Município da prestação (IBGE)"
          htmlFor="mun"
          dica="Vazio = cidade do endereço do cliente."
          erro={form.formState.errors.municipio_prestacao?.message}
        >
          <Input
            id="mun"
            inputMode="numeric"
            placeholder="4314902"
            {...form.register('municipio_prestacao')}
          />
        </Campo>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="font-bold sm:col-span-2 lg:col-span-4">Valores</h2>
        <CampoValor
          form={form}
          nome="valor_servico"
          rotulo="Valor do(s) serviço(s) (R$)"
          obrigatorio
        />
        <CampoPercentual form={form} nome="aliquota_iss" rotulo="Alíquota ISS (%)" />
        <TributacaoIss form={form} />
        <Campo rotulo="Tipo de retenção do ISSQN" htmlFor="retiss">
          <Select
            id="retiss"
            value={d.iss_retido ? '2' : '1'}
            onChange={(e) =>
              form.setValue('iss_retido', e.target.value === '2', { shouldDirty: true })
            }
          >
            <option value="1">Não retido</option>
            <option value="2">Retido pelo tomador</option>
          </Select>
        </Campo>
        {d.iss_retido && <AliquotaDaCidade form={form} />}
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="font-bold sm:col-span-2 lg:col-span-4">Retenções federais</h2>
        <Campo rotulo="Base de cálculo (R$)" htmlFor="base">
          <Input id="base" readOnly tabIndex={-1} value={valorParaCampo(valor)} />
        </Campo>
        <CampoPercentual form={form} nome="aliquota_inss" rotulo="Alíquota CP (%)" />
        <CampoValor form={form} nome="valor_inss" rotulo="Valor CP retido (R$)" />
        <div className="hidden lg:block" />
        <CampoPercentual form={form} nome="aliquota_irrf" rotulo="Alíquota IRRF (%)" />
        <CampoValor form={form} nome="valor_irrf" rotulo="Valor IRRF retido (R$)" />
        <Campo rotulo="Situação tributária (CST)" htmlFor="cst" className="sm:col-span-2">
          <SelectForm id="cst" control={form.control} name="cst_piscofins">
            <option value="">Padrão da empresa (01 · tributável)</option>
            {Object.entries(CST_PISCOFINS).map(([v, r]) => (
              <option key={v} value={v}>
                {v} · {r}
              </option>
            ))}
          </SelectForm>
        </Campo>
        <Campo
          rotulo="Tipo de retenção PIS/COFINS"
          htmlFor="tpret"
          className="sm:col-span-2 lg:col-span-4"
        >
          <SelectForm id="tpret" control={form.control} name="tp_ret_piscofins">
            {Object.entries(RETENCOES_PISCOFINS).map(([v, r]) => (
              <option key={v} value={v}>
                {r.rotulo}
              </option>
            ))}
          </SelectForm>
        </Campo>
        <CampoPercentual form={form} nome="aliquota_pis" rotulo="Alíquota PIS (%)" />
        <CampoValor form={form} nome="valor_pis" rotulo="Valor PIS (R$)" />
        <CampoPercentual form={form} nome="aliquota_cofins" rotulo="Alíquota COFINS (%)" />
        <CampoValor form={form} nome="valor_cofins" rotulo="Valor COFINS (R$)" />
        {pisRetido && (
          <Campo rotulo="Valor PIS retido (R$)" htmlFor="pisret">
            <Input id="pisret" readOnly tabIndex={-1} value={valorParaCampo(porTributo.pis)} />
          </Campo>
        )}
        {cofinsRetido && (
          <Campo rotulo="Valor COFINS retido (R$)" htmlFor="cofinsret">
            <Input
              id="cofinsret"
              readOnly
              tabIndex={-1}
              value={valorParaCampo(porTributo.cofins)}
            />
          </Campo>
        )}
        {(pisRetido || cofinsRetido) && <div className="hidden lg:col-span-2 lg:block" />}
        {retemCsll && (
          <>
            <CampoPercentual form={form} nome="aliquota_csll" rotulo="Alíquota CSLL (%)" />
            <CampoValor form={form} nome="valor_csll" rotulo="Valor CSLL retido (R$)" />
          </>
        )}
        <div className="flex flex-col justify-end gap-1 text-sm sm:col-span-2 lg:col-span-4 lg:items-end">
          {linhasFederais.length > 0 && (
            <dl className="grid grid-cols-[auto_auto] gap-x-4 text-right">
              {linhasFederais.map(({ nome, valor: v, detalhe }) => (
                <Fragment key={nome}>
                  <dt className={detalhe ? 'text-texto-suave' : undefined}>
                    {detalhe ? `↳ ${nome}` : `${nome} retido${nome.includes('+') ? 's' : ''}`}:
                  </dt>
                  <dd className={detalhe ? 'text-texto-suave' : 'font-semibold'}>
                    {formatarReais(v)}
                  </dd>
                </Fragment>
              ))}
            </dl>
          )}
          <span className={linhasFederais.length > 0 ? 'border-t border-borda pt-1' : undefined}>
            Total tributos federais retidos: <strong>{formatarReais(federais)}</strong>
          </span>
          {d.iss_retido && (
            <span>
              Com o ISS retido: <strong>{formatarReais(retido)}</strong>
            </span>
          )}
          <span>
            Valor líquido a receber:{' '}
            <strong className="text-verde">{formatarReais(valor - retido)}</strong>
          </span>
        </div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">IBS/CBS</h2>
        <Campo rotulo="Situação tributária" htmlFor="ibscst">
          <Input
            id="ibscst"
            readOnly
            tabIndex={-1}
            value={
              ibsCbs ? `${ibsCbs.cst}${ibsCbs.cst === '000' ? ' - Tributação integral' : ''}` : ''
            }
          />
        </Campo>
        <Campo rotulo="Classificação tributária" htmlFor="ibsclass">
          <Input
            id="ibsclass"
            readOnly
            tabIndex={-1}
            value={
              ibsCbs
                ? `${ibsCbs.classificacao}${ibsCbs.classificacao === '000001' ? ' - Situações tributadas integralmente pelo IBS e CBS' : ''}`
                : ''
            }
          />
        </Campo>
        <p className="text-sm text-texto-suave sm:col-span-2">
          Vai igual em todas as notas, pela configuração da empresa. Os valores de IBS e CBS só
          entram a partir de 2027.
        </p>
      </Card>
    </>
  )
}

/**
 * ISS retido pelo tomador: a alíquota é a da cidade de incidência (a da prestação ou a
 * do endereço do cliente), como está no Sistema Nacional. Busca sozinha quando a
 * alíquota está vazia; o botão busca de novo.
 */
function AliquotaDaCidade({ form }: { form: UseFormReturn<Dados> }) {
  const [clienteId, contratoId, municipio, codigo, aliquota] = useWatch({
    control: form.control,
    name: ['cliente_id', 'contrato_id', 'municipio_prestacao', 'codigo_tributacao', 'aliquota_iss'],
  })
  const buscar = useAliquotaIssDaCidade()
  const [aviso, setAviso] = useState<string | null>(null)
  const pronto = !!clienteId && codigo.replace(/\D/g, '').length === 6

  async function consultar() {
    setAviso(null)
    try {
      const r = await buscar.mutateAsync({
        clienteId,
        contratoId: contratoId || null,
        municipio: municipio || null,
        codigoTributacao: codigo,
      })
      if (r.aliquota != null) {
        form.setValue('aliquota_iss', percentualParaCampo(r.aliquota), { shouldDirty: true })
        setAviso(
          `Alíquota do município ${r.municipio} no Sistema Nacional: ${percentualParaCampo(r.aliquota)}%${r.codigoServico ? ` (serviço ${r.codigoServico})` : ''}.`,
        )
      } else
        setAviso(
          `O Sistema Nacional não devolveu alíquota para o município ${r.municipio}. Informe à mão.${r.detalhe ? ` (${r.detalhe})` : ''}`,
        )
    } catch (e) {
      setAviso(mensagemDeErro(e))
    }
  }

  const tentado = useRef('')
  useEffect(() => {
    const chave = `${clienteId}|${municipio}|${codigo}`
    if (!pronto || aliquota || tentado.current === chave) return
    tentado.current = chave
    void consultar()
  }, [pronto, aliquota, clienteId, municipio, codigo]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-lima-claro p-3 text-sm sm:col-span-2 lg:col-span-4">
      <p className="flex-1">
        {aviso ??
          (pronto
            ? 'Retido pelo tomador: o ISS vai pela alíquota da cidade do cliente.'
            : 'Retido pelo tomador: escolha o cliente e o código de tributação para buscar a alíquota da cidade.')}
      </p>
      <Button
        variante="secundario"
        disabled={!pronto || buscar.isPending}
        onClick={() => void consultar()}
      >
        <MapPin className="size-4" aria-hidden />
        {buscar.isPending ? 'Buscando…' : 'Buscar alíquota da cidade'}
      </Button>
    </div>
  )
}

/** tribISSQN e tpImunidade do leiaute nacional. */
const TRIBUTACAO_ISS: Record<string, string> = {
  '1': 'Operação tributável',
  '2': 'Imunidade',
  '3': 'Exportação de serviço',
  '4': 'Não incidência',
}
const IMUNIDADE: Record<string, string> = {
  '1': 'Patrimônio, renda ou serviços (art. 150, VI, a)',
  '2': 'Templos de qualquer culto',
  '3': 'Partidos, sindicatos, educação e assistência social',
  '4': 'Livros, jornais e papel',
  '5': 'Fonogramas e videofonogramas',
  '0': 'Imunidade (tipo não informado)',
}

function TributacaoIss({ form }: { form: UseFormReturn<Dados> }) {
  const trib = useWatch({ control: form.control, name: 'trib_issqn' })
  return (
    <>
      <Campo rotulo="Tributação do ISSQN" htmlFor="tribiss">
        <SelectForm id="tribiss" control={form.control} name="trib_issqn">
          {Object.entries(TRIBUTACAO_ISS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </SelectForm>
      </Campo>
      {trib === '2' && (
        <Campo rotulo="Tipo imunidade" htmlFor="imun" className="sm:col-span-2">
          <SelectForm id="imun" control={form.control} name="tp_imunidade">
            <option value="">Escolha…</option>
            {Object.entries(IMUNIDADE).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </SelectForm>
        </Campo>
      )}
    </>
  )
}

const CST_PISCOFINS: Record<string, string> = {
  '00': 'Nenhum',
  '01': 'Tributável (alíquota básica)',
  '02': 'Tributável (alíquota diferenciada)',
  '06': 'Alíquota zero',
  '07': 'Isenta',
  '08': 'Sem incidência',
  '09': 'Com suspensão',
}

type CampoTexto = Exclude<keyof Dados, 'tipo' | 'status' | 'iss_retido' | 'pis_cofins_retidos'>

function CampoValor({
  form,
  nome,
  rotulo,
  obrigatorio,
}: {
  form: UseFormReturn<Dados>
  nome: CampoTexto
  rotulo: string
  obrigatorio?: boolean
}) {
  const registro = form.register(nome)
  return (
    <Campo
      rotulo={rotulo}
      htmlFor={nome}
      obrigatorio={obrigatorio}
      erro={form.formState.errors[nome]?.message}
    >
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

function CampoPercentual({
  form,
  nome,
  rotulo,
}: {
  form: UseFormReturn<Dados>
  nome: CampoTexto
  rotulo: string
}) {
  return (
    <Campo rotulo={rotulo} htmlFor={nome} erro={form.formState.errors[nome]?.message}>
      <Input id={nome} inputMode="decimal" placeholder="0,00" {...form.register(nome)} />
    </Campo>
  )
}
