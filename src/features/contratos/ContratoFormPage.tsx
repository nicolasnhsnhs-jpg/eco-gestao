import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { SelectForm } from '@/components/ui/SelectForm'
import { hojeISO } from '@/lib/datas'
import { lerValor, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_ACESSO_TOTAL } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import { equipeComercial, useCliente, useEquipe } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useCategorias, useContas } from '../financeiro/api'
import { FORMAS, type FormaPagamento } from '../financeiro/rotulos'
import { useContrato, useSalvarContrato, type ContratoResumo } from './api'

const esquema = z
  .object({
    cliente_id: z.string().min(1, 'Escolha o cliente.'),
    cliente_nome: z.string(),
    endereco_id: z.string(),
    descricao: z.string().trim().min(2, 'Descreva o contrato.'),
    valor_mensal: z.string().refine((v) => (lerValor(v) ?? 0) > 0, 'Informe o valor mensal.'),
    data_inicio: z.string().min(1, 'Informe o início.'),
    data_fim: z.string(),
    dia_util_cobranca: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 20), 'Entre 1 e 20.'),
    vendedor_id: z.string(),
    categoria_id: z.string(),
    conta_bancaria_id: z.string(),
    forma_pagamento: z.string(),
    observacoes: z.string().trim(),
    proposta_id: z.string(),
  })
  .refine((d) => !d.data_fim || d.data_fim >= d.data_inicio, {
    path: ['data_fim'],
    message: 'O fim precisa ser depois do início.',
  })
type Dados = z.infer<typeof esquema>

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())

/** /contratos/novo e /contratos/:id/editar */
export function ContratoFormPage() {
  const { id } = useParams()
  const contrato = useContrato(id)
  if (!id) return <Formulario />
  if (contrato.isPending) return <Carregando />
  if (!contrato.data) return <Aviso tipo="erro">Contrato não encontrado.</Aviso>
  return <Formulario contrato={contrato.data} />
}

