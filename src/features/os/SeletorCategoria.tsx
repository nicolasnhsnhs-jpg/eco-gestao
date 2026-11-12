import { NOME_CATEGORIA_OS, type CategoriaOs } from './api'

const DICA: Record<CategoriaOs, string> = {
  contrato: 'Cliente com contrato: as visitas se repetem.',
  avulsa: 'Serviço pontual, fora de contrato.',
}

/** Botões "Contrato | Avulsa" — obrigatório escolher ao emitir ou montar uma O.S. */
export function SeletorCategoria({
  valor,
  aoMudar,
  id,
}: {
  valor: CategoriaOs | ''
  aoMudar: (c: CategoriaOs) => void
  id?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div id={id} role="radiogroup" aria-label="Tipo da O.S" className="grid grid-cols-2 gap-2">
        {(['contrato', 'avulsa'] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={valor === c}
            onClick={() => aoMudar(c)}
            className={`min-h-11 rounded-xl border px-3 font-semibold ${
              valor === c
                ? 'border-verde bg-verde text-white'
                : 'border-borda bg-white text-texto hover:border-verde'
            }`}
          >
            {NOME_CATEGORIA_OS[c]}
          </button>
        ))}
      </div>
      {valor && <p className="text-sm text-texto-suave">{DICA[valor]}</p>}
    </div>
  )
}
