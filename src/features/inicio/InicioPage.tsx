import { CheckCircle2, Circle, Search } from 'lucide-react'
import { useNavigate } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'

import { usePerfil } from '../auth/useAuth'

const FASES = [
  { numero: 0, nome: 'Preparação do projeto', pronta: true },
  { numero: 1, nome: 'Login, perfis e clientes', pronta: true },
  { numero: 2, nome: 'Financeiro', pronta: true },
  { numero: 3, nome: 'Propostas', pronta: true },
  { numero: 4, nome: 'Serviços e vencimentos', pronta: true },
  { numero: 5, nome: 'Contratos e comissões', pronta: false },
  { numero: 6, nome: 'Vendedores e recepção', pronta: false },
  { numero: 7, nome: 'Avisos por WhatsApp e e-mail', pronta: false },
]

export function InicioPage() {
  const perfil = usePerfil()
  const navegar = useNavigate()
  const primeiroNome = perfil.nome.split(' ')[0]

  return (
    <>
      <PageHeader titulo={`Olá, ${primeiroNome}!`} />

      <form
        className="relative mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          const termo = new FormData(e.currentTarget).get('q')?.toString().trim()
          navegar(termo ? `/clientes?q=${encodeURIComponent(termo)}` : '/clientes')
        }}
      >
        <label htmlFor="busca-rapida" className="sr-only">
          Buscar cliente
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave"
          aria-hidden
        />
        <Input
          id="busca-rapida"
          name="q"
          type="search"
          placeholder="Buscar cliente por nome, CPF/CNPJ ou telefone"
          className="pl-10"
        />
      </form>

      <Card>
        <h2 className="mb-4 text-lg font-bold">Andamento do sistema</h2>
        <ol className="space-y-3">
          {FASES.map((fase) => (
            <li key={fase.numero} className="flex items-center gap-3">
              {fase.pronta ? (
                <CheckCircle2 className="size-5 shrink-0 text-verde" aria-label="Pronta" />
              ) : (
                <Circle className="size-5 shrink-0 text-borda" aria-label="Pendente" />
              )}
              <span className={fase.pronta ? 'font-semibold' : 'text-texto-suave'}>
                Fase {fase.numero}: {fase.nome}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  )
}
