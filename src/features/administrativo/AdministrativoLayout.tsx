import { NavLink, Outlet } from 'react-router'

import { cn } from '@/lib/utils'

const ABAS = [{ rotulo: 'Assinatura de e-mail', caminho: '/administrativo/assinatura', fim: false }]

/** Abas do administrativo, por cima de cada tela. */
export function AdministrativoLayout() {
  return (
    <>
      <nav
        aria-label="Administrativo"
        className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-borda bg-white p-1"
      >
        {ABAS.map((aba) => (
          <NavLink
            key={aba.caminho}
            to={aba.caminho}
            end={aba.fim}
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
      <Outlet />
    </>
  )
}
