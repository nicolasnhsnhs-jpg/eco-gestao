import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Plus, Search, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import {
  cnpjValido,
  formatarCnpj,
  formatarCpf,
  formatarDocumento,
  formatarTelefone,
  limparDocumento,
} from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'
import { PAPEIS_GESTAO } from '@/lib/papeis'

import { usePerfil } from '../auth/useAuth'
import { useVincularCliente } from '../crm/api'
import {
  equipeComercial,
  useAtualizarCliente,
  useCliente,
  useCriarCliente,
  useEquipe,
  type ClienteCompleto,
} from './api'
import {
  consultarCnpj,
  ErroConsultaCnpj,
  planejarPreenchimento,
  type Conflito,
  type DadosCnpj,
} from './consultaCnpj'
import { EnderecoCampos } from './EnderecoCampos'
import {
  CLIENTE_VAZIO,
  clienteParaBanco,
  ENDERECO_VAZIO,
  enderecoParaBanco,
  esquemaCliente,
  esquemaEndereco,
  ORIGENS,
  type FormCliente,
  type FormEndereco,
} from './esquemas'

/** Cadastro de cliente novo (/clientes/novo) ou edição (/clientes/:id/editar). */
export function ClienteFormPage() {
  const { id } = useParams()
  const cliente = useCliente(id ?? '')
  const perfil = usePerfil()

  if (!id) return <FormularioCliente />
  if (cliente.isPending) return <Carregando />
  if (!cliente.data) return <Aviso tipo="erro">Cliente não encontrado.</Aviso>
  // O vendedor consulta qualquer cliente, mas só altera os da carteira dele.
  if (perfil.papel === 'vendedor' && cliente.data.vendedor_responsavel_id !== perfil.id) {
    return <Aviso tipo="erro">Só o vendedor responsável pode alterar este cliente.</Aviso>
  }
  return <FormularioCliente cliente={cliente.data} />
}

function valoresIniciais(cliente: ClienteCompleto): FormCliente {
  return {
    tipo_pessoa: cliente.tipo_pessoa,
    nome: cliente.nome,
    nome_fantasia: cliente.nome_fantasia ?? '',
    cpf_cnpj: formatarDocumento(cliente.cpf_cnpj, cliente.tipo_pessoa),
    inscricao_estadual: cliente.inscricao_estadual ?? '',
    email: cliente.email ?? '',
    emails_extras: cliente.emails_extras.map((valor) => ({ valor })),
    separar_financeiro: cliente.emails_financeiro.length > 0,
    emails_financeiro: cliente.emails_financeiro.map((valor) => ({ valor })),
    telefone: formatarTelefone(cliente.telefone),
    telefones_extras: cliente.telefones_extras.map((t) => ({ valor: formatarTelefone(t) })),
    whatsapp: formatarTelefone(cliente.whatsapp),
    vendedor_responsavel_id: cliente.vendedor_responsavel_id ?? '',
    origem: cliente.origem ?? '',
    observacoes: cliente.observacoes ?? '',
  }
}

