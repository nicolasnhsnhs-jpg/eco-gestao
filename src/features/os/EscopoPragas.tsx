import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import type { OsCompleta } from './api'
import {
  usePontosModelo,
  useSalvarEscopoPragas,
  useSalvarPontos,
  type PontoControle,
} from './pragasApi'
import {
  escreverFaixas,
  FORMAS_ISCAGEM,
  lerFaixas,
  PRAGAS_ALVO,
  TIPOS_ISCA,
  type EscopoPragas as Escopo,
} from './tipos/pragas'

/**
 * Escopo do controle de pragas (escritório): pragas alvo, áreas de insetos e os
 * pontos de controle do local. Os pontos ficam no modelo e valem para as próximas
 * visitas; enquanto a OS não começou, ela é atualizada junto.
 */
export function EscopoPragas({ os }: { os: OsCompleta }) {
  const pontos = usePontosModelo(os.modelo_id)
  const antesDeComecar = os.status === 'rascunho' || os.status === 'agendada'
  const salvarPontos = useSalvarPontos(os.id, antesDeComecar)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    setErro(null)
    setSucesso(null)
    try {
      await acao()
      setSucesso(mensagem)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (!os.modelo_id) {
    return <Aviso tipo="info">Esta OS não tem modelo, então não tem pontos de controle.</Aviso>
  }

  const portaIscas = pontos.data?.filter((p) => p.tipo === 'porta_isca' && p.ativo) ?? []
  const armadilhas = pontos.data?.filter((p) => p.tipo === 'armadilha_luminosa' && p.ativo) ?? []
  const inativos = pontos.data?.filter((p) => !p.ativo) ?? []

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">
        Escopo do controle de pragas
      </h2>
      {!antesDeComecar && (
        <Aviso tipo="info">
          A execução já começou: mudanças nos pontos valem a partir da próxima visita.
        </Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      <FormEscopo key={os.id} os={os} aoSalvar={executar} />

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <h3 className="font-semibold text-verde-escuro">Porta-iscas ({portaIscas.length})</h3>
        {pontos.isPending && <Carregando />}
        <ResumoPorArea pontos={portaIscas} />
        <FormLote
          ocupado={salvarPontos.isPending}
          aoAdicionar={(novos) =>
            executar(
              () =>
                salvarPontos.mutateAsync({
                  novos: novos.map((n) => ({ ...n, modelo_id: os.modelo_id!, tipo: 'porta_isca' })),
                }),
              `${novos.length} porta-isca(s) cadastrado(s).`,
            )
          }
        />
        <FormRemover
          pontos={portaIscas}
          ocupado={salvarPontos.isPending}
          aoRemover={(p) =>
            executar(
              () => salvarPontos.mutateAsync({ alterar: { id: p.id, dados: { ativo: false } } }),
              `Porta-isca ${p.numero} retirado. O histórico dele continua guardado.`,
            )
          }
        />
      </section>

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <h3 className="font-semibold text-verde-escuro">
          Armadilhas luminosas ({armadilhas.length})
        </h3>
        <ul className="flex flex-col gap-1">
          {armadilhas.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <span className="flex-1">
                {String(a.numero).padStart(2, '0')} · {a.area} ·{' '}
                {a.modelo_armadilha === 'P' ? 'Branca (P)' : 'Inox (G)'}
              </span>
              <Button
                variante="fantasma"
                disabled={salvarPontos.isPending}
                onClick={() =>
                  void executar(
                    () =>
                      salvarPontos.mutateAsync({ alterar: { id: a.id, dados: { ativo: false } } }),
                    `Armadilha ${a.numero} retirada.`,
                  )
                }
              >
                Retirar
              </Button>
            </li>
          ))}
        </ul>
        <FormArmadilha
          proximoNumero={Math.max(0, ...armadilhas.map((a) => a.numero)) + 1}
          ocupado={salvarPontos.isPending}
          aoAdicionar={(nova) =>
            executar(
              () =>
                salvarPontos.mutateAsync({
                  novos: [{ ...nova, modelo_id: os.modelo_id!, tipo: 'armadilha_luminosa' }],
                }),
              'Armadilha cadastrada.',
            )
          }
        />
      </section>

      {inativos.length > 0 && (
        <p className="text-sm text-texto-suave">
          Retirados (guardados no histórico): {inativos.map((p) => p.numero).join(', ')}
        </p>
      )}
    </Card>
  )
}

