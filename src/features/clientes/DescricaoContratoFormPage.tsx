import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_GESTAO } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import { useCliente } from './api'
import {
  FREQUENCIAS,
  useApagarDescricaoContrato,
  useDescricaoContrato,
  useSalvarDescricaoContrato,
  type DescricaoContrato,
} from './descricaoContrato'

const numeroOpcional = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+([.,]\d+)?$/.test(v), 'Só números.')

const esquema = z
  .object({
    numero_contrato: z.string().trim(),
    data_assinatura: z.string(),
    vigencia_inicio: z.string(),
    vigencia_fim: z.string(),
    renovacao: z.string().trim(),
    reajuste: z.string().trim(),
    horario_atendimento: z.string().trim(),
    taxa_fora_horario: z.string().trim(),
    itens: z.array(
      z.object({
        servico: z.string().trim().min(2, 'Diga qual é o serviço.'),
        detalhe: z.string().trim(),
        quantidade: numeroOpcional,
        unidade: z.string().trim(),
        frequencia: z.string().trim(),
        vezes_ano: numeroOpcional,
        locais: z.string().trim(),
      }),
    ),
    servicos_extras: z.string().trim(),
    condicoes: z.string().trim(),
    pendencias: z.string().trim(),
    documentos: z.string(),
    conferido_em: z.string(),
  })
  .refine((d) => !d.vigencia_fim || !d.vigencia_inicio || d.vigencia_fim >= d.vigencia_inicio, {
    path: ['vigencia_fim'],
    message: 'O fim precisa ser depois do início.',
  })
type Dados = z.infer<typeof esquema>

const ITEM_VAZIO: Dados['itens'][number] = {
  servico: '',
  detalhe: '',
  quantidade: '',
  unidade: '',
  frequencia: '',
  vezes_ano: '',
  locais: '',
}

const ouNulo = (v: string) => (v.trim() === '' ? null : v.trim())
const numeroOuNulo = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
const campoNumero = (n: number | null | undefined) => (n == null ? '' : String(n))

/** /clientes/:id/descricao-contrato */
export function DescricaoContratoFormPage() {
  const { id = '' } = useParams()
  const perfil = usePerfil()
  const cliente = useCliente(id)
  const descricao = useDescricaoContrato(id)

  if (!PAPEIS_GESTAO.includes(perfil.papel)) {
    return <Aviso tipo="erro">Só Admin, Financeiro e ADM alteram a descrição do contrato.</Aviso>
  }
  if (cliente.isPending || descricao.isPending) return <Carregando />
  if (descricao.isError) return <Aviso tipo="erro">{mensagemDeErro(descricao.error)}</Aviso>
  if (!cliente.data) return <Aviso tipo="erro">Cliente não encontrado.</Aviso>
  return (
    <Formulario
      clienteId={id}
      clienteNome={cliente.data.nome_fantasia || cliente.data.nome}
      descricao={descricao.data}
    />
  )
}

