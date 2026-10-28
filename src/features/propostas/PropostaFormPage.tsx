import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { BotaoIcone } from '@/components/ui/BotaoIcone'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { hojeISO, somarDias } from '@/lib/datas'
import { formatarReais, mascaraValor, valorParaCampo } from '@/lib/dinheiro'
import { mensagemDeErro } from '@/lib/erros'

import { usePerfil } from '../auth/useAuth'
import { equipeComercial, useCliente, useEquipe } from '../clientes/api'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import { useProposta, useSalvarProposta, useTiposServico, type PropostaCompleta } from './api'
import {
  esquemaProposta,
  ITEM_VAZIO,
  propostaParaBanco,
  totalDosItens,
  type FormProposta,
} from './esquema'

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

function Formulario({ proposta }: { proposta?: PropostaCompleta }) {
  const editando = !!proposta
  const perfil = usePerfil()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const tipos = useTiposServico()
  const equipe = useEquipe()
  const salvar = useSalvarProposta()
  const ehVendedor = perfil.papel === 'vendedor'

  const hoje = hojeISO()
  const form = useForm<FormProposta>({
    resolver: zodResolver(esquemaProposta),
    defaultValues: proposta
      ? {
          cliente_id: proposta.cliente_id!,
          cliente_nome: proposta.cliente?.nome_fantasia || proposta.cliente?.nome || '',
          endereco_id: proposta.endereco_id ?? '',
          vendedor_id: proposta.vendedor_id!,
          data_envio: proposta.data_envio!,
          validade: proposta.validade ?? '',
          prazo_pagamento_dias: proposta.prazo_pagamento_dias?.toString() ?? '',
          condicao_pagamento: proposta.condicao_pagamento ?? '',
          observacoes: proposta.observacoes ?? '',
          itens: proposta.itens.map((i) => ({
            tipo_servico_id: i.tipo_servico_id ?? '',
            descricao: i.descricao,
            quantidade: String(i.quantidade).replace('.', ','),
            valor_unitario: valorParaCampo(i.valor_unitario),
            periodicidade_meses: i.periodicidade_meses?.toString() ?? '',
          })),
        }
      : {
          cliente_id: parametros.get('cliente') ?? '',
          cliente_nome: parametros.get('cliente_nome') ?? '',
          endereco_id: '',
          vendedor_id: ehVendedor ? perfil.id : (parametros.get('vendedor') ?? ''),
          data_envio: hoje,
          validade: somarDias(hoje, VALIDADE_PADRAO_DIAS),
          prazo_pagamento_dias: '15',
          condicao_pagamento: '',
          observacoes: '',
          itens: [ITEM_VAZIO],
        },
  })
  const { errors, isSubmitting } = form.formState
  const itens = useFieldArray({ control: form.control, name: 'itens' })
  const [clienteId, clienteNome, valoresItens] = useWatch({
    control: form.control,
    name: ['cliente_id', 'cliente_nome', 'itens'],
  })

  // Endereços do cliente escolhido (para propostas de clientes com várias unidades).
  const cliente = useCliente(clienteId)
  const enderecos = cliente.data?.enderecos ?? []
  const comerciais = equipeComercial(equipe.data)
  const total = totalDosItens(valoresItens ?? [])

  function aoEscolherCliente(c: ClienteEscolhido | null) {
    form.setValue('cliente_id', c?.id ?? '', { shouldValidate: !!c })
    form.setValue('cliente_nome', c?.nome ?? '')
    form.setValue('endereco_id', '')
    // Sugere o vendedor responsável pelo cliente (quem não é vendedor escolhe).
    if (!ehVendedor && c?.vendedorId && comerciais.some((p) => p.id === c.vendedorId)) {
      form.setValue('vendedor_id', c.vendedorId, { shouldValidate: true })
    }
  }

  async function enviar(dados: FormProposta) {
    try {
      const { dados: proposta_dados, itens: itensBanco } = propostaParaBanco(dados)
      const idSalvo = await salvar.mutateAsync({
        id: proposta?.id ?? undefined,
        dados: proposta_dados,
        itens: itensBanco,
      })
      navegar(`/propostas/${idSalvo}`, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to={editando ? `/propostas/${proposta.id}` : '/propostas'}
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-verde"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar
      </Link>
      <h1 className="text-2xl font-bold">
        {editando ? `Editar proposta ${proposta.numero}` : 'Nova proposta'}
      </h1>

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
              dica="Para clientes com mais de um endereço."
            >
              <Select id="endereco" {...form.register('endereco_id')}>
                <option value="">Não especificar</option>
                {enderecos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.apelido, `${e.logradouro}, ${e.numero ?? 's/n'}`, e.cidade]
                      .filter(Boolean)
                      .join(' · ')}
                  </option>
                ))}
              </Select>
            </Campo>
          )}

          <Campo
            rotulo="Vendedor"
            htmlFor="vendedor"
            obrigatorio
            erro={errors.vendedor_id?.message}
          >
            {ehVendedor ? (
              <p className="flex min-h-11 items-center">{perfil.nome}</p>
            ) : (
              <Select id="vendedor" {...form.register('vendedor_id')}>
                <option value="">Escolha…</option>
                {comerciais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            )}
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Enviada em" htmlFor="data_envio" erro={errors.data_envio?.message}>
              <Input id="data_envio" type="date" {...form.register('data_envio')} />
            </Campo>
            <Campo rotulo="Válida até" htmlFor="validade" erro={errors.validade?.message}>
              <Input id="validade" type="date" {...form.register('validade')} />
            </Campo>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="font-bold">Serviços</h2>
          {errors.itens?.root?.message && <Aviso tipo="erro">{errors.itens.root.message}</Aviso>}

          {itens.fields.map((campo, i) => {
            const erroItem = errors.itens?.[i]
            const valorCampo = form.register(`itens.${i}.valor_unitario`)
            const tipoCampo = form.register(`itens.${i}.tipo_servico_id`)
            const tipoEscolhido = tipos.data?.find(
              (t) => t.id === valoresItens?.[i]?.tipo_servico_id,
            )
            return (
              <fieldset
                key={campo.id}
                className="grid gap-3 rounded-xl border border-borda p-3 sm:grid-cols-12"
              >
                <legend className="sr-only">Serviço {i + 1}</legend>
                <Campo rotulo="Tipo de serviço" htmlFor={`tipo-${i}`} className="sm:col-span-4">
                  <Select
                    id={`tipo-${i}`}
                    {...tipoCampo}
                    onChange={(e) => {
                      void tipoCampo.onChange(e)
                      // Preenche a descrição com o nome do serviço, se ainda estiver vazia.
                      const tipo = tipos.data?.find((t) => t.id === e.target.value)
                      if (tipo && !form.getValues(`itens.${i}.descricao`)) {
                        form.setValue(`itens.${i}.descricao`, tipo.nome, { shouldValidate: true })
                      }
                    }}
                  >
                    <option value="">Outro</option>
                    {tipos.data
                      ?.filter((t) => t.ativo || t.id === campo.tipo_servico_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                  </Select>
                </Campo>
                <Campo
                  rotulo="Descrição"
                  htmlFor={`descricao-${i}`}
                  erro={erroItem?.descricao?.message}
                  className="sm:col-span-8"
                >
                  <Input id={`descricao-${i}`} {...form.register(`itens.${i}.descricao`)} />
                </Campo>
                <Campo
                  rotulo="Qtd."
                  htmlFor={`qtd-${i}`}
                  erro={erroItem?.quantidade?.message}
                  className="sm:col-span-2"
                >
                  <Input
                    id={`qtd-${i}`}
                    inputMode="decimal"
                    {...form.register(`itens.${i}.quantidade`)}
                  />
                </Campo>
                <Campo
                  rotulo="Valor unitário (R$)"
                  htmlFor={`valor-${i}`}
                  erro={erroItem?.valor_unitario?.message}
                  className="sm:col-span-4"
                >
                  <Input
                    id={`valor-${i}`}
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
                  rotulo="Repetir a cada (meses)"
                  htmlFor={`periodo-${i}`}
                  erro={erroItem?.periodicidade_meses?.message}
                  className="sm:col-span-4"
                  dica={
                    tipoEscolhido?.periodicidade_meses_padrao
                      ? `Padrão: ${tipoEscolhido.periodicidade_meses_padrao} meses`
                      : 'Só se for diferente do padrão'
                  }
                >
                  <Input
                    id={`periodo-${i}`}
                    inputMode="numeric"
                    {...form.register(`itens.${i}.periodicidade_meses`)}
                  />
                </Campo>
                <div className="flex items-end justify-end sm:col-span-2">
                  {itens.fields.length > 1 && (
                    <BotaoIcone rotulo={`Remover serviço ${i + 1}`} onClick={() => itens.remove(i)}>
                      <Trash2 className="size-4" />
                    </BotaoIcone>
                  )}
                </div>
              </fieldset>
            )
          })}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variante="secundario" onClick={() => itens.append(ITEM_VAZIO)}>
              <Plus className="size-4" aria-hidden /> Adicionar serviço
            </Button>
            <p className="text-lg">
              Total: <strong>{formatarReais(total)}</strong>
            </p>
          </div>
        </Card>

        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Pagamento</h2>
          <Campo
            rotulo="Prazo para pagar (dias após o serviço)"
            htmlFor="prazo"
            erro={errors.prazo_pagamento_dias?.message}
            dica="Usado para gerar a conta a receber quando o serviço for concluído."
          >
            <Input id="prazo" inputMode="numeric" {...form.register('prazo_pagamento_dias')} />
          </Campo>
          <Campo rotulo="Condição de pagamento" htmlFor="condicao">
            <Input
              id="condicao"
              placeholder="Ex.: 50% na aprovação, 50% na conclusão"
              {...form.register('condicao_pagamento')}
            />
          </Campo>
          <Campo rotulo="Observações" htmlFor="obs" className="sm:col-span-2">
            <Textarea id="obs" {...form.register('observacoes')} />
          </Campo>
          {!editando && (
            <p className="text-sm text-texto-suave sm:col-span-2">
              Depois de salvar, você anexa o PDF da proposta na próxima tela.
            </p>
          )}
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to={editando ? `/propostas/${proposta.id}` : '/propostas'}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar proposta'}
          </Button>
        </div>
      </form>
    </div>
  )
}
