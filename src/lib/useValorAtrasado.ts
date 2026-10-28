import { useEffect, useState } from 'react'

/**
 * Devolve o valor só depois que ele parar de mudar por alguns milissegundos.
 * Usado na busca: espera a pessoa parar de digitar antes de consultar o banco.
 */
export function useValorAtrasado<T>(valor: T, atrasoMs = 300): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), atrasoMs)
    return () => clearTimeout(t)
  }, [valor, atrasoMs])
  return atrasado
}
