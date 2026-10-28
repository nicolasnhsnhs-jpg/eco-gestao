import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'

import { useAuth, usePerfil } from '@/features/auth/useAuth'
import { useAvisosNaoLidos } from '@/features/avisos/api'
import { NOME_DO_PAPEL } from '@/lib/papeis'
import { cn } from '@/lib/utils'

import { menuDoPapel, type ItemMenu } from './navegacao'

/**
 * Estrutura de todas as páginas:
 * - computador: menu fixo à esquerda;
 * - celular: barra no topo com o logo e barra de atalhos embaixo, mais um menu completo.
 */
export function AppLayout() {
  const [menuAberto, setMenuAberto] = useState(false)
  const itens = menuDoPapel(usePerfil().papel)

  return (
    <div className="min-h-dvh lg:flex">
      {/* Menu lateral (computador) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borda bg-white lg:flex">
        <Logo className="px-6 pt-6 pb-4" />
        <nav aria-label="Menu principal" className="flex-1 space-y-1 overflow-y-auto px-3">
          {itens.map((item) => (
            <ItemLateral key={item.caminho} item={item} />
          ))}
        </nav>
        <Usuario />
      </aside>

      {/* Topo (celular) */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-borda bg-white px-4 lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          className="grid size-11 place-items-center rounded-xl text-verde-escuro hover:bg-lima-claro"
          aria-label="Abrir menu"
        >
          <Menu aria-hidden />
        </button>
      </header>

      {/* Menu completo (celular) */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-verde-noite/40"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
          />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between px-4">
              <span className="font-titulo font-bold text-verde-escuro">Menu</span>
              <button
                type="button"
                onClick={() => setMenuAberto(false)}
                className="grid size-11 place-items-center rounded-xl text-verde-escuro hover:bg-lima-claro"
                aria-label="Fechar menu"
              >
                <X aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {itens.map((item) => (
                <ItemLateral key={item.caminho} item={item} aoClicar={() => setMenuAberto(false)} />
              ))}
            </nav>
            <Usuario />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pb-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Atalhos (celular) */}
      <nav
        aria-label="Atalhos"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-borda bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {itens
          .filter((item) => item.barraInferior)
          .map((item) => (
            <NavLink
              key={item.caminho}
              to={item.caminho}
              end={item.caminho === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold',
                  isActive ? 'text-verde' : 'text-texto-suave',
                )
              }
            >
              <span className="relative">
                <item.icone className="size-5" aria-hidden />
                {item.caminho === '/avisos' && <ContadorAvisos flutuante />}
              </span>
              {item.rotulo}
            </NavLink>
          ))}
      </nav>
    </div>
  )
}

function ItemLateral({ item, aoClicar }: { item: ItemMenu; aoClicar?: () => void }) {
  return (
    <NavLink
      to={item.caminho}
      end={item.caminho === '/'}
      onClick={aoClicar}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors',
          isActive
            ? 'bg-lima-claro text-verde-escuro'
            : 'text-texto-suave hover:bg-fundo-suave hover:text-verde-escuro',
        )
      }
    >
      <item.icone className="size-5" aria-hidden />
      <span className="flex-1">{item.rotulo}</span>
      {item.caminho === '/avisos' && <ContadorAvisos />}
    </NavLink>
  )
}

/** Número de avisos não lidos, ao lado de "Avisos" no menu. */
function ContadorAvisos({ flutuante }: { flutuante?: boolean }) {
  const { data: total = 0 } = useAvisosNaoLidos()
  if (total === 0) return null
  return (
    <span
      className={cn(
        'grid min-w-5 place-items-center rounded-full bg-perigo px-1.5 text-xs leading-5 font-bold text-white',
        flutuante && 'absolute -top-2 -right-3',
      )}
      aria-label={`${total} aviso(s) não lido(s)`}
    >
      {total > 99 ? '99+' : total}
    </span>
  )
}

function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img src="/logo.webp" alt="Eco Ambiental" className="h-9 w-auto" />
      <span className="border-l border-borda pl-3 font-titulo text-sm font-bold text-verde-escuro">
        Gestão
      </span>
    </div>
  )
}

function Usuario() {
  const { perfil, sair } = useAuth()
  return (
    <div className="flex items-center gap-2 border-t border-borda p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-texto">{perfil?.nome}</p>
        <p className="text-xs text-texto-suave">{perfil && NOME_DO_PAPEL[perfil.papel]}</p>
      </div>
      <button
        type="button"
        onClick={() => void sair()}
        className="grid size-10 place-items-center rounded-xl text-texto-suave hover:bg-lima-claro hover:text-verde-escuro"
        aria-label="Sair do sistema"
        title="Sair"
      >
        <LogOut className="size-5" aria-hidden />
      </button>
    </div>
  )
}