function Formulario({
  clienteId,
  clienteNome,
  descricao: d,
}: {
  clienteId: string
  clienteNome: string
  descricao: DescricaoContrato | null
}) {
  const navegar = useNavigate()
  const salvar = useSalvarDescricaoContrato(clienteId)
  const apagar = useApagarDescricaoContrato(clienteId)
  const voltar = `/clientes/${clienteId}`

  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      numero_contrato: d?.numero_contrato ?? '',
      data_assinatura: d?.data_assinatura ?? '',
      vigencia_inicio: d?.vigencia_inicio ?? '',
      vigencia_fim: d?.vigencia_fim ?? '',
      renovacao: d?.renovacao ?? '',
      reajuste: d?.reajuste ?? '',
      horario_atendimento: d?.horario_atendimento ?? '',
      taxa_fora_horario: d?.taxa_fora_horario ?? '',
      itens: d?.itens.length
        ? d.itens.map((i) => ({
            servico: i.servico ?? '',
            detalhe: i.detalhe ?? '',
            quantidade: campoNumero(i.quantidade),
            unidade: i.unidade ?? '',
            frequencia: i.frequencia ?? '',
            vezes_ano: campoNumero(i.vezes_ano),
            locais: i.locais ?? '',
          }))
        : [ITEM_VAZIO],
      servicos_extras: d?.servicos_extras ?? '',
      condicoes: d?.condicoes ?? '',
      pendencias: d?.pendencias ?? '',
      documentos: d?.documentos.join('\n') ?? '',
      conferido_em: d?.conferido_em ?? '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const itens = useFieldArray({ control: form.control, name: 'itens' })

  /** Escolheu a frequência e ainda não disse quantas vezes: preenche sozinho. */
  function aoMudarFrequencia(indice: number, valor: string) {
    const conhecida = FREQUENCIAS.find((f) => f.nome.toLowerCase() === valor.trim().toLowerCase())
    if (conhecida && !form.getValues(`itens.${indice}.vezes_ano`)) {
      form.setValue(`itens.${indice}.vezes_ano`, campoNumero(conhecida.vezes))
    }
  }

  async function enviar(v: Dados) {
    try {
      await salvar.mutateAsync({
        numero_contrato: ouNulo(v.numero_contrato),
        data_assinatura: ouNulo(v.data_assinatura),
        vigencia_inicio: ouNulo(v.vigencia_inicio),
        vigencia_fim: ouNulo(v.vigencia_fim),
        renovacao: ouNulo(v.renovacao),
        reajuste: ouNulo(v.reajuste),
        horario_atendimento: ouNulo(v.horario_atendimento),
        taxa_fora_horario: ouNulo(v.taxa_fora_horario),
        itens: v.itens.map((i) => ({
          servico: i.servico,
          ...(i.detalhe && { detalhe: i.detalhe }),
          quantidade: numeroOuNulo(i.quantidade),
          ...(i.unidade && { unidade: i.unidade }),
          ...(i.frequencia && { frequencia: i.frequencia }),
          vezes_ano: numeroOuNulo(i.vezes_ano),
          ...(i.locais && { locais: i.locais }),
        })),
        servicos_extras: ouNulo(v.servicos_extras),
        condicoes: ouNulo(v.condicoes),
        pendencias: ouNulo(v.pendencias),
        documentos: v.documentos
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        conferido_em: ouNulo(v.conferido_em),
      })
      navegar(voltar, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function aoApagar() {
    if (!window.confirm('Apagar a descrição do contrato deste cliente?')) return
    try {
      await apagar.mutateAsync()
      navegar(voltar, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={voltar}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> {clienteNome}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Descrição do contrato</h1>
        <p className="text-texto-suave">
          O que o contrato assinado contempla. Quando houver termo aditivo, vale o mais recente.
        </p>
      </div>
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}

      <datalist id="frequencias">
        {FREQUENCIAS.map((f) => (
          <option key={f.nome} value={f.nome} />
        ))}
      </datalist>

      <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-5">
        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Contrato</h2>
          <Campo rotulo="Número do contrato" htmlFor="numero">
            <Input
              id="numero"
              {...form.register('numero_contrato')}
              placeholder="Ex.: 40291/2014"
            />
          </Campo>
          <Campo rotulo="Assinado em" htmlFor="assinatura">
            <Input id="assinatura" type="date" {...form.register('data_assinatura')} />
          </Campo>
          <Campo rotulo="Vigência: início" htmlFor="vig-inicio">
            <Input id="vig-inicio" type="date" {...form.register('vigencia_inicio')} />
          </Campo>
          <Campo
            rotulo="Vigência: fim"
            htmlFor="vig-fim"
            erro={errors.vigencia_fim?.message}
            dica="Vazio = prazo indeterminado."
          >
            <Input id="vig-fim" type="date" {...form.register('vigencia_fim')} />
          </Campo>
          <Campo rotulo="Renovação" htmlFor="renovacao">
            <Input
              id="renovacao"
              {...form.register('renovacao')}
              placeholder="Ex.: automática por 12 meses"
            />
          </Campo>
          <Campo rotulo="Reajuste" htmlFor="reajuste">
            <Input
              id="reajuste"
              {...form.register('reajuste')}
              placeholder="Ex.: IGP-M, todo junho"
            />
          </Campo>
        </Card>

        <Card className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-bold">Horário e atendimento fora do horário</h2>
            <p className="text-sm text-texto-suave">
              A recepção consulta isto antes de agendar um chamado.
            </p>
          </div>
          <Campo rotulo="Horário coberto pelo contrato" htmlFor="horario">
            <Input
              id="horario"
              {...form.register('horario_atendimento')}
              placeholder="Ex.: seg. a sex., 8h às 18h"
            />
          </Campo>
          <Campo rotulo="Taxa fora do horário" htmlFor="taxa">
            <Input
              id="taxa"
              {...form.register('taxa_fora_horario')}
              placeholder="Ex.: acréscimo de 50% à noite, sábados e domingos"
            />
          </Campo>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-bold">Serviços no ano</h2>
            <p className="text-sm text-texto-suave">
              Um por linha: o que é feito, quanto (porta-iscas, reservatórios, bebedouros…) e com
              que frequência.
            </p>
          </div>
          {itens.fields.map((campo, i) => {
            const erro = errors.itens?.[i]
            return (
              <fieldset
                key={campo.id}
                className="grid gap-3 rounded-xl border border-borda p-4 sm:grid-cols-6"
              >
                <legend className="px-1 text-sm font-semibold text-texto-suave">
                  Serviço {i + 1}
                </legend>
                <Campo
                  rotulo="Serviço"
                  obrigatorio
                  htmlFor={`servico-${i}`}
                  erro={erro?.servico?.message}
                  className="sm:col-span-3"
                >
                  <Input
                    id={`servico-${i}`}
                    {...form.register(`itens.${i}.servico`)}
                    placeholder="Ex.: Controle de roedores"
                  />
                </Campo>
                <Campo rotulo="Frequência" htmlFor={`freq-${i}`} className="sm:col-span-2">
                  <Input
                    id={`freq-${i}`}
                    list="frequencias"
                    {...form.register(`itens.${i}.frequencia`, {
                      onChange: (e: { target: { value: string } }) =>
                        aoMudarFrequencia(i, e.target.value),
                    })}
                    placeholder="Ex.: Quinzenal"
                  />
                </Campo>
                <Campo rotulo="Vezes/ano" htmlFor={`vezes-${i}`} erro={erro?.vezes_ano?.message}>
                  <Input
                    id={`vezes-${i}`}
                    inputMode="numeric"
                    {...form.register(`itens.${i}.vezes_ano`)}
                  />
                </Campo>
                <Campo
                  rotulo="Quantidade"
                  htmlFor={`qtd-${i}`}
                  erro={erro?.quantidade?.message}
                  className="sm:col-span-2"
                >
                  <Input
                    id={`qtd-${i}`}
                    inputMode="decimal"
                    {...form.register(`itens.${i}.quantidade`)}
                    placeholder="Ex.: 150"
                  />
                </Campo>
                <Campo rotulo="Unidade" htmlFor={`un-${i}`} className="sm:col-span-4">
                  <Input
                    id={`un-${i}`}
                    {...form.register(`itens.${i}.unidade`)}
                    placeholder="Ex.: porta-iscas / reservatórios de 10 mil litros / bebedouros"
                  />
                </Campo>
                <Campo rotulo="Detalhe" htmlFor={`det-${i}`} className="sm:col-span-6">
                  <Input
                    id={`det-${i}`}
                    {...form.register(`itens.${i}.detalhe`)}
                    placeholder="Ex.: monitoramento das iscas e troca do que for consumido"
                  />
                </Campo>
                <Campo rotulo="Locais" htmlFor={`loc-${i}`} className="sm:col-span-5">
                  <Input
                    id={`loc-${i}`}
                    {...form.register(`itens.${i}.locais`)}
                    placeholder="Ex.: refeitório, depósitos e pátio externo"
                  />
                </Campo>
                <div className="flex items-end sm:col-span-1">
                  <Button
                    variante="fantasma"
                    className="w-full"
                    onClick={() => itens.remove(i)}
                    aria-label={`Tirar o serviço ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden /> Tirar
                  </Button>
                </div>
              </fieldset>
            )
          })}
          <Button
            variante="secundario"
            className="self-start"
            onClick={() => itens.append(ITEM_VAZIO)}
          >
            <Plus className="size-4" aria-hidden /> Adicionar serviço
          </Button>
        </Card>

        <Card className="flex flex-col gap-4">
          <Campo
            rotulo="Serviços cobrados à parte"
            htmlFor="extras"
            dica="O que o contrato diz que é feito mediante orçamento."
          >
            <Textarea
              id="extras"
              {...form.register('servicos_extras')}
              placeholder="Ex.: insetos ocasionais (vespas, abelhas, morcegos) mediante orçamento prévio"
            />
          </Campo>
          <Campo rotulo="Condições importantes" htmlFor="condicoes">
            <Textarea
              id="condicoes"
              {...form.register('condicoes')}
              placeholder="Ex.: iscas em comodato; aviso prévio de 30 dias para rescisão"
            />
          </Campo>
          <Campo
            rotulo="Pendências"
            htmlFor="pendencias"
            dica="Aparece em vermelho na ficha. Ex.: aditivo sem assinatura."
          >
            <Textarea id="pendencias" {...form.register('pendencias')} />
          </Campo>
        </Card>

        <Card className="grid gap-4 sm:grid-cols-3">
          <Campo
            rotulo="Documentos lidos"
            htmlFor="documentos"
            dica="Um por linha (minuta, aditivos…)."
            className="sm:col-span-2"
          >
            <Textarea id="documentos" {...form.register('documentos')} />
          </Campo>
          <Campo rotulo="Conferido em" htmlFor="conferido">
            <Input id="conferido" type="date" {...form.register('conferido_em')} />
          </Campo>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {d ? (
            <Button variante="fantasma" onClick={() => void aoApagar()} disabled={apagar.isPending}>
              <Trash2 className="size-4" aria-hidden /> Apagar descrição
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link
              to={voltar}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
            >
              Cancelar
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar descrição'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
