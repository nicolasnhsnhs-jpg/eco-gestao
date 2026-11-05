import { NavLink, Outlet } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { usePerfil } from '@/features/auth/useAuth'
import type { Papel } from '@/lib/papeis'
import { cn } from '@/lib/utils'

const ABAS: { rotulo: string; caminho: string; papeis: readonly Papel[] }[] = [
  { rotulo: 'Calculadora', caminho: '/orcamentos', papeis: ['admin', 'vendedor'] },
  { rotulo: 'Custos e margens', caminho: '/orcamentos/custos', papeis: ['admin'] },
]

/** Abas da calculadora de orçamentos. O vendedor só vê a calculadora. */
export function OrcamentosLayout() {
  const perfil = usePerfil()
  const abas = ABAS.filter((a) => a.papeis.includes(perfil.papel))
  return (
    <>
      <PageHeader
        titulo="Calculadora de orçamentos"
        descricao="Preço mínimo, ideal e máximo de cada serviço, com base nos custos e nas margens."
      />
      {abas.length > 1 && (
        <nav
          aria-label="Orçamentos"
          className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1"
        >
          {abas.map((aba) => (
            <NavLink
              key={aba.caminho}
              to={aba.caminho}
              end
              className={({ isActive }) =>
                cn(
                  'flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap',
                  isActive ? 'bg-verde text-white' : 'text-texto-suave hover:bg-lima-claro',
                )
              }
            >
              {aba.rotulo}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet />
    </>
  )
}