function FormEscopo({
  os,
  aoSalvar,
}: {
  os: OsCompleta
  aoSalvar: (acao: () => Promise<unknown>, mensagem: string) => Promise<void>
}) {
  const salvar = useSalvarEscopoPragas(os.id, os.modelo_id)
  const inicial = (os.escopo ?? {}) as Escopo
  const [escopo, setEscopo] = useState<Escopo>({
    subtipo: inicial.subtipo ?? 'roedores',
    pragas_alvo: inicial.pragas_alvo ?? [],
    areas_insetos: inicial.areas_insetos ?? '',
    armadilhas_contrato: inicial.armadilhas_contrato,
  })

  return (
    <div className="flex flex-col gap-3">
      <Campo rotulo="Serviço" htmlFor="esc-subtipo">
        <Select
          id="esc-subtipo"
          value={escopo.subtipo}
          onChange={(e) => setEscopo({ ...escopo, subtipo: e.target.value as Escopo['subtipo'] })}
        >
          <option value="roedores">Roedores</option>
          <option value="insetos_roedores">Insetos e roedores</option>
        </Select>
      </Campo>
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="mb-1 font-semibold">Pragas alvo</legend>
        {PRAGAS_ALVO.map((praga) => (
          <label key={praga} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              className="size-5 accent-verde"
              checked={escopo.pragas_alvo?.includes(praga) ?? false}
              onChange={(e) =>
                setEscopo({
                  ...escopo,
                  pragas_alvo: e.target.checked
                    ? [...(escopo.pragas_alvo ?? []), praga]
                    : (escopo.pragas_alvo ?? []).filter((p) => p !== praga),
                })
              }
            />
            {praga}
          </label>
        ))}
      </fieldset>
      {escopo.subtipo === 'insetos_roedores' && (
        <Campo
          rotulo="Áreas do cliente (insetos)"
          htmlFor="esc-areas"
          dica='Ex.: "Dependências gerais".'
        >
          <Input
            id="esc-areas"
            value={escopo.areas_insetos ?? ''}
            onChange={(e) => setEscopo({ ...escopo, areas_insetos: e.target.value })}
          />
        </Campo>
      )}
      <Campo rotulo="Armadilhas luminosas no contrato" htmlFor="esc-armadilhas">
        <Input
          id="esc-armadilhas"
          inputMode="numeric"
          value={escopo.armadilhas_contrato?.toString() ?? ''}
          onChange={(e) => {
            const n = e.target.value.replace(/\D/g, '')
            setEscopo({ ...escopo, armadilhas_contrato: n ? Number(n) : undefined })
          }}
        />
      </Campo>
      <Button
        variante="secundario"
        disabled={salvar.isPending}
        onClick={() => void aoSalvar(() => salvar.mutateAsync(escopo), 'Escopo salvo neste local.')}
      >
        Salvar escopo
      </Button>
    </div>
  )
}

/** "Expedição: 1-3 (PIE · IP)" — uma linha por área e tipo, em vez de 200 linhas. */
function ResumoPorArea({ pontos }: { pontos: PontoControle[] }) {
  const grupos = new Map<string, number[]>()
  for (const p of pontos) {
    const chave = `${p.area} (${p.forma_iscagem} · ${p.tipo_isca})`
    grupos.set(chave, [...(grupos.get(chave) ?? []), p.numero])
  }
  if (grupos.size === 0)
    return <p className="text-sm text-texto-suave">Nenhum porta-isca cadastrado.</p>
  return (
    <ul className="flex flex-col gap-1">
      {[...grupos].map(([chave, numeros]) => (
        <li key={chave}>
          <span className="font-semibold">{chave}:</span> {escreverFaixas(numeros)}
        </li>
      ))}
    </ul>
  )
}

type NovoPortaIsca = { numero: number; area: string; forma_iscagem: string; tipo_isca: string }

