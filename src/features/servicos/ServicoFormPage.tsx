import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { SelectForm } from '@/components/ui/SelectForm'
import { Carregando } from '@/components/ui/Carregando'
import { cn } from '@/lib/utils'
import { hojeISO } from '@/lib/datas'
import { lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import { equipeComercial, useCliente, useEquipe } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useSalvarServico, useServico, useTiposServico, type ServicoResumo } from './api'

const esquema = z.object({
  cliente_id: z.string().min(1, 'Escolha o cliente.'),
  cliente_nome: z.string(),
  endereco_id: z.string(),
  tipo_servico_id: z.string().min(1, 'Escolha o serviço.'),
  data_execucao: z.string().min(1, 'Informe a data.'),
  status: z.enum(['agendado', 'realizado', 'cancelado']),
  valor: z.string().refine((v) => v === '' || lerValor(v) !== null, 'Valor inválido.'),
  periodicidade_meses: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 60), 'Entre 1 e 60 meses.'),
  vendedor_id: z.string(),
  numero_certificado: z.string().trim(),
  tecnicos: z.string().trim(),
  observacoes: z.string().trim(),
  proposta_id: z.string(),
})
type Dados = z.infer<typeof esquema>

/** /servicos/novo e /servicos/:id/editar */
export function ServicoFormPage() {
  const { id } = useParams()
  const servico = useServico(id)
  if (!id) return <Formulario />
  if (servico.isPending) return <Carregando />
  if (!servico.data) return <Aviso tipo="erro">Serviço não encontrado.</Aviso>
  return <Formulario servico={servico.data} />
}

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())

