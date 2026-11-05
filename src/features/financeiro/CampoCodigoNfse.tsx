import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { Input } from '@/components/ui/Campo'
import { cn } from '@/lib/utils'

import {
  filtrarCodigos,
  formatarCodigoNfse,
  semAcento,
  type Codigo,
  type ListaNfse,
} from './codigosNfse'

/*
 * Código de tributação nacional e NBS com a lista oficial (Anexo B da NFS-e Nacional,
 * em listaCodigosNfse.json): ao clicar, aparece a lista; ao digitar parte do código ou da
 * descrição, ela filtra. O campo guarda só os números, como vão na nota.
 */

/** A lista só é baixada quando o campo aparece (são ~1.200 códigos). */
function useCodigosNfse(lista: ListaNfse) {
  return useQuery({
    queryKey: ['codigos-nfse'],
    staleTime: Infinity,
    queryFn: async () => (await import('./listaCodigosNfse.json')).default,
    select: (d): Codigo[] =>
      (d[lista] as [string, string][]).map(([codigo, descricao]) => ({
        codigo,
        descricao,
        busca: `${codigo} ${formatarCodigoNfse(lista, codigo)} ${semAcento(descricao)}`,
      })),
  })
}

export function CampoCodigoNfse({
  id,
  lista,
  valor,
  aoMudar,
  placeholder,
}: {
  id: string
  lista: ListaNfse
  valor: string
  aoMudar: (codigo: string) => void
  placeholder?: string
}) {
  const codigos = useCodigosNfse(lista)
  const idLista = useId()
  const [termo, setTermo] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)

  const atual = codigos.data?.find((c) => c.codigo === valor)
  const resultados = filtrarCodigos(codigos.data ?? [], termo ?? '').slice(0, 60)
  const texto = termo ?? (valor ? formatarCodigoNfse(lista, valor) : '')

  function escolher(c: Codigo) {
    aoMudar(c.codigo)
    setTermo(null)
    setAberto(false)
  }

  /** Ao sair do campo: um código digitado inteiro vale mesmo sem clicar na lista. */
  function aoSair() {
    setAberto(false)
    if (termo == null) return
    const digitos = termo.replace(/\D/g, '')
    if (termo.trim() === '') aoMudar('')
    else if (codigos.data?.some((c) => c.codigo === digitos) || !codigos.data) aoMudar(digitos)
    setTermo(null)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={texto}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && resultados[ativo] ? `${idLista}-${ativo}` : undefined}
        onFocus={() => {
          setAberto(true)
          setAtivo(0)
        }}
        onChange={(e) => {
          setTermo(e.target.value)
          setAberto(true)
          setAtivo(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAberto(true)
            setAtivo((a) => Math.min(a + 1, resultados.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAtivo((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && aberto && resultados[ativo]) {
            e.preventDefault()
            escolher(resultados[ativo])
          } else if (e.key === 'Escape') {
            setTermo(null)
            setAberto(false)
          }
        }}
        // Pequena espera para dar tempo de o clique na lista acontecer.
        onBlur={() => setTimeout(aoSair, 150)}
      />
      {aberto && (
        <ul
          id={idLista}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-borda bg-white shadow-lg"
        >
          {codigos.isPending && <li className="px-3 py-2 text-sm text-texto-suave">Carregando…</li>}
          {codigos.data && resultados.length === 0 && (
            <li className="px-3 py-2 text-sm text-texto-suave">Nenhum código encontrado.</li>
          )}
          {resultados.map((c, i) => (
            <li
              key={c.codigo}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={c.codigo === valor}
            >
              <button
                type="button"
                tabIndex={-1}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-lima-claro',
                  i === ativo && 'bg-lima-claro',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => escolher(c)}
              >
                <span className="font-mono font-semibold">
                  {formatarCodigoNfse(lista, c.codigo)}
                </span>{' '}
                {c.descricao}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!aberto && valor && (
        <p className="mt-1 text-sm text-texto-suave">
          {atual ? atual.descricao : codigos.data ? 'Código fora da lista oficial.' : ''}
        </p>
      )}
    </div>
  )
}
