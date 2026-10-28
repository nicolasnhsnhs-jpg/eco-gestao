import { ShieldOff } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import type { Papel } from '@/lib/papeis'

import { useAuth } from './useAuth'

/** Sai sozinho depois de um tempo sem uso (ex.: computador esquecido aberto). */
const MINUTOS_SEM_USO = 120

/**
 * Só mostra o conteúdo para quem está logado e ativo.
 * Lembrete: isto apenas organiza a tela. Quem impede o acesso aos dados é o banco (RLS).
 */
export function RotaProtegida({ children }: { children: ReactNode }) {
  const { sessao, perfil, carregando, sair } = useAuth()
  const local = useLocation()

  useSairSemUso(!!sessao, sair)

  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace state={{ voltarPara: local.pathname }} />

  if (!perfil?.ativo) {
    return (
      <div className="grid min-h-dvh place-items-center bg-fundo-suave p-4">
        <Card className="max-w-sm text-center">
          <ShieldOff className="mx-auto mb-3 size-10 text-perigo" aria-hidden />
          <h1 className="text-lg font-bold">Acesso desativado</h1>
          <p className="mt-2 text-texto-suave">
            Seu usuário está desativado. Fale com o administrador do sistema.
          </p>
          <Button className="mt-4 w-full" onClick={sair}>
            Sair
          </Button>
        </Card>
      </div>
    )
  }

  return children
}

/** Mostra o conteúdo só para os perfis indicados. */
export function ExigePapel({
  papeis,
  children,
}: {
  papeis: readonly Papel[]
  children: ReactNode
}) {
  const { perfil } = useAuth()
  if (!perfil || !papeis.includes(perfil.papel)) {
    return (
      <Card className="py-12 text-center">
        <ShieldOff className="mx-auto mb-3 size-10 text-texto-suave" aria-hidden />
        <h1 className="text-lg font-bold">Sem acesso</h1>
        <p className="mt-2 text-texto-suave">O seu perfil não tem acesso a esta área.</p>
      </Card>
    )
  }
  return children
}

function useSairSemUso(ativo: boolean, sair: () => Promise<void>) {
  useEffect(() => {
    if (!ativo) return
    let temporizador: ReturnType<typeof setTimeout>
    const reiniciar = () => {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => void sair(), MINUTOS_SEM_USO * 60_000)
    }
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }))
    reiniciar()
    return () => {
      clearTimeout(temporizador)
      eventos.forEach((e) => window.removeEventListener(e, reiniciar))
    }
  }, [ativo, sair])
}
