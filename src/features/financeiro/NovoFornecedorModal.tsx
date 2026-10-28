import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import {
  cnpjValido,
  cpfValido,
  formatarTelefone,
  limparDocumento,
  soNumeros,
  telefoneValido,
} from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'

import { useSalvarFornecedor, type Fornecedor } from './api'

const esquema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.'),
  cpf_cnpj: z
    .string()
    .trim()
    .refine((v) => v === '' || cpfValido(v) || cnpjValido(v), 'CPF ou CNPJ inválido.'),
  telefone: z
    .string()
    .trim()
    .refine((v) => v === '' || telefoneValido(v), 'Informe o DDD e o número.'),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'E-mail inválido.'),
  observacoes: z.string().trim(),
})
type Dados = z.infer<typeof esquema>

type Props = {
  aberto: boolean
  aoFechar: () => void
  /** Fornecedor para editar; sem ele, cadastra um novo. */
  fornecedor?: Fornecedor | null
  aoCriar?: (id: string) => void
}

export function NovoFornecedorModal({ aberto, aoFechar, fornecedor, aoCriar }: Props) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}
    >
      <Formulario
        fornecedor={fornecedor}
        aoTerminar={(id) => {
          aoCriar?.(id)
          aoFechar()
        }}
      />
    </Modal>
  )
}

function Formulario({
  fornecedor,
  aoTerminar,
}: {
  fornecedor?: Fornecedor | null
  aoTerminar: (id: string) => void
}) {
  const salvar = useSalvarFornecedor()
  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nome: fornecedor?.nome ?? '',
      cpf_cnpj: fornecedor?.cpf_cnpj ?? '',
      telefone: formatarTelefone(fornecedor?.telefone),
      email: fornecedor?.email ?? '',
      observacoes: fornecedor?.observacoes ?? '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const telefone = form.register('telefone')

  async function enviar(d: Dados) {
    try {
      const id = await salvar.mutateAsync({
        id: fornecedor?.id,
        dados: {
          nome: d.nome,
          cpf_cnpj: d.cpf_cnpj ? limparDocumento(d.cpf_cnpj) : null,
          telefone: d.telefone ? soNumeros(d.telefone) : null,
          email: d.email ? d.email.toLowerCase() : null,
          observacoes: d.observacoes || null,
        },
      })
      aoTerminar(id)
    } catch (erro) {
      form.setError('root', { message: mensagemDeErro(erro) })
    }
  }

  return (
    // stopPropagation: este formulário pode abrir por cima do formulário de lançamento.
    <form
      onSubmit={(e) => {
        e.stopPropagation()
        void form.handleSubmit(enviar)(e)
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
      <Campo rotulo="Nome" htmlFor="forn-nome" obrigatorio erro={errors.nome?.message}>
        <Input
          id="forn-nome"
          data-autofocus
          aria-invalid={!!errors.nome}
          {...form.register('nome')}
        />
      </Campo>
      <Campo rotulo="CPF ou CNPJ" htmlFor="forn-doc" erro={errors.cpf_cnpj?.message}>
        <Input id="forn-doc" {...form.register('cpf_cnpj')} />
      </Campo>
      <Campo rotulo="Telefone" htmlFor="forn-tel" erro={errors.telefone?.message}>
        <Input
          id="forn-tel"
          type="tel"
          inputMode="tel"
          {...telefone}
          onChange={(e) => {
            e.target.value = formatarTelefone(e.target.value)
            void telefone.onChange(e)
          }}
        />
      </Campo>
      <Campo rotulo="E-mail" htmlFor="forn-email" erro={errors.email?.message}>
        <Input id="forn-email" type="email" inputMode="email" {...form.register('email')} />
      </Campo>
      <Campo rotulo="Observações" htmlFor="forn-obs">
        <Textarea id="forn-obs" {...form.register('observacoes')} />
      </Campo>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar fornecedor'}
      </Button>
    </form>
  )
}
