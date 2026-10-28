import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import { useAuth } from './useAuth'
import { TelaDeAcesso } from './TelaDeAcesso'

const esquema = z
  .object({
    senha: z.string().min(8, 'Use pelo menos 8 caracteres.'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não são iguais.',
  })

type Dados = z.infer<typeof esquema>

/**
 * Aberta pelo link do e-mail de convite ou de "esqueci minha senha".
 * O próprio link já faz o login; aqui a pessoa só escolhe a senha.
 */
export function DefinirSenhaPage() {
  const { sessao, carregando } = useAuth()
  const navegar = useNavigate()
  const form = useForm<Dados>({ resolver: zodResolver(esquema) })
  const { errors, isSubmitting } = form.formState

  async function salvar({ senha }: Dados) {
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      form.setError('root', { message: mensagemDeErro(error) })
      return
    }
    navegar('/', { replace: true })
  }

  if (carregando) return <Carregando />

  if (!sessao) {
    return (
      <TelaDeAcesso titulo="Link inválido ou expirado">
        <p className="text-texto-suave">
          O link pode ter expirado ou já ter sido usado. Peça um novo em “Esqueci minha senha”.
        </p>
        <Link
          to="/esqueci-senha"
          className="mt-4 block text-center text-sm font-semibold text-verde underline"
        >
          Pedir um novo link
        </Link>
      </TelaDeAcesso>
    )
  }

  return (
    <TelaDeAcesso titulo="Criar senha">
      <form onSubmit={form.handleSubmit(salvar)} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-texto-suave">
          Acesso de <strong>{sessao.user.email}</strong>. Escolha uma senha com pelo menos 8
          caracteres.
        </p>
        {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
        <Campo rotulo="Nova senha" htmlFor="senha" erro={errors.senha?.message}>
          <Input
            id="senha"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.senha}
            {...form.register('senha')}
          />
        </Campo>
        <Campo rotulo="Repita a senha" htmlFor="confirmacao" erro={errors.confirmacao?.message}>
          <Input
            id="confirmacao"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmacao}
            {...form.register('confirmacao')}
          />
        </Campo>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar senha e entrar'}
        </Button>
      </form>
    </TelaDeAcesso>
  )
}