function FormularioCliente({ cliente }: { cliente?: ClienteCompleto }) {
  const editando = !!cliente
  const navegar = useNavigate()
  const perfil = usePerfil()
  const equipe = useEquipe()
  const criar = useCriarCliente()
  const atualizar = useAtualizarCliente(cliente?.id ?? '')
  // Aberto pelo CRM do WhatsApp: já vem com o número e o nome, e volta para a conversa.
  const [parametros] = useSearchParams()
  const conversaCrm = editando ? null : parametros.get('conversa')
  const vincularConversa = useVincularCliente()
  const [comEndereco, setComEndereco] = useState(true)
  const [consulta, setConsulta] = useState<EstadoConsulta>({ etapa: 'parada' })
  // Para não consultar duas vezes o mesmo CNPJ nem aplicar uma resposta atrasada.
  const ultimaConsulta = useRef('')

  const form = useForm<FormCliente>({
    resolver: zodResolver(esquemaCliente),
    defaultValues: cliente
      ? valoresIniciais(cliente)
      : {
          ...CLIENTE_VAZIO,
          nome: parametros.get('nome') ?? '',
          whatsapp: formatarTelefone(parametros.get('whatsapp') ?? ''),
          // O vendedor que cadastra já fica como responsável.
          vendedor_responsavel_id: perfil.papel === 'vendedor' ? perfil.id : '',
        },
  })
  const formEndereco = useForm<FormEndereco>({
    resolver: zodResolver(esquemaEndereco),
    defaultValues: ENDERECO_VAZIO,
  })
  const { errors, isSubmitting } = form.formState
  const tipo = useWatch({ control: form.control, name: 'tipo_pessoa' })

  // Quem pode escolher o vendedor: no cadastro, todos menos o vendedor (que fica com o cliente);
  // na edição, só quando o cliente ainda não tem vendedor (trocar é pela "Transferência").
  const podeEscolherVendedor = editando
    ? !cliente.vendedor_responsavel_id &&
      (PAPEIS_GESTAO.includes(perfil.papel) || perfil.papel === 'recepcao')
    : perfil.papel !== 'vendedor'

  async function salvar(dados: FormCliente) {
    try {
      if (editando) {
        const { vendedor_responsavel_id, ...resto } = clienteParaBanco(dados)
        await atualizar.mutateAsync(
          podeEscolherVendedor ? { ...resto, vendedor_responsavel_id } : resto,
        )
        navegar(`/clientes/${cliente.id}`)
        return
      }

      if (comEndereco && !(await formEndereco.trigger())) return
      const novoId = await criar.mutateAsync({
        cliente: clienteParaBanco(dados),
        endereco: comEndereco ? enderecoParaBanco(formEndereco.getValues()) : null,
      })
      if (conversaCrm) {
        await vincularConversa.mutateAsync({ conversa: conversaCrm, cliente: novoId })
        navegar(`/crm/${conversaCrm}`, { replace: true })
        return
      }
      navegar(`/clientes/${novoId}`, { replace: true })
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function consultar(valor: string) {
    const cnpj = limparDocumento(valor)
    if (!cnpjValido(cnpj)) {
      form.setError('cpf_cnpj', { message: 'Digite um CNPJ válido para consultar.' })
      return
    }
    form.clearErrors('cpf_cnpj')
    ultimaConsulta.current = cnpj
    setConsulta({ etapa: 'consultando' })
    try {
      const dados = await consultarCnpj(cnpj)
      if (ultimaConsulta.current !== cnpj) return
      const plano = planejarPreenchimento(
        dados,
        form.getValues(),
        editando ? undefined : formEndereco.getValues(),
        ENDERECO_VAZIO,
      )
      const opcoes = { shouldValidate: true, shouldDirty: true }
      for (const [campo, valor] of Object.entries(plano.cliente))
        form.setValue(campo as keyof FormCliente, valor, opcoes)
      if (!editando && Object.keys(plano.endereco).length > 0) {
        setComEndereco(true)
        for (const [campo, valor] of Object.entries(plano.endereco))
          formEndereco.setValue(campo as keyof FormEndereco, valor, opcoes)
      }
      setConsulta({ etapa: 'pronta', dados, conflitos: plano.conflitos })
    } catch (erro) {
      if (ultimaConsulta.current !== cnpj) return
      setConsulta({
        etapa: 'erro',
        mensagem: erro instanceof ErroConsultaCnpj ? erro.message : mensagemDeErro(erro),
      })
    }
  }

  /** A pessoa escolheu trocar o que tinha digitado pelos dados da Receita. */
  function usarDadosDaReceita(dados: DadosCnpj, conflitos: Conflito[]) {
    const opcoes = { shouldValidate: true, shouldDirty: true }
    for (const c of conflitos) {
      if (c.form === 'cliente') form.setValue(c.campo, c.novo, opcoes)
      else formEndereco.setValue(c.campo, c.novo, opcoes)
      if (c.campo === 'cidade') {
        formEndereco.setValue('uf', dados.endereco.uf, opcoes)
        formEndereco.setValue('codigo_ibge', dados.endereco.codigo_ibge)
      }
    }
    setConsulta({ etapa: 'pronta', dados, conflitos: [] })
  }

  const documento = form.register('cpf_cnpj')
  const whatsapp = form.register('whatsapp')

  return (
    <>
      <PageHeader titulo={editando ? 'Editar cliente' : 'Novo cliente'} />
      <form onSubmit={form.handleSubmit(salvar)} noValidate className="flex flex-col gap-5">
        {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}

        <Card className="grid gap-4 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">Tipo de cliente</legend>
            <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
              {(['PJ', 'PF'] as const).map((t) => (
                <label
                  key={t}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-borda font-semibold has-checked:border-verde has-checked:bg-lima-claro has-checked:text-verde-escuro"
                >
                  <input
                    type="radio"
                    value={t}
                    className="sr-only"
                    {...form.register('tipo_pessoa', {
                      onChange: () => form.setValue('cpf_cnpj', ''),
                    })}
                  />
                  {t === 'PJ' ? 'Empresa (CNPJ)' : 'Pessoa física (CPF)'}
                </label>
              ))}
            </div>
          </fieldset>

          <Campo
            rotulo={tipo === 'PJ' ? 'Razão social' : 'Nome completo'}
            htmlFor="nome"
            obrigatorio
            erro={errors.nome?.message}
            className="sm:col-span-2"
          >
            <Input id="nome" aria-invalid={!!errors.nome} {...form.register('nome')} />
          </Campo>

          {tipo === 'PJ' && (
            <Campo rotulo="Nome fantasia" htmlFor="nome_fantasia" className="sm:col-span-2">
              <Input id="nome_fantasia" {...form.register('nome_fantasia')} />
            </Campo>
          )}

          <Campo
            rotulo={tipo === 'PJ' ? 'CNPJ' : 'CPF'}
            htmlFor="cpf_cnpj"
            erro={errors.cpf_cnpj?.message}
          >
            <Input
              id="cpf_cnpj"
              inputMode={tipo === 'PF' ? 'numeric' : 'text'}
              aria-invalid={!!errors.cpf_cnpj}
              {...documento}
              onChange={(e) => {
                e.target.value =
                  tipo === 'PF' ? formatarCpf(e.target.value) : formatarCnpj(e.target.value)
                void documento.onChange(e)
                if (tipo !== 'PJ') return
                // CNPJ completo e válido: consulta sozinho (uma vez por CNPJ).
                const cnpj = limparDocumento(e.target.value)
                if (cnpj === ultimaConsulta.current) return
                // Outro CNPJ: o resultado anterior não vale mais.
                ultimaConsulta.current = ''
                setConsulta({ etapa: 'parada' })
                if (cnpjValido(cnpj)) void consultar(cnpj)
              }}
            />
          </Campo>

          {tipo === 'PJ' && (
            <div className="flex items-end">
              <Button
                variante="secundario"
                className="w-full sm:w-auto"
                disabled={consulta.etapa === 'consultando'}
                onClick={() => void consultar(form.getValues('cpf_cnpj'))}
              >
                {consulta.etapa === 'consultando' ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="size-4" aria-hidden />
                )}
                {consulta.etapa === 'consultando' ? 'Consultando…' : 'Consultar CNPJ'}
              </Button>
            </div>
          )}

          {tipo === 'PJ' && (consulta.etapa === 'erro' || consulta.etapa === 'pronta') && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <ResultadoConsulta
                consulta={consulta}
                aoUsarReceita={usarDadosDaReceita}
                aoManter={(dados) => setConsulta({ etapa: 'pronta', dados, conflitos: [] })}
              />
            </div>
          )}

          {tipo === 'PJ' && (
            <Campo rotulo="Inscrição estadual" htmlFor="inscricao_estadual">
              <Input id="inscricao_estadual" {...form.register('inscricao_estadual')} />
            </Campo>
          )}
        </Card>

        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Contato</h2>
          <div className="flex flex-col gap-3">
            <Campo rotulo="WhatsApp" htmlFor="whatsapp" erro={errors.whatsapp?.message}>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="(48) 99999-9999"
                aria-invalid={!!errors.whatsapp}
                {...whatsapp}
                onChange={(e) => {
                  e.target.value = formatarTelefone(e.target.value)
                  void whatsapp.onChange(e)
                }}
              />
            </Campo>
            <ListaRepetida form={form} tipo="telefone" />
          </div>
          <ListaRepetida form={form} tipo="email" />
          <EmailsFinanceiro form={form} />
        </Card>

        {!editando && (
          <Card className="flex flex-col gap-4">
            <label className="flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                className="size-4 accent-verde"
                checked={comEndereco}
                onChange={(e) => setComEndereco(e.target.checked)}
              />
              Cadastrar endereço agora
            </label>
            {comEndereco && <EnderecoCampos form={formEndereco} />}
          </Card>
        )}

        <Card className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">Comercial</h2>
          {podeEscolherVendedor ? (
            <Campo rotulo="Vendedor responsável" htmlFor="vendedor">
              <Select id="vendedor" {...form.register('vendedor_responsavel_id')}>
                <option value="">Sem vendedor por enquanto</option>
                {equipeComercial(equipe.data).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Campo>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Vendedor responsável</span>
              <span className="flex min-h-11 items-center text-texto-suave">
                {cliente?.vendedor?.nome ?? perfil.nome}
              </span>
            </div>
          )}
          <Campo rotulo="Como conheceu a empresa" htmlFor="origem">
            <Input id="origem" list="origens" {...form.register('origem')} />
            <datalist id="origens">
              {ORIGENS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Observações" htmlFor="observacoes" className="sm:col-span-2">
            <Textarea id="observacoes" {...form.register('observacoes')} />
          </Campo>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to={editando ? `/clientes/${cliente.id}` : '/clientes'}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Button>
        </div>
      </form>
    </>
  )
}

type EstadoConsulta =
  | { etapa: 'parada' }
  | { etapa: 'consultando' }
  | { etapa: 'erro'; mensagem: string }
  | { etapa: 'pronta'; dados: DadosCnpj; conflitos: Conflito[] }

/** O que a consulta do CNPJ achou: confirmação, situação na Receita e campos em dúvida. */
function ResultadoConsulta({
  consulta,
  aoUsarReceita,
  aoManter,
}: {
  consulta: Extract<EstadoConsulta, { etapa: 'erro' | 'pronta' }>
  aoUsarReceita: (dados: DadosCnpj, conflitos: Conflito[]) => void
  aoManter: (dados: DadosCnpj) => void
}) {
  if (consulta.etapa === 'erro') return <Aviso tipo="erro">{consulta.mensagem}</Aviso>

  const { dados, conflitos } = consulta
  const inativa = dados.situacao !== '' && dados.situacao !== 'ATIVA'
  return (
    <>
      <Aviso tipo="sucesso">Dados da Receita Federal preenchidos. Confira antes de salvar.</Aviso>
      {inativa && (
        <Aviso tipo="erro">
          Atenção: na Receita Federal este CNPJ está com situação {dados.situacao}.
        </Aviso>
      )}
      {conflitos.length > 0 && (
        <Aviso tipo="info">
          <p className="font-semibold">
            Estes campos já estavam preenchidos e ficaram como você digitou:
          </p>
          <ul className="mt-1 mb-3 list-disc pl-5">
            {conflitos.map((c) => (
              <li key={`${c.form}-${c.campo}`}>
                <span className="font-semibold">{c.rotulo}:</span> “{c.atual}” (na Receita: “
                {c.novo}”)
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variante="secundario" onClick={() => aoUsarReceita(dados, conflitos)}>
              Usar os dados da Receita
            </Button>
            <Button variante="fantasma" onClick={() => aoManter(dados)}>
              Manter o que digitei
            </Button>
          </div>
        </Aviso>
      )}
    </>
  )
}

/**
 * Telefones ou e-mails do cliente: o primeiro é o principal (vai na NFS-e e no boleto);
 * o botão "Adicionar" abre mais campos. A nota fiscal é enviada para todos os e-mails.
 */
function ListaRepetida({
  form,
  tipo,
}: {
  form: UseFormReturn<FormCliente>
  tipo: 'telefone' | 'email'
}) {
  const ehTelefone = tipo === 'telefone'
  const principal = ehTelefone ? 'telefone' : 'email'
  const extras = ehTelefone ? 'telefones_extras' : 'emails_extras'
  const lista = useFieldArray({ control: form.control, name: extras })
  const separado = useWatch({ control: form.control, name: 'separar_financeiro' })
  const { errors } = form.formState
  const rotulo = ehTelefone ? 'Telefone' : 'E-mail'

  const propsCampo = ehTelefone
    ? { type: 'tel', inputMode: 'tel' as const }
    : { type: 'email', inputMode: 'email' as const }

  function registrar(nome: typeof principal | `${typeof extras}.${number}.valor`) {
    const r = form.register(nome)
    if (!ehTelefone) return r
    return {
      ...r,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = formatarTelefone(e.target.value)
        return r.onChange(e)
      },
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Campo
        rotulo={rotulo}
        htmlFor={principal}
        erro={errors[principal]?.message}
        dica={
          ehTelefone
            ? undefined
            : separado
              ? 'Certificado e OS vão para estes e-mails (a nota não).'
              : lista.fields.length > 0
                ? 'A nota fiscal, o certificado e a OS vão para todos os e-mails.'
                : undefined
        }
      >
        <Input
          id={principal}
          {...propsCampo}
          aria-invalid={!!errors[principal]}
          {...registrar(principal)}
        />
      </Campo>

      {lista.fields.map((campo, i) => {
        const id = `${extras}-${i}`
        const erro = errors[extras]?.[i]?.valor?.message
        return (
          <Campo key={campo.id} rotulo={`${rotulo} ${i + 2}`} htmlFor={id} erro={erro}>
            <div className="flex gap-2">
              <Input
                id={id}
                {...propsCampo}
                aria-invalid={!!erro}
                {...registrar(`${extras}.${i}.valor`)}
              />
              <Button
                variante="fantasma"
                className="shrink-0"
                aria-label={`Remover ${rotulo.toLowerCase()} ${i + 2}`}
                onClick={() => lista.remove(i)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          </Campo>
        )
      })}

      <Button
        variante="secundario"
        className="self-start"
        onClick={() => {
          lista.append({ valor: '' }, { shouldFocus: true })
        }}
      >
        <Plus className="size-4" aria-hidden />
        {ehTelefone ? 'Adicionar outro telefone' : 'Adicionar outro e-mail'}
      </Button>
    </div>
  )
}

/**
 * Cliente que recebe a nota e o boleto num e-mail e o certificado e a OS em outro.
 * Marcado, a nota e o boleto vão SÓ para esta lista (e nunca para os e-mails de cima);
 * o certificado e a OS vão só para os de cima.
 */
function EmailsFinanceiro({ form }: { form: UseFormReturn<FormCliente> }) {
  const lista = useFieldArray({ control: form.control, name: 'emails_financeiro' })
  const separado = useWatch({ control: form.control, name: 'separar_financeiro' })
  const { errors } = form.formState
  const erroLista = errors.emails_financeiro?.message ?? errors.emails_financeiro?.root?.message

  return (
    <div className="flex flex-col gap-3 border-t border-borda pt-4">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-verde"
          {...form.register('separar_financeiro', {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.checked && lista.fields.length === 0) lista.append({ valor: '' })
            },
          })}
        />
        <span>
          <span className="font-bold">O financeiro recebe em outro e-mail</span>
          <span className="block text-sm text-texto-suave">
            Nota fiscal e boleto vão só para o e-mail do financeiro; certificado e OS, só para os
            e-mails de cima.
          </span>
        </span>
      </label>

      {separado && (
        <>
          {erroLista && <Aviso tipo="erro">{erroLista}</Aviso>}
          {lista.fields.map((campo, i) => {
            const id = `emails_financeiro-${i}`
            const erro = errors.emails_financeiro?.[i]?.valor?.message
            return (
              <Campo
                key={campo.id}
                rotulo={
                  i === 0 ? 'E-mail do financeiro (nota e boleto)' : `E-mail do financeiro ${i + 1}`
                }
                htmlFor={id}
                erro={erro}
              >
                <div className="flex gap-2">
                  <Input
                    id={id}
                    type="email"
                    inputMode="email"
                    aria-invalid={!!erro}
                    {...form.register(`emails_financeiro.${i}.valor`)}
                  />
                  {lista.fields.length > 1 && (
                    <Button
                      variante="fantasma"
                      className="shrink-0"
                      aria-label={`Remover e-mail do financeiro ${i + 1}`}
                      onClick={() => lista.remove(i)}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>
              </Campo>
            )
          })}
          <Button
            variante="secundario"
            className="self-start"
            onClick={() => lista.append({ valor: '' }, { shouldFocus: true })}
          >
            <Plus className="size-4" aria-hidden /> Adicionar outro e-mail do financeiro
          </Button>
        </>
      )}
    </div>
  )
}
