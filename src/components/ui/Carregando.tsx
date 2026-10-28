import { LoaderCircle } from 'lucide-react'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-texto-suave" role="status">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  )
}
