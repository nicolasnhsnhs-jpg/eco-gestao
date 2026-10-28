import { Building2, ChevronRight, Plus, Search, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarDocumento, formatarTelefone } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'
import { useValorAtrasado } from '@/lib/useValorAtrasado'

import { useBuscaClientes } from './api'

export function ClientesPage() {
  // O termo fica no endereço da página (?q=...), então "voltar" mantém a busca.
  const [parametros, setParametros] = useSearchParams()
  const termo = parametros.get('q') ?? ''
  const [incluirInativos, setIncluirInativos] = useState(false)

  // Espera a pessoa parar de digitar um instante antes de buscar.
  const termoAtrasado = useValorAtrasado(termo.trim())
  const busca = useBuscaClientes(termoAtrasado, incluirInativos)

  return (
    <>
      <PageHeader
        titulo="Clientes"
        acoes={
          <Link
            to="/clientes/novo"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 font-semibold text-white hover:bg-verde-escuro"
          >
            <Plus className="size-5" aria-hidden />
            Novo cliente
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar cliente</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-texto-suave"
            aria-hidden
          />
          <Input
            type="search"
            autoFocus
            placeholder="Nome, CPF/CNPJ ou telefone"
            className="pl-10"
            value={termo}
            onChange={(e) =>
              setParametros(e.target.value ? { q: e.target.value } : {}, { replace: true })
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-texto-suave">
          <input
            type="checkbox"
            className="size-4 accent-verde"
            checked={incluirInativos}
            onChange={(e) => setIncluirInativos(e.target.checked)}
          />
          Mostrar inativos
        </label>
      </div>

      {busca.isError && <Aviso tipo="erro">{mensagemDeErro(busca.error)}</Aviso>}
      {busca.isPending && <Carregando />}

      {busca.data && busca.data.length === 0 && (
        <Card className="py-10 text-center text-texto-suave">
          {termo ? (
            <>
              Nenhum cliente encontrado para “{termo}”.{' '}
              <Link to="/clientes/novo" className="font-semibold text-verde underline">
                Cadastrar novo cliente
              </Link>
            </>
          ) : (
            'Nenhum cliente cadastrado ainda.'
          )}
        </Card>
      )}

      {busca.data && busca.data.length > 0 && (
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-white">
          {busca.data.map((cliente) => {
            const endereco =
              cliente.enderecos.find((e) => e.principal) ?? cliente.enderecos[0] ?? null
            const Icone = cliente.tipo_pessoa === 'PJ' ? Building2 : User
            return (
              <li key={cliente.id}>
                <Link
                  to={`/clientes/${cliente.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-fundo-suave"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lima-claro text-verde">
                    <Icone className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="truncate">{cliente.nome_fantasia || cliente.nome}</span>
                      {!cliente.ativo && <Etiqueta>Inativo</Etiqueta>}
                    </p>
                    <p className="truncate text-sm text-texto-suave">
                      {[
                        cliente.nome_fantasia ? cliente.nome : null,
                        formatarDocumento(cliente.cpf_cnpj, cliente.tipo_pessoa),
                        formatarTelefone(cliente.whatsapp || cliente.telefone),
                        endereco && `${endereco.cidade}/${endereco.uf}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {cliente.vendedor && (
                      <p className="text-xs text-texto-suave">Vendedor: {cliente.vendedor.nome}</p>
                    )}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
