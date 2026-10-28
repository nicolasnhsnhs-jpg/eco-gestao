import { Search, X } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/components/ui/Campo'
import { formatarDocumento } from '@/lib/documentos'
import { useValorAtrasado } from '@/lib/useValorAtrasado'

import { useBuscaClientes } from './api'

export type ClienteEscolhido = { id: string; nome: string }

type Props = {
  id?: string
  valor: ClienteEscolhido | null
  aoMudar: (cliente: ClienteEscolhido | null) => void
}

/** Campo para escolher um cliente digitando parte do nome, CPF/CNPJ ou telefone. */
export function ClienteSeletor({ id, valor, aoMudar }: Props) {
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const termoAtrasado = useValorAtrasado(termo.trim())
  const busca = useBuscaClientes(termoAtrasado, false)
  const resultados = termoAtrasado.length >= 2 ? (busca.data ?? []).slice(0, 8) : []

  if (valor) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-borda bg-lima-claro px-3">
        <span className="truncate font-semibold text-verde-escuro">{valor.nome}</span>
        <button
          type="button"
          onClick={() => aoMudar(null)}
          className="grid size-8 place-items-center rounded-lg text-verde-escuro hover:bg-white"
          aria-label="Trocar cliente"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-3 left-3 size-5 text-texto-suave"
        aria-hidden
      />
      <Input
        id={id}
        type="search"
        className="pl-10"
        placeholder="Digite o nome, CPF/CNPJ ou telefone"
        value={termo}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto && resultados.length > 0}
        onChange={(e) => {
          setTermo(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        // Pequena espera para dar tempo de o clique na lista acontecer.
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && termoAtrasado.length >= 2 && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-borda bg-white shadow-lg"
        >
          {resultados.length === 0 && (
            <li className="px-3 py-2 text-sm text-texto-suave">
              {busca.isFetching ? 'Buscando…' : 'Nenhum cliente encontrado.'}
            </li>
          )}
          {resultados.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-lima-claro"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  aoMudar({ id: c.id, nome: c.nome_fantasia || c.nome })
                  setTermo('')
                  setAberto(false)
                }}
              >
                <span className="block font-semibold">{c.nome_fantasia || c.nome}</span>
                <span className="block text-xs text-texto-suave">
                  {[c.nome_fantasia ? c.nome : null, formatarDocumento(c.cpf_cnpj, c.tipo_pessoa)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
