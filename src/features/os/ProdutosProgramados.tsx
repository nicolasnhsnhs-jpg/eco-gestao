import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import type { Json } from '@/lib/database.types'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { BotoesCodigo } from './operador/ExecucaoPragas'
import { useSalvarEscopo, type AlvoEscopo } from './pragasApi'
import { CONDICOES, NIVEIS, type Nivel } from './tipos/pragas'
import {
  chaveDose,
  escreverDoses,
  lerDose,
  type ChecklistProgramas,
  type EscopoProgramas,
  type MarcacaoPrograma,
  type ProdutoProgramado,
  type ProgramaAplicacao,
} from './tipos/programas'

const novoId = () => crypto.randomUUID().slice(0, 8)

/**
 * Escritório: as aplicações programadas do local (ex.: "Profilaxia e higiene —
 * controle de insetos em grãos"), cada uma com as áreas e os produtos com as
 * dosagens possíveis. O técnico só marca a dosagem usada.
 */
export function EscopoProdutosProgramados({ alvo }: { alvo: AlvoEscopo }) {
  const salvar = useSalvarEscopo(alvo.osId, alvo.modeloId)
  const [programas, setProgramas] = useState<ProgramaAplicacao[]>(
    ((alvo.escopo ?? {}) as EscopoProgramas).programas ?? [],
  )
  // As doses são editadas como texto (uma por linha); guardadas por produto.
  const [dosesTexto, setDosesTexto] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      programas.flatMap((g) => g.produtos.map((p) => [p.id, escreverDoses(p.doses)])),
    ),
  )
  const [aviso, setAviso] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  const mudarPrograma = (id: string, dados: Partial<ProgramaAplicacao>) =>
    setProgramas((lista) => lista.map((g) => (g.id === id ? { ...g, ...dados } : g)))
  const mudarProduto = (gid: string, pid: string, dados: Partial<ProdutoProgramado>) =>
    setProgramas((lista) =>
      lista.map((g) =>
        g.id === gid
          ? { ...g, produtos: g.produtos.map((p) => (p.id === pid ? { ...p, ...dados } : p)) }
          : g,
      ),
    )

  function gravar() {
    setAviso(null)
    const limpos = programas.map((g) => ({
      ...g,
      titulo: g.titulo.trim(),
      areas: g.areas?.trim() || undefined,
      produtos: g.produtos
        .map((p) => ({
          ...p,
          nome_comercial: p.nome_comercial.trim(),
          principio_ativo: p.principio_ativo.trim(),
          doses: (dosesTexto[p.id] ?? '')
            .split('\n')
            .map(lerDose)
            .filter((d) => d !== null),
        }))
        .filter((p) => p.nome_comercial),
    }))
    if (limpos.some((g) => !g.titulo)) {
      setAviso({ tipo: 'erro', texto: 'Dê um título para cada aplicação.' })
      return
    }
    salvar
      .mutateAsync({ ...((alvo.escopo ?? {}) as object), programas: limpos } as Json)
      .then(() => {
        setProgramas(limpos)
        setAviso({ tipo: 'sucesso', texto: 'Produtos programados salvos neste local.' })
      })
      .catch((e: unknown) => setAviso({ tipo: 'erro', texto: mensagemDeErro(e) }))
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">Produtos programados</h2>
      <p className="text-sm text-texto-suave">
        Aplicações que já saem prontas na O.S, com as dosagens. O técnico marca (X) a que usou. As
        dosagens vão uma por linha: <strong>100ml = 10lts</strong>, e o alvo entre parênteses se
        mudar por dosagem: <strong>33ml = 10lts (mosquitos)</strong>.
      </p>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {programas.map((g) => (
        <section key={g.id} className="flex flex-col gap-2 rounded-xl border border-borda p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Campo rotulo="Aplicação" htmlFor={`prog-${g.id}`}>
              <Input
                id={`prog-${g.id}`}
                placeholder="Ex.: Profilaxia e higiene — controle de insetos em grãos (mensal)"
                value={g.titulo}
                onChange={(e) => mudarPrograma(g.id, { titulo: e.target.value })}
              />
            </Campo>
            <Button
              variante="fantasma"
              onClick={() => setProgramas((lista) => lista.filter((x) => x.id !== g.id))}
            >
              <Trash2 className="size-4" aria-hidden /> Tirar
            </Button>
          </div>
          <Campo rotulo="Áreas do cliente" htmlFor={`prog-areas-${g.id}`}>
            <Input
              id={`prog-areas-${g.id}`}
              value={g.areas ?? ''}
              onChange={(e) => mudarPrograma(g.id, { areas: e.target.value })}
            />
          </Campo>
          {g.produtos.map((p) => (
            <div key={p.id} className="grid gap-2 rounded-lg bg-fundo-suave p-2 sm:grid-cols-2">
              <Campo rotulo="Nome comercial" htmlFor={`pp-nome-${p.id}`}>
                <Input
                  id={`pp-nome-${p.id}`}
                  value={p.nome_comercial}
                  onChange={(e) => mudarProduto(g.id, p.id, { nome_comercial: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Princípio ativo" htmlFor={`pp-pa-${p.id}`}>
                <Input
                  id={`pp-pa-${p.id}`}
                  value={p.principio_ativo}
                  onChange={(e) => mudarProduto(g.id, p.id, { principio_ativo: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Diluente" htmlFor={`pp-dil-${p.id}`}>
                <Input
                  id={`pp-dil-${p.id}`}
                  placeholder="H²O, Óleo, Pronto uso"
                  value={p.diluente ?? ''}
                  onChange={(e) => mudarProduto(g.id, p.id, { diluente: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Procedimento" htmlFor={`pp-proc-${p.id}`}>
                <Input
                  id={`pp-proc-${p.id}`}
                  placeholder="(Atom.) / (Pulv.)"
                  value={p.procedimento ?? ''}
                  onChange={(e) => mudarProduto(g.id, p.id, { procedimento: e.target.value })}
                />
              </Campo>
              <Campo rotulo="Dosagens (QNT = calda)" htmlFor={`pp-doses-${p.id}`}>
                <Textarea
                  id={`pp-doses-${p.id}`}
                  rows={4}
                  value={dosesTexto[p.id] ?? ''}
                  onChange={(e) => setDosesTexto((d) => ({ ...d, [p.id]: e.target.value }))}
                />
              </Campo>
              <div className="flex flex-col gap-2">
                <Campo rotulo="Alvos combatidos" htmlFor={`pp-alvos-${p.id}`}>
                  <Textarea
                    id={`pp-alvos-${p.id}`}
                    rows={2}
                    value={p.alvos ?? ''}
                    onChange={(e) => mudarProduto(g.id, p.id, { alvos: e.target.value })}
                  />
                </Campo>
                <Button
                  variante="fantasma"
                  onClick={() =>
                    mudarPrograma(g.id, { produtos: g.produtos.filter((x) => x.id !== p.id) })
                  }
                >
                  <Trash2 className="size-4" aria-hidden /> Tirar produto
                </Button>
              </div>
            </div>
          ))}
          <Button
            variante="secundario"
            onClick={() =>
              mudarPrograma(g.id, {
                produtos: [
                  ...g.produtos,
                  { id: novoId(), nome_comercial: '', principio_ativo: '', doses: [] },
                ],
              })
            }
          >
            <Plus className="size-4" aria-hidden /> Produto
          </Button>
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variante="secundario"
          onClick={() =>
            setProgramas((lista) => [...lista, { id: novoId(), titulo: '', produtos: [] }])
          }
        >
          <Plus className="size-4" aria-hidden /> Aplicação
        </Button>
        <Button disabled={salvar.isPending} onClick={gravar}>
          Salvar produtos programados
        </Button>
      </div>
    </Card>
  )
}

/** Técnico: marca (X) a dosagem usada de cada produto, o nível e as condições das áreas. */
export function MarcarProdutosProgramados({
  escopo,
  checklist,
  aberta,
  mudar,
}: {
  escopo: unknown
  checklist: ChecklistProgramas
  aberta: boolean
  mudar: (parcial: ChecklistProgramas) => void
}) {
  const programas = ((escopo ?? {}) as EscopoProgramas).programas ?? []
  if (programas.length === 0) return null
  const marcar = (gid: string, dados: MarcacaoPrograma) =>
    mudar({
      programas: { ...checklist.programas, [gid]: { ...checklist.programas?.[gid], ...dados } },
    })

  return (
    <div className="flex flex-col gap-4">
      {programas.map((g) => {
        const m = checklist.programas?.[g.id] ?? {}
        const marcadas = new Set(m.doses ?? [])
        return (
          <section key={g.id} className="flex flex-col gap-3 rounded-xl border border-borda p-3">
            <h3 className="font-semibold text-verde-escuro">{g.titulo}</h3>
            {g.areas && (
              <p className="text-sm">
                <strong>Áreas do cliente:</strong> {g.areas}
              </p>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Nível de infestação</span>
              <BotoesCodigo
                opcoes={NIVEIS}
                valor={m.nivel ?? null}
                desabilitado={!aberta}
                aoMudar={(v) => marcar(g.id, { nivel: (v ?? undefined) as Nivel | undefined })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Condições gerais das áreas</span>
              <BotoesCodigo
                opcoes={CONDICOES}
                valor={m.condicoes ?? null}
                desabilitado={!aberta}
                aoMudar={(v) => marcar(g.id, { condicoes: v ?? undefined })}
              />
            </div>
            {g.produtos.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg bg-fundo-suave p-2">
                <p>
                  <strong>{p.nome_comercial}</strong> · {p.principio_ativo}
                  {p.diluente && ` · ${p.diluente}`}
                  {p.procedimento && ` · ${p.procedimento}`}
                </p>
                <div className="flex flex-wrap gap-2" role="group">
                  {p.doses.map((d, i) => {
                    const chave = chaveDose(p.id, i)
                    const ativo = marcadas.has(chave)
                    return (
                      <button
                        key={chave}
                        type="button"
                        disabled={!aberta}
                        aria-pressed={ativo}
                        onClick={() =>
                          marcar(g.id, {
                            doses: ativo
                              ? [...marcadas].filter((x) => x !== chave)
                              : [...marcadas, chave],
                          })
                        }
                        className={cn(
                          'min-h-12 rounded-xl border-2 px-3 text-left font-bold disabled:opacity-60',
                          ativo ? 'border-verde bg-verde text-white' : 'border-borda bg-white',
                        )}
                      >
                        {ativo ? '☒ ' : '☐ '}
                        {d.qnt}
                        {d.calda && <span className="font-normal"> em {d.calda}</span>}
                        {d.alvo && <span className="block text-xs font-normal">{d.alvo}</span>}
                      </button>
                    )
                  })}
                </div>
                {p.alvos && <p className="text-xs text-texto-suave">Alvos combatidos: {p.alvos}</p>}
              </div>
            ))}
          </section>
        )
      })}
      <p className="text-xs text-texto-suave">
        Usou outro produto ou outra dosagem? Anote em “Produtos utilizados”.
      </p>
    </div>
  )
}
