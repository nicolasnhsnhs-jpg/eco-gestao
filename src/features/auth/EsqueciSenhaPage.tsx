import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input } from '@/components/ui/Campo'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'

import { TelaDeAcesso } from './TelaDeAcesso'

const esquema = z.object({ email: z.email('Informe um e-mail válido.') })
type Dados = z.infer<typeof esquema>

export function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false)
  const form = useForm<Dados>({ resolver: zodResolver(esquema) })
  const { errors, isSubmitting } = form.formState

  async function enviar({ email }: Dados) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-senha`,
    })
    if (error) {
      form.setError('root', { message: mensagemDeErro(error) })
      return
    }
    setEnviado(true)
  }

  return (
    <TelaDeAcesso titulo="Esqueci minha senha">
      {enviado ? (
        <Aviso tipo="sucesso">
          Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.
          Confira também a caixa de spam.
        </Aviso>
      ) : (
        <form onSubmit={form.handleSubmit(enviar)} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-texto-suave">
            Informe o seu e-mail e enviaremos um link para criar uma nova senha.
          </p>
          {errors.root && <Aviso tipo="erro">{errors.root.message}</Aviso>}
          <Campo rotulo="E-mail" htmlFor="email" erro={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
          </Campo>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
      )}
      <Link
        to="/entrar"
        className="mt-4 block text-center text-sm font-semibold text-verde underline"
      >
        Voltar para o login
      </Link>
    </TelaDeAcesso>
  )
}
