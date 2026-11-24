import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { mensagemDeErro } from '@/lib/erros'

import { useImplantacao, type PontoImplantacao, type PontoOs } from '../pragasApi'
import {
  escreverFaixas,
  FORMAS_ISCAGEM,
  lerFaixas,
  MODELOS_ARMADILHA,
  TIPOS_ISCA,
} from '../tipos/pragas'

const TIPOS: Record<PontoImplantacao['tipo'], string> = {
  porta_isca: 'Porta-isca / porta-cola',
  armadilha_luminosa: 'Armadilha luminosa',
  feromonio: 'Armadilha com feromônio',
  armadilha_moscas: 'Armadilha de moscas',
}

const mesmaArea = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Como o grupo aparece na lista: "Porta-isca externo · Isca parafinada". */
function descricaoDoGrupo(p: PontoOs) {
  if (p.tipo === 'porta_isca')
    return [
      FORMAS_ISCAGEM[p.forma_iscagem as keyof typeof FORMAS_ISCAGEM] ?? p.forma_iscagem,
      TIPOS_ISCA[p.tipo_isca as keyof typeof TIPOS_ISCA] ?? p.tipo_isca,
    ]
      .filter(Boolean)
      .join(' · ')
  if (p.tipo === 'armadilha_luminosa')
    return `Armadilha luminosa · ${
      MODELOS_ARMADILHA[p.modelo_armadilha as keyof typeof MODELOS_ARMADILHA] ?? p.modelo_armadilha
    }`
  return TIPOS[p.tipo as PontoImplantacao['tipo']] ?? p.tipo
}

/**
 * OS de implantação: o técnico cadastra os pontos que está instalando. Eles vão para
 * a O.S salva do local (e para esta OS); o escritório revisa na conferência.
 */
