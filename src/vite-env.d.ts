/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** "sc" (padrão) ou "rs": veja src/lib/unidade.ts. */
  readonly VITE_UNIDADE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