function Formulario({ servico }: { servico?: ServicoResumo }) {
  const editando = !!servico
  const perfil = usePerfil()
  const navegar = useNavigate()
  const [p] = useSearchParams()
  const tipos = useTiposServico()
  const equipe = useEquipe()
  const salvar = useSalvarServico()
  const acessoTotal = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)

  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: servico
      ? {
          cliente_id: servico.cliente_id,
          cliente_nome: servico.cliente?.nome_fantasia || servico.cliente?.nome || '',
          endereco_id: servico.endereco_id ?? '',
          tipo_servico_id: servico.tipo_servico_id,
          data_execucao: servico.data_execucao,
          status: servico.status,
          valor: valorParaCampo(servico.valor),
          periodicidade_meses: servico.periodicidade_meses?.toString() ?? '',
          vendedor_id: servico.vendedor_id ?? '',
          numero_certificado: servico.numero_certificado ?? '',
          tecnicos: servico.tecnicos ?? '',
          observacoes: servico.observacoes ?? '',
          proposta_id: servico.proposta_id ?? '',
        }
      : {
          cliente_id: p.get('cliente') ?? '',
          cliente_nome: p.get('cliente_nome') ?? '',
          endereco_id: p.get('endereco') ?? '',
          tipo_servico_id: p.get('tipo') ?? '',
          data_execucao: hojeISO(),
          status: p.get('status') === 'agendado' ? 'agendado' : 'realizado',
          valor: p.get('valor') ? valorParaCampo(Number(p.get('valor'))) : '',
          periodicidade_meses: p.get('periodicidade') ?? '',
          vendedor_id: '',
          numero_certificado: '',
          tecnicos: '',
          observacoes: '',
          proposta_id: p.get('proposta') ?? '',
        },
  })
  const { errors, isSubmitting } = form.formState
  const [clienteId, clienteNome, tipoId, status] = useWatch({
    control: form.control,
    name: ['cliente_id', 'cliente_nome', 'tipo_servico_id', 'status'],
  })
  const cliente = useCliente(clienteId)
  const enderecos = cliente.data?.enderecos ?? []
  const tipo = tipos.data?.find((t) => t.id === tipoId)

  function aoEscolherCliente(c: ClienteEscolhido | null) {
    form.setValue('cliente_id', c?.id ?? '', { shouldValidate: !!c })
    form.setValue('cliente_nome', c?.nome ?? '')
    form.setValue('endereco_id', '')
  }

  async function enviar(d: Dados) {
    try {
      const id = await salvar.mutateAsync({
        id: servico?.id,
        dados: {
          cliente_id: d.cliente_id,
          // Cliente com um único endereço: o serviço (e o vencimento) fica nele.
          endereco_id: ouNulo(d.endereco_id) ?? (enderecos.length === 1 ? enderecos[0].id : null),
          tipo_servico_id: d.tipo_servico_id,
          data_execucao: d.data_execucao,
          status: d.status,
          valor: d.valor ? lerValor(d.valor) : null,
          periodicidade_meses: d.periodicidade_meses ? Number(d.periodicidade_meses) : null,
          // Vazio = o banco usa o vendedor responsável pelo cliente.
          ...(acessoTotal && d.vendedor_id ? { vendedor_id: d.vendedor_id } : {}),
          numero_certificado: ouNulo(d.numero_certificado),
          tecnicos: ouNulo(d.tecnicos),
          observacoes: ouNulo(d.observacoes),
          proposta_id: ouNulo(d.proposta_id),
        },
      })
      navegar(`/servicos/${id}`, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const valorCampo = form.register('valor')

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navegar(-1)}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar
      </button>
      <h1 className="text-2xl font-bold">
        {editando
          ? 'Editar serviço'
          : status === 'agendado'
            ? 'Agendar serviço'
            : 'Registrar serviço'}
      </h1>
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}

      <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-5">
        <Card className="grid gap-4 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="sr-only">Situação</legend>
            <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
              {(['realizado', 'agendado'] as const).map((s) => (
                <label
                  key={s}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-borda font-semibold',
                    'has-checked:border-verde has-checked:bg-lima-claro has-checked:text-verde-escuro',
                  )}
                >
                  <input type="radio" value={s} className="sr-only" {...form.register('status')} />
                  {s === 'realizado' ? 'Já foi feito' : 'Agendar'}
                </label>
              ))}
            </div>
          </fieldset>

          <Campo
            rotulo="Cliente"
            htmlFor="cliente"
            obrigatorio
            erro={errors.cliente_id?.message}
            className="sm:col-span-2"
          >
            {editando || p.get('cliente') ? (
              <p className="flex min-h-11 items-center font-semibold">{clienteNome}</p>
            ) : (
              <ClienteSeletor
                id="cliente"
                valor={clienteId ? { id: clienteId, nome: clienteNome } : null}
                aoMudar={aoEscolherCliente}
              />
            )}
          </Campo>

          <Campo
            rotulo="Endereço / unidade"
            htmlFor="endereco"
            dica={
              enderecos.length === 0 && clienteId
                ? 'O cliente não tem endereço cadastrado.'
                : 'O vencimento é controlado por endereço.'
            }
          >
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
                  {[e.apelido, `${e.logradouro}, ${e.numero ?? 's/n'}`].filter(Boolean).join(' · ')}
                </option>
              ))}
            </SelectForm>
          </Campo>

          <Campo rotulo="Serviço" htmlFor="tipo" obrigatorio erro={errors.tipo_servico_id?.message}>
            <SelectForm id="tipo" control={form.control} name="tipo_servico_id">
              <option value="">Escolha…</option>
              {tipos.data
                ?.filter((t) => t.ativo || t.id === servico?.tipo_servico_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
            </SelectForm>
          </Campo>

          <Campo
            rotulo={status === 'agendado' ? 'Data marcada' : 'Data em que foi feito'}
            htmlFor="data"
            obrigatorio
            erro={errors.data_execucao?.message}
          >
            <Input id="data" type="date" {...form.register('data_execucao')} />
          </Campo>

          <Campo rotulo="Valor (R$)" htmlFor="valor" erro={errors.valor?.message}>
            <Input
              id="valor"
              inputMode="numeric"
              placeholder="0,00"
              {...valorCampo}
              onChange={(e) => {
                e.target.value = mascaraValor(e.target.value)
                void valorCampo.onChange(e)
              }}
            />
          </Campo>

          {tipo?.periodicidade_meses_padrao && (
            <Campo
              rotulo="Repetir a cada (meses)"
              htmlFor="periodo"
              erro={errors.periodicidade_meses?.message}
              dica={`Vazio = padrão do serviço (${tipo.periodicidade_meses_padrao} meses).`}
            >
              <Input id="periodo" inputMode="numeric" {...form.register('periodicidade_meses')} />
            </Campo>
          )}

          {acessoTotal && (
            <Campo
              rotulo="Vendedor (comissão)"
              htmlFor="vendedor"
              dica="Vazio = o vendedor responsável pelo cliente."
            >
              <SelectForm id="vendedor" control={form.control} name="vendedor_id">
                <option value="">Responsável pelo cliente</option>
                {equipeComercial(equipe.data).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </SelectForm>
            </Campo>
          )}
        </Card>

        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Execução</h2>
          <Campo rotulo="Nº do certificado" htmlFor="certificado">
            <Input id="certificado" {...form.register('numero_certificado')} />
          </Campo>
          <Campo rotulo="Técnicos" htmlFor="tecnicos" dica="Quem fez o serviço.">
            <Input id="tecnicos" {...form.register('tecnicos')} />
          </Campo>
          <Campo rotulo="Observações" htmlFor="obs" className="sm:col-span-2">
            <Textarea id="obs" {...form.register('observacoes')} />
          </Campo>
          {!editando && (
            <p className="text-sm text-texto-suave sm:col-span-2">
              Depois de salvar, você anexa o certificado, o relatório e as fotos de antes e depois.
            </p>
          )}
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to={editando ? `/servicos/${servico.id}` : '/servicos'}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar serviço'}
          </Button>
        </div>
      </form>
    </div>
  )
}