function Formulario({ contrato }: { contrato?: ContratoResumo }) {
  const editando = !!contrato
  const perfil = usePerfil()
  const acessoTotal = PAPEIS_ACESSO_TOTAL.includes(perfil.papel)
  const navegar = useNavigate()
  const [p] = useSearchParams()
  const equipe = useEquipe()
  // Categorias e contas: só Admin/Financeiro enxergam (para o vendedor, o banco usa o padrão).
  const categorias = useCategorias()
  const contas = useContas()
  const salvar = useSalvarContrato()

  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: contrato
      ? {
          cliente_id: contrato.cliente_id,
          cliente_nome: contrato.cliente?.nome_fantasia || contrato.cliente?.nome || '',
          endereco_id: contrato.endereco_id ?? '',
          descricao: contrato.descricao,
          valor_mensal: valorParaCampo(contrato.valor_mensal),
          data_inicio: contrato.data_inicio,
          data_fim: contrato.data_fim ?? '',
          dia_util_cobranca: contrato.dia_util_cobranca?.toString() ?? '',
          vendedor_id: contrato.vendedor_id ?? '',
          categoria_id: contrato.categoria_id,
          conta_bancaria_id: contrato.conta_bancaria_id ?? '',
          forma_pagamento: contrato.forma_pagamento ?? '',
          observacoes: contrato.observacoes ?? '',
          proposta_id: contrato.proposta_id ?? '',
        }
      : {
          cliente_id: p.get('cliente') ?? '',
          cliente_nome: p.get('cliente_nome') ?? '',
          endereco_id: p.get('endereco') ?? '',
          descricao: p.get('descricao') ?? '',
          valor_mensal: p.get('valor') ? valorParaCampo(Number(p.get('valor'))) : '',
          data_inicio: `${hojeISO().slice(0, 7)}-01`,
          data_fim: '',
          dia_util_cobranca: '',
          vendedor_id: '',
          categoria_id: '',
          conta_bancaria_id: '',
          forma_pagamento: 'boleto',
          observacoes: '',
          proposta_id: p.get('proposta') ?? '',
        },
  })
  const { errors, isSubmitting } = form.formState
  const [clienteId, clienteNome] = useWatch({
    control: form.control,
    name: ['cliente_id', 'cliente_nome'],
  })
  const cliente = useCliente(clienteId)
  const enderecos = cliente.data?.enderecos ?? []
  const receitas = (categorias.data ?? []).filter((c) => c.tipo === 'receita' && c.ativo)

  function aoEscolherCliente(c: ClienteEscolhido | null) {
    form.setValue('cliente_id', c?.id ?? '', { shouldValidate: !!c })
    form.setValue('cliente_nome', c?.nome ?? '')
    form.setValue('endereco_id', '')
  }

  async function enviar(d: Dados) {
    try {
      const id = await salvar.mutateAsync({
        id: contrato?.id,
        dados: {
          cliente_id: d.cliente_id,
          endereco_id: ouNulo(d.endereco_id),
          descricao: d.descricao.trim(),
          valor_mensal: lerValor(d.valor_mensal)!,
          data_inicio: d.data_inicio,
          data_fim: ouNulo(d.data_fim),
          dia_util_cobranca: d.dia_util_cobranca ? Number(d.dia_util_cobranca) : null,
          proposta_id: ouNulo(d.proposta_id),
          observacoes: ouNulo(d.observacoes),
          // Vazio = o banco usa o vendedor responsável e a categoria "Contrato recorrente".
          ...(acessoTotal
            ? {
                vendedor_id: ouNulo(d.vendedor_id) ?? undefined,
                categoria_id: ouNulo(d.categoria_id) ?? undefined,
                conta_bancaria_id: ouNulo(d.conta_bancaria_id),
                forma_pagamento: (ouNulo(d.forma_pagamento) as FormaPagamento | null) ?? null,
              }
            : {}),
        },
      })
      navegar(`/contratos/${id}`, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const valorCampo = form.register('valor_mensal')

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navegar(-1)}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar
      </button>
      <h1 className="text-2xl font-bold">{editando ? 'Editar contrato' : 'Novo contrato'}</h1>
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}

      <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-5">
        <Card className="grid gap-4 sm:grid-cols-2">
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
            rotulo="Descrição"
            htmlFor="descricao"
            obrigatorio
            erro={errors.descricao?.message}
            className="sm:col-span-2"
          >
            <Input
              id="descricao"
              placeholder="Ex.: Controle de pragas mensal"
              {...form.register('descricao')}
            />
          </Campo>
          {enderecos.length > 1 && (
            <Campo rotulo="Endereço / unidade" htmlFor="endereco" className="sm:col-span-2">
              <SelectForm id="endereco" control={form.control} name="endereco_id">
                <option value="">Não especificar</option>
                {enderecos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.apelido, `${e.logradouro}, ${e.numero ?? 's/n'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </option>
                ))}
              </SelectForm>
            </Campo>
          )}
          <Campo
            rotulo="Valor mensal (R$)"
            htmlFor="valor"
            obrigatorio
            erro={errors.valor_mensal?.message}
          >
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
          <Campo
            rotulo="Vence no dia útil nº"
            htmlFor="dia_util"
            erro={errors.dia_util_cobranca?.message}
            dica="Vazio = o padrão da empresa (em Financeiro → Cadastros)."
          >
            <Input id="dia_util" inputMode="numeric" {...form.register('dia_util_cobranca')} />
          </Campo>
          <Campo rotulo="Início" htmlFor="inicio" obrigatorio erro={errors.data_inicio?.message}>
            <Input id="inicio" type="date" {...form.register('data_inicio')} />
          </Campo>
          <Campo
            rotulo="Fim"
            htmlFor="fim"
            erro={errors.data_fim?.message}
            dica="Vazio = sem data para terminar."
          >
            <Input id="fim" type="date" {...form.register('data_fim')} />
          </Campo>
        </Card>

        {acessoTotal && (
          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-bold sm:col-span-2">Cobrança e comissão</h2>
            <Campo
              rotulo="Vendedor (comissão)"
              htmlFor="vendedor"
              dica="Vazio = o responsável pelo cliente."
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
            <Campo rotulo="Categoria" htmlFor="categoria" dica="Vazio = Contrato recorrente.">
              <SelectForm id="categoria" control={form.control} name="categoria_id">
                <option value="">Contrato recorrente</option>
                {receitas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </SelectForm>
            </Campo>
            <Campo rotulo="Conta que recebe" htmlFor="conta">
              <SelectForm id="conta" control={form.control} name="conta_bancaria_id">
                <option value="">Definir ao receber</option>
                {(contas.data ?? [])
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <option key={c.id} value={c.id!}>
                      {c.nome}
                    </option>
                  ))}
              </SelectForm>
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
          </Card>
        )}

        <Card>
          <Campo rotulo="Observações" htmlFor="obs">
            <Textarea id="obs" {...form.register('observacoes')} />
          </Campo>
          <p className="mt-3 text-sm text-texto-suave">
            Depois de salvo, o sistema cria sozinho a conta a receber de cada mês (a do mês atual e
            a do próximo), e cada mensalidade gera a comissão do vendedor.
          </p>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to={editando ? `/contratos/${contrato.id}` : '/contratos'}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar contrato'}
          </Button>
        </div>
      </form>
    </div>
  )
}
