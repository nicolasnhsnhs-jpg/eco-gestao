import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { del, get, set } from 'idb-keyval'

/*
 * Funcionamento sem internet (operadores em campo).
 * - O que o app já buscou fica guardado no celular (IndexedDB) e aparece offline.
 * - Só as consultas do trabalho do operador são guardadas, e só para operadores:
 *   no computador do escritório nada fica salvo no navegador.
 */

const CHAVE_CACHE = 'eco-gestao-cache'

/** Um dia de folga além do dia da OS (o plano é baixar só as OS do dia). */
export const VALIDADE_CACHE_MS = 2 * 24 * 60 * 60 * 1000

let guardarNoCelular = false

/** Ligado pelo AuthProvider quando o usuário logado é operador. */
export function definirGuardarNoCelular(sim: boolean) {
  guardarNoCelular = sim
}

const CONSULTAS_DO_OPERADOR = new Set(['os', 'perfil', 'veiculos', 'arquivos'])

export function deveGuardarConsulta(query: Query) {
  return (
    guardarNoCelular &&
    query.state.status === 'success' &&
    CONSULTAS_DO_OPERADOR.has(String(query.queryKey[0]))
  )
}

export const persistidor = createAsyncStoragePersister({
  key: CHAVE_CACHE,
  storage: {
    getItem: async (chave) => (await get<string>(chave)) ?? null,
    setItem: (chave, valor) => set(chave, valor),
    removeItem: (chave) => del(chave),
  },
  throttleTime: 1000,
})

/** Apaga do celular tudo o que foi guardado (ao sair do sistema). */
export async function limparGuardado() {
  await del(CHAVE_CACHE)
}

/**
 * Sessão de login guardada pelo Supabase no navegador. Sem internet, o Supabase não
 * consegue renovar o token vencido e devolve "sem sessão"; aqui lemos a sessão
 * guardada para o operador continuar trabalhando. Quando o sinal volta, o
 * Supabase renova o token e o banco volta a conferir tudo.
 */
export function sessaoGuardada(): Session | null {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    const texto = localStorage.getItem(`sb-${ref}-auth-token`)
    if (!texto) return null
    const sessao = JSON.parse(texto) as Session
    return sessao?.user?.id ? sessao : null
  } catch {
    return null
  }
}

export const estaOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)
