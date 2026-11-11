import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'
import { NOME_DO_PAPEL } from '@/lib/papeis'

import { solicitarAcesso, verLinkCadastro } from '../usuarios/api'
import { TelaDeAcesso } from './TelaDeAcesso'

const SENHA_MINIMA = 8

const esquema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(5, 'Informe o nome completo.')
      .refine((n) => n.includes(' '), 'Informe o nome e o sobrenome.'),
    email: z.email('Informe um e-mail válido.'),
    senha: z.string().min(SENHA_MINIMA, `Mínimo de ${SENHA_MINIMA} caracteres.`),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, {
    path: ['confirmar'],
    message: 'As senhas não são iguais.',
  })
type Dados = z.infer<typeof esquema>

/**
 * Tela aberta pelo link de cadastro que o administrador manda no grupo da empresa.
 * A pessoa cria o próprio login; ele só funciona depois que o administrador aprovar.
 */
export function CadastroPage() {
  const { codigo = '' } = useParams()
  const [enviado, setEnviado] = useState(false)
  const link = useQuery({
    queryKey: ['link-cadastro', codigo],
    queryFn: () => verLinkCadastro(codigo),
    retry: false,
  })
  const form = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: { nome: '', email: '', senha: '', confirmar: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function enviar({ nome, email, senha }: Dados) {
    try {
      await solicitarAcesso({ codigo, nome, email, senha })
      setEnviado(true)
    } catch (e) {
      form.setError('root', { message: mensagemDeErro(e) })
    }
  }

  if (link.isPending) return <Carregando />

  if (link.isError) {
    return (
      <TelaDeAcesso titulo="Cadastro">
        <Aviso tipo="erro">{mensagemDeErro(link.error)}</Aviso>
        <VoltarParaLogin />
      </TelaDeAcesso>
    )
  }

  if (enviado) {
    return (
      <TelaDeAcesso titulo="Pedido enviado">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-12 text-verde" aria-hidden />
          <p>
            Pronto! O administrador vai conferir o seu cadastro. Assim que ele aprovar, você entra
            com o seu <strong>e-mail</strong> e a <strong>senha</strong> que acabou de criar.
          </p>
        </div>
        <VoltarParaLogin />
      </TelaDeAcesso>
    )
  }

  return (
    <TelaDeAcesso titulo="Criar meu acesso">
      <form onSubmit={form.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-texto-suave">
          Cadastro de <strong>{NOME_DO_PAPEL[link.data]}</strong>. Depois de enviar, aguarde a
          aprovação do administrador.
        </p>
        {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
        <Campo rotulo="Nome completo" htmlFor="cad-nome" obrigatorio erro={errors.nome?.message}>
          <Input
            id="cad-nome"
            autoComplete="name"
            aria-invalid={!!errors.nome}
            {...form.register('nome')}
          />
        </Campo>
        <Campo
          rotulo="E-mail"
          htmlFor="cad-email"
          obrigatorio
          erro={errors.email?.message}
          dica="É com ele que você vai entrar no sistema."
        >
          <Input
            id="cad-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            aria-invalid={!!errors.email}
            {...form.register('email')}
          />
        </Campo>
        <Campo rotulo="Senha" htmlFor="cad-senha" obrigatorio erro={errors.senha?.message}>
          <Input
            id="cad-senha"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.senha}
            {...form.register('senha')}
          />
        </Campo>
        <Campo
          rotulo="Repita a senha"
          htmlFor="cad-confirmar"
          obrigatorio
          erro={errors.confirmar?.message}
        >
          <Input
            id="cad-confirmar"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmar}
            {...form.register('confirmar')}
          />
        </Campo>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando…' : 'Solicitar acesso'}
        </Button>
      </form>
      <VoltarParaLogin />
    </TelaDeAcesso>
  )
}

function VoltarParaLogin() {
  return (
    <Link
      to="/entrar"
      className="mt-4 block text-center text-sm font-semibold text-verde underline"
    >
      Já tenho acesso: entrar
    </Link>
  )
}