function FormLote({
  ocupado,
  aoAdicionar,
}: {
  ocupado: boolean
  aoAdicionar: (novos: NovoPortaIsca[]) => Promise<void>
}) {
  const [area, setArea] = useState('')
  const [numeros, setNumeros] = useState('')
  const [forma, setForma] = useState('PIE')
  const [tipo, setTipo] = useState('IP')
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    setErro(null)
    const { numeros: lista, invalidos } = lerFaixas(numeros)
    if (!area.trim()) return setErro('Informe a área.')
    if (invalidos.length) return setErro(`Não entendi: ${invalidos.join(', ')}.`)
    if (lista.length === 0) return setErro('Informe os números (ex.: 1-25).')
    await aoAdicionar(
      lista.map((numero) => ({ numero, area: area.trim(), forma_iscagem: forma, tipo_isca: tipo })),
    )
    setNumeros('')
  }

  return (
    <div className="grid gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[1fr_7rem_9rem_9rem_auto] sm:items-end">
      {erro && (
        <div className="sm:col-span-5">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      <Campo rotulo="Área" htmlFor="lote-area">
        <Input id="lote-area" value={area} onChange={(e) => setArea(e.target.value)} />
      </Campo>
      <Campo rotulo="Números" htmlFor="lote-numeros" dica="Ex.: 1-25">
        <Input id="lote-numeros" value={numeros} onChange={(e) => setNumeros(e.target.value)} />
      </Campo>
      <Campo rotulo="Iscagem" htmlFor="lote-forma">
        <Select id="lote-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
          {Object.entries(FORMAS_ISCAGEM).map(([codigo, nome]) => (
            <option key={codigo} value={codigo}>
              {codigo} · {nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Tipo de isca" htmlFor="lote-tipo">
        <Select id="lote-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(TIPOS_ISCA).map(([codigo, nome]) => (
            <option key={codigo} value={codigo}>
              {codigo} · {nome}
            </option>
          ))}
        </Select>
      </Campo>
      <Button onClick={() => void adicionar()} disabled={ocupado}>
        Adicionar
      </Button>
    </div>
  )
}

function FormRemover({
  pontos,
  ocupado,
  aoRemover,
}: {
  pontos: PontoControle[]
  ocupado: boolean
  aoRemover: (p: PontoControle) => Promise<void>
}) {
  const [numero, setNumero] = useState('')
  if (pontos.length === 0) return null
  const alvo = pontos.find((p) => p.numero === Number(numero))
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Campo rotulo="Retirar o porta-isca nº" htmlFor="remover-numero">
        <Input
          id="remover-numero"
          inputMode="numeric"
          className="w-28"
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
        />
      </Campo>
      <Button
        variante="fantasma"
        disabled={!alvo || ocupado}
        onClick={() => {
          if (alvo && window.confirm(`Retirar o porta-isca ${alvo.numero} (${alvo.area})?`)) {
            void aoRemover(alvo).then(() => setNumero(''))
          }
        }}
      >
        Retirar
      </Button>
    </div>
  )
}

function FormArmadilha({
  proximoNumero,
  ocupado,
  aoAdicionar,
}: {
  proximoNumero: number
  ocupado: boolean
  aoAdicionar: (nova: { numero: number; area: string; modelo_armadilha: string }) => Promise<void>
}) {
  const [area, setArea] = useState('')
  const [modelo, setModelo] = useState('P')
  return (
    <div className="grid gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <Campo rotulo={`Localização da armadilha ${proximoNumero}`} htmlFor="arm-area">
        <Input id="arm-area" value={area} onChange={(e) => setArea(e.target.value)} />
      </Campo>
      <Campo rotulo="Modelo" htmlFor="arm-modelo">
        <Select id="arm-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)}>
          <option value="P">P · Branca</option>
          <option value="G">G · Inox</option>
        </Select>
      </Campo>
      <Button
        disabled={!area.trim() || ocupado}
        onClick={() =>
          void aoAdicionar({
            numero: proximoNumero,
            area: area.trim(),
            modelo_armadilha: modelo,
          }).then(() => setArea(''))
        }
      >
        Adicionar
      </Button>
    </div>
  )
}