export function CadastroImplantacao({
  osId,
  pontos,
  aberta,
}: {
  osId: string
  pontos: PontoOs[]
  aberta: boolean
}) {
  const { adicionar, remover } = useImplantacao(osId)
  const [tipo, setTipo] = useState<PontoImplantacao['tipo']>('porta_isca')
  const [area, setArea] = useState('')
  const [numeros, setNumeros] = useState('')
  const [forma, setForma] = useState('PIE')
  const [tipoIsca, setTipoIsca] = useState('IP')
  const [modelo, setModelo] = useState('P')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const areas = [...new Set(pontos.map((p) => p.area.trim()))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
  const doTipo = pontos.filter((p) => p.tipo === tipo)
  const proximo = Math.max(0, ...doTipo.map((p) => p.numero)) + 1

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)
    if (!area.trim()) return setErro('Diga a área onde está instalando.')
    const { numeros: lista, invalidos } = lerFaixas(numeros)
    if (invalidos.length) return setErro(`Não entendi: ${invalidos.join(', ')}.`)
    if (!lista.length) return setErro('Diga o número (ou os números: 1-10, 15).')
    const repetidos = lista.filter((n) =>
      doTipo.some((p) => p.numero === n && mesmaArea(p.area, area)),
    )
    if (repetidos.length) return setErro(`Já cadastrado nesta área: ${escreverFaixas(repetidos)}.`)
    if (typeof navigator !== 'undefined' && !navigator.onLine)
      return setErro(
        'Sem sinal agora. O cadastro da implantação precisa de internet: tente de novo.',
      )
    try {
      await adicionar.mutateAsync(
        lista.map((numero) => ({
          tipo,
          numero,
          area: area.trim(),
          forma_iscagem: tipo === 'porta_isca' ? forma : null,
          tipo_isca: tipo === 'porta_isca' ? tipoIsca : null,
          modelo_armadilha: tipo === 'armadilha_luminosa' ? modelo : null,
        })),
      )
      setSucesso(
        `${lista.length > 1 ? `${lista.length} pontos cadastrados` : 'Ponto cadastrado'} em ${area.trim()}.`,
      )
      setNumeros('')
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function tirar(p: PontoOs) {
    if (!p.ponto_id) return
    if (!window.confirm(`Tirar o nº ${p.numero} (${p.area})?`)) return
    setErro(null)
    setSucesso(null)
    try {
      await remover.mutateAsync(p.ponto_id)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  // Lista por área e, dentro dela, por tipo/forma/isca.
  const grupos = new Map<string, { area: string; titulo: string; itens: PontoOs[] }>()
  for (const p of [...pontos].sort((a, b) => a.numero - b.numero)) {
    const titulo = descricaoDoGrupo(p)
    const chave = `${p.area.trim().toLowerCase()}|${p.tipo}|${titulo}`
    const g = grupos.get(chave) ?? { area: p.area.trim(), titulo, itens: [] }
    g.itens.push(p)
    grupos.set(chave, g)
  }
  const ordenados = [...grupos.values()].sort(
    (a, b) => a.area.localeCompare(b.area, 'pt-BR') || a.titulo.localeCompare(b.titulo),
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-verde/40 bg-lima-claro/40 p-3">
      <div>
        <p className="font-bold text-verde-escuro">Implantação: cadastre os pontos instalados</p>
        <p className="text-sm text-texto-suave">
          Para cada área, diga os números, a forma de iscagem e o tipo de isca. Eles viram a O.S
          deste local para os próximos atendimentos (o escritório revisa depois).
        </p>
      </div>

      {aberta && (
        <form onSubmit={cadastrar} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="O que está instalando" htmlFor="imp-tipo" className="sm:col-span-2">
            <Select
              id="imp-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as PontoImplantacao['tipo'])}
            >
              {Object.entries(TIPOS).map(([v, nome]) => (
                <option key={v} value={v}>
                  {nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Área" htmlFor="imp-area">
            <Input
              id="imp-area"
              list="imp-areas"
              placeholder="Ex.: Área externa, Depósito"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
            <datalist id="imp-areas">
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Números" htmlFor="imp-numeros" dica="Um ou vários: 1-10, 15">
            <Input
              id="imp-numeros"
              inputMode="numeric"
              placeholder={String(proximo)}
              value={numeros}
              onChange={(e) => setNumeros(e.target.value)}
            />
          </Campo>
          {tipo === 'porta_isca' && (
            <>
              <Campo rotulo="Forma de iscagem" htmlFor="imp-forma">
                <Select id="imp-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                  {Object.entries(FORMAS_ISCAGEM).map(([c, nome]) => (
                    <option key={c} value={c}>
                      {nome} ({c})
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo rotulo="Tipo de isca" htmlFor="imp-isca">
                <Select
                  id="imp-isca"
                  value={tipoIsca}
                  onChange={(e) => setTipoIsca(e.target.value)}
                >
                  {Object.entries(TIPOS_ISCA).map(([c, nome]) => (
                    <option key={c} value={c}>
                      {nome} ({c})
                    </option>
                  ))}
                </Select>
              </Campo>
            </>
          )}
          {tipo === 'armadilha_luminosa' && (
            <Campo rotulo="Modelo" htmlFor="imp-modelo">
              <Select id="imp-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)}>
                {Object.entries(MODELOS_ARMADILHA).map(([c, nome]) => (
                  <option key={c} value={c}>
                    {nome}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
          <Button type="submit" className="sm:col-span-2" disabled={adicionar.isPending}>
            <Plus className="size-4" aria-hidden />
            {adicionar.isPending ? 'Cadastrando…' : 'Cadastrar'}
          </Button>
        </form>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      {ordenados.length === 0 ? (
        <p className="text-sm text-texto-suave">Nenhum ponto cadastrado ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenados.map((g) => (
            <li key={`${g.area}|${g.titulo}`} className="rounded-lg bg-white p-2">
              <p className="text-sm">
                <span className="font-semibold">{g.area}</span>{' '}
                <span className="text-texto-suave">
                  · {g.titulo} · {g.itens.length} un. (nº{' '}
                  {escreverFaixas(g.itens.map((p) => p.numero))})
                </span>
              </p>
              {aberta && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.itens.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void tirar(p)}
                      disabled={remover.isPending}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-borda px-2 text-sm hover:bg-fundo-suave"
                      aria-label={`Tirar o nº ${p.numero} de ${g.area}`}
                    >
                      {p.numero} <X className="size-3.5 text-texto-suave" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm font-semibold">Total: {pontos.length} pontos</p>
    </div>
  )
}
