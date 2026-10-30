import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { mensagemDeErro } from '@/lib/erros'
import { DOMINIO_OPERADOR } from '@/lib/papeis'
import { supabase } from '@/lib/supabase'

import { useAuth } from './useAuth'
import { TelaDeAcesso } from './TelaDeAcesso'

const esquema = z.object({
  // Operadores entram só com o login (ex.: "joao"); os demais, com o e-mail.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((valor) => (valor.includes('@') ? valor : `${valor}@${DOMINIO_OPERADOR}`))
    .pipe(z.email('Informe o e-mail ou o login.')),
  senha: z.string().min(1, 'Informe a senha.'),
})

type Dados = z.infer<typeof esquema>

export function EntrarPage() {
  const { sessao } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const voltarPara = (local.state as { voltarPara?: string } | null)?.voltarPara ?? '/'

  const form = useForm<Dados>({ resolver: zodResolver(esquema) })
  const { errors, isSubmitting } = form.formState

  async function entrar({ email, senha }: Dados) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      form.setError('root', { message: mensagemDeErro(error) })
      return
    }
    navegar(voltarPara, { replace: true })
  }

  if (sessao) return <Navigate to={voltarPara} replace />

  return (
    <TelaDeAcesso titulo="Entrar">
      <form onSubmit={form.handleSubmit(entrar)} className="flex flex-col gap-4" noValidate>
        {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
        <Campo rotulo="E-mail ou login" htmlFor="email" erro={errors.email?.message}>
          <Input
            id="email"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            inputMode="email"
            aria-invalid={!!errors.email}
            {...form.register('email')}
          />
        </Campo>
        <Campo rotulo="Senha" htmlFor="senha" erro={errors.senha?.message}>
          <Input
            id="senha"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.senha}
            {...form.register('senha')}
          />
        </Campo>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
        <Link
          to="/esqueci-senha"
          className="text-center text-sm font-semibold text-verde underline"
        >
          Esqueci minha senha
        </Link>
      </form>
    </TelaDeAcesso>
  )
}
