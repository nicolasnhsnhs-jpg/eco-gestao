import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { router } from './app/router'
import { AuthProvider } from './features/auth/AuthProvider'
import './index.css'
import { deveGuardarConsulta, persistidor, VALIDADE_CACHE_MS } from './lib/offline'

// Guarda em memória os dados buscados no banco e evita buscar de novo à toa.
const queryClient = new QueryClient({
  // gcTime longo: o que foi guardado no celular precisa continuar disponível sem internet.
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, gcTime: VALIDADE_CACHE_MS } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: persistidor,
        maxAge: VALIDADE_CACHE_MS,
        dehydrateOptions: { shouldDehydrateQuery: deveGuardarConsulta },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)

// App instalável que abre sem internet (só no site publicado; em desenvolvimento não).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
