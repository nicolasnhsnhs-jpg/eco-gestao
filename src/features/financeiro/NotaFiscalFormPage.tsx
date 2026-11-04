import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Copy, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { SelectForm } from '@/components/ui/SelectForm'
import type { Tables } from '@/lib/database.types'
import { formatarData, formatarMes, hojeISO, mesDe, somarMeses } from '@/lib/datas'
import { formatarReais, lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useContratos } from '../contratos/api'
import { EmissaoNota } from './EmissaoNota'
import { EnvioNota } from './EnvioNota'
import {
  calcularPisCofins,
  notaDoContrato,
  proximaNota,
  totalRetido,
  vencimentoDoContrato,
} from './notas'
import {
  useAliquotaCsll,
  useDescartarRascunho,
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
    valor_csll: valorOpcional,
    valor_irrf: valorOpcional,
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
    message: 'Informe o número da nota emitida.',
  })
type Dados = z.infer<typeof esquema>

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())
const numeroOuNulo = (v: string) => (v.trim() === '' ? null : lerValor(v))
/** Percentual com vírgula: 0.65 → "0,65". */
const percentualParaCampo = (v: number | null | undefined) =>
  v == null ? '' : String(v).replace('.', ',')

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
      valor_csll: valorParaCampo(nota.valor_csll),
      valor_irrf: valorParaCampo(nota.valor_irrf),
      valor_inss: valorParaCampo(nota.valor_inss),
      municipio_prestacao: nota.municipio_prestacao ?? '',
      cst_piscofins: nota.cst_piscofins ?? '',
      trib_issqn: String(nota.trib_issqn ?? 1),
      tp_imunidade: nota.tp_imunidade == null ? '' : String(nota.tp_imunidade),
      tp_ret_piscofins: nota.tp_ret_piscofins == null ? '' : String(nota.tp_ret_piscofins),
      observacoes: nota.observacoes ?? '',
    }
  const hoje = hojeISO()
  return {
    tipo: p.get('tipo') === 'avulsa' ? 'avulsa' : 'contrato',
    status: 'emitida',
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
    valor_csll: '',
    valor_irrf: '',
    valor_inss: '',
    municipio_prestacao: '',
    cst_piscofins: '',
    trib_issqn: '1',
    tp_imunidade: '',
    tp_ret_piscofins: '',
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
        pis_cofins_retidos: d.pis_cofins_retidos,
        aliquota_pis: numeroOuNulo(d.aliquota_pis),
        aliquota_cofins: numeroOuNulo(d.aliquota_cofins),
        valor_pis: numeroOuNulo(d.valor_pis),
        valor_cofins: numeroOuNulo(d.valor_cofins),
        valor_csll: numeroOuNulo(d.valor_csll),
        valor_irrf: numeroOuNulo(d.valor_irrf),
        valor_inss: numeroOuNulo(d.valor_inss),
        municipio_prestacao: ouNulo(d.municipio_prestacao),
        cst_piscofins: ouNulo(d.cst_piscofins),
        trib_issqn: Number(d.trib_issqn || 1),
        tp_imunidade: d.trib_issqn === '2' && d.tp_imunidade !== '' ? Number(d.tp_imunidade) : null,
        tp_ret_piscofins: d.tp_ret_piscofins === '' ? null : Number(d.tp_ret_piscofins),
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
          <CampoValor form={form} nome="valor_servico" rotulo="Valor do serviço (R$)" obrigatorio />
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

      {nota?.status === 'rascunho' && <EmissaoNota nota={nota} salvarAntes={salvarRascunho} />}
      {nota?.status === 'emitida' && <EmissaoNota nota={nota} modelo />}
      {nota?.status === 'emitida' && <EnvioNota nota={nota} />}
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
    form.setValue('valor_csll', ajustar(ultima.valor_csll))
    form.setValue('valor_irrf', ajustar(ultima.valor_irrf))
    form.setValue('valor_inss', ajustar(ultima.valor_inss))
    form.setValue('municipio_prestacao', ultima.municipio_prestacao ?? '')
    form.setValue('cst_piscofins', ultima.cst_piscofins ?? '')
    form.setValue('trib_issqn', String(ultima.trib_issqn ?? 1))
    form.setValue('tp_imunidade', ultima.tp_imunidade == null ? '' : String(ultima.tp_imunidade))
    form.setValue(
      'tp_ret_piscofins',
      ultima.tp_ret_piscofins == null ? '' : String(ultima.tp_ret_piscofins),
    )
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

function Impostos({ form }: { form: UseFormReturn<Dados> }) {
  const d = useWatch({ control: form.control })
  const valor = lerValor(d.valor_servico ?? '') ?? 0
  const aliquotaCsll = useAliquotaCsll().data ?? 1

  // PIS, COFINS e CSLL saem da conta (o fisco confere): ao mudar o valor, as alíquotas,
  // a retenção ou o CST, recalcula. Ao abrir uma nota salva, mantém o que ela tem.
  const entrada = [
    d.valor_servico,
    d.aliquota_pis,
    d.aliquota_cofins,
    d.pis_cofins_retidos,
    d.cst_piscofins,
    aliquotaCsll,
  ].join('|')
  const anterior = useRef(entrada)
  useEffect(() => {
    if (anterior.current === entrada) return
    anterior.current = entrada
    const r = calcularPisCofins({
      valor,
      aliquotaPis: lerValor(d.aliquota_pis ?? ''),
      aliquotaCofins: lerValor(d.aliquota_cofins ?? ''),
      retidos: !!d.pis_cofins_retidos,
      cst: d.cst_piscofins ?? '',
      aliquotaCsll,
    })
    form.setValue('valor_pis', valorParaCampo(r.pis))
    form.setValue('valor_cofins', valorParaCampo(r.cofins))
    form.setValue('valor_csll', valorParaCampo(r.csll))
  }, [entrada]) // eslint-disable-line react-hooks/exhaustive-deps
  const retido = totalRetido({
    iss_retido: !!d.iss_retido,
    aliquota_iss: lerValor(d.aliquota_iss ?? ''),
    valor_servico: valor,
    pis_cofins_retidos: !!d.pis_cofins_retidos,
    valor_pis: lerValor(d.valor_pis ?? ''),
    valor_cofins: lerValor(d.valor_cofins ?? ''),
    valor_csll: lerValor(d.valor_csll ?? ''),
    valor_irrf: lerValor(d.valor_irrf ?? ''),
    valor_inss: lerValor(d.valor_inss ?? ''),
  })

  return (
    <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <h2 className="font-bold sm:col-span-2 lg:col-span-4">Tributação e retenções</h2>
      <Campo rotulo="Código de tributação nacional" htmlFor="ctn">
        <Input
          id="ctn"
          inputMode="numeric"
          placeholder="071301"
          {...form.register('codigo_tributacao')}
        />
      </Campo>
      <Campo rotulo="Código NBS" htmlFor="nbs">
        <Input id="nbs" inputMode="numeric" {...form.register('codigo_nbs')} />
      </Campo>
      <Caixa form={form} nome="iss_retido" rotulo="ISS retido pelo tomador" />
      <CampoPercentual form={form} nome="aliquota_iss" rotulo="Alíquota ISS (%)" />
      <TributacaoIss form={form} />
      <Caixa
        form={form}
        nome="pis_cofins_retidos"
        rotulo="PIS, COFINS e CSLL retidos"
        className="sm:col-span-2"
      />
      <CampoPercentual form={form} nome="aliquota_pis" rotulo="Alíquota PIS (%)" />
      <CampoPercentual form={form} nome="aliquota_cofins" rotulo="Alíquota COFINS (%)" />
      <CampoValor form={form} nome="valor_pis" rotulo="PIS (R$)" />
      <CampoValor form={form} nome="valor_cofins" rotulo="COFINS (R$)" />
      <CampoValor form={form} nome="valor_csll" rotulo="CSLL (R$)" />
      <CampoValor form={form} nome="valor_irrf" rotulo="IRRF (R$)" />
      <CampoValor form={form} nome="valor_inss" rotulo="INSS (R$)" />
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
      <Campo rotulo="CST do PIS/COFINS" htmlFor="cst">
        <SelectForm id="cst" control={form.control} name="cst_piscofins">
          <option value="">Padrão da empresa</option>
          {Object.entries(CST_PISCOFINS).map(([v, r]) => (
            <option key={v} value={v}>
              {v} · {r}
            </option>
          ))}
        </SelectForm>
      </Campo>
      <Campo rotulo="Retenção federal (na nota)" htmlFor="tpret" className="sm:col-span-2">
        <SelectForm id="tpret" control={form.control} name="tp_ret_piscofins">
          <option value="">Pela caixa de PIS, COFINS e CSLL retidos</option>
          {Object.entries(RETENCAO_PISCOFINS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </SelectForm>
      </Campo>
      <div className="flex flex-col justify-end gap-1 text-sm sm:col-span-2 lg:col-span-3 lg:items-end">
        <span>
          Retido pelo tomador: <strong>{formatarReais(retido)}</strong>
        </span>
        <span>
          Valor líquido a receber:{' '}
          <strong className="text-verde">{formatarReais(valor - retido)}</strong>
        </span>
      </div>
    </Card>
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
      <Campo rotulo="Tributação do ISS" htmlFor="tribiss">
        <SelectForm id="tribiss" control={form.control} name="trib_issqn">
          {Object.entries(TRIBUTACAO_ISS).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </SelectForm>
      </Campo>
      {trib === '2' && (
        <Campo rotulo="Tipo de imunidade" htmlFor="imun" className="sm:col-span-2">
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

/** tpRetPisCofins do leiaute nacional. */
const RETENCAO_PISCOFINS: Record<string, string> = {
  '0': 'PIS, COFINS e CSLL não retidos',
  '1': 'PIS e COFINS retidos',
  '2': 'PIS e COFINS não retidos',
  '3': 'PIS, COFINS e CSLL retidos',
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

function Caixa({
  form,
  nome,
  rotulo,
  className,
}: {
  form: UseFormReturn<Dados>
  nome: 'iss_retido' | 'pis_cofins_retidos'
  rotulo: string
  className?: string
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-borda px-3 has-checked:border-verde has-checked:bg-lima-claro ${className ?? ''}`}
    >
      <input type="checkbox" className="size-5 shrink-0 accent-verde" {...form.register(nome)} />
      <span className="text-sm font-semibold">{rotulo}</span>
    </label>
  )
}
