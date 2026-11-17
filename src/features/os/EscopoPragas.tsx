import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import type { TablesUpdate } from '@/lib/database.types'
import { mensagemDeErro } from '@/lib/erros'

import {
  usePontosModelo,
  useSalvarEscopo,
  useSalvarPontos,
  type AlvoEscopo,
  type PontoControle,
} from './pragasApi'
import {
  escreverFaixas,
  FORMAS_ISCAGEM,
  lerFaixas,
  nomeModeloArmadilha,
  PRAGAS_ALVO,
  TIPOS_ISCA,
  type EscopoPragas as Escopo,
} from './tipos/pragas'

/**
 * Escopo do controle de pragas (escritório): pragas alvo, áreas de insetos e os
 * pontos de controle do local. Os pontos ficam no modelo e valem para as próximas
 * visitas; enquanto a OS não começou, ela é atualizada junto.
 */
export function EscopoPragas({ alvo }: { alvo: AlvoEscopo }) {
  const { modeloId, antesDeComecar } = alvo
  const pontos = usePontosModelo(modeloId)
  const salvarPontos = useSalvarPontos(alvo.osId, antesDeComecar)
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

  const portaIscas = pontos.data?.filter((p) => p.tipo === 'porta_isca' && p.ativo) ?? []
  const armadilhas = pontos.data?.filter((p) => p.tipo === 'armadilha_luminosa' && p.ativo) ?? []
  const proximo = (tipo: string) =>
    Math.max(0, ...(pontos.data ?? []).filter((p) => p.tipo === tipo).map((p) => p.numero)) + 1
  const inativos = pontos.data?.filter((p) => !p.ativo) ?? []

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-titulo text-lg font-bold text-verde-escuro">
        Escopo do controle de pragas
      </h2>
      {alvo.osId && !antesDeComecar && (
        <Aviso tipo="info">
          A execução já começou: mudanças nos pontos valem a partir da próxima visita.
        </Aviso>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {sucesso && <Aviso tipo="sucesso">{sucesso}</Aviso>}

      <FormEscopo key={alvo.osId ?? modeloId} alvo={alvo} aoSalvar={executar} />

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <h3 className="font-semibold text-verde-escuro">Porta-iscas ({portaIscas.length})</h3>
        {pontos.isPending && <Carregando />}
        <ResumoPorArea pontos={portaIscas} />
        <FormLote
          pontos={portaIscas}
          ocupado={salvarPontos.isPending}
          aoAdicionar={(novos) =>
            executar(
              () =>
                salvarPontos.mutateAsync({
                  novos: novos.map((n) => ({ ...n, modelo_id: modeloId, tipo: 'porta_isca' })),
                }),
              `${novos.length} porta-isca(s) cadastrado(s).`,
            )
          }
        />
        <FormEditar
          pontos={portaIscas}
          ocupado={salvarPontos.isPending}
          aoSalvar={(ids, dados) =>
            executar(
              () => salvarPontos.mutateAsync({ alterar: { id: ids, dados } }),
              ids.length === 1
                ? 'Porta-isca alterado. Vale para as próximas O.S deste local.'
                : `${ids.length} porta-iscas alterados. Vale para as próximas O.S deste local.`,
            )
          }
        />
        <FormRemover
          pontos={portaIscas}
          ocupado={salvarPontos.isPending}
          aoRemover={(p) =>
            executar(
              () => salvarPontos.mutateAsync({ alterar: { id: p.id, dados: { ativo: false } } }),
              `Porta-isca ${p.numero} (${p.area}) retirado. O histórico dele continua guardado.`,
            )
          }
        />
      </section>

      <section className="flex flex-col gap-2 border-t border-borda pt-3">
        <h3 className="font-semibold text-verde-escuro">
          Armadilhas luminosas ({armadilhas.length})
        </h3>
        <p className="text-sm text-texto-suave">
          A data da última troca de lâmpada e a observação ficam na armadilha e saem em toda O.S
          deste local. A data se atualiza sozinha quando o técnico conclui uma O.S com lâmpada
          trocada.
        </p>
        <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
          {armadilhas.map((a) => (
            <ArmadilhaItem
              key={a.id}
              armadilha={a}
              ocupado={salvarPontos.isPending}
              aoAlterar={(dados, mensagem) =>
                executar(() => salvarPontos.mutateAsync({ alterar: { id: a.id, dados } }), mensagem)
              }
            />
          ))}
        </ul>
        <FormArmadilha
          proximoNumero={
            Math.max(
              0,
              ...(pontos.data ?? [])
                .filter((p) => p.tipo === 'armadilha_luminosa')
                .map((a) => a.numero),
            ) + 1
          }
          ocupado={salvarPontos.isPending}
          aoAdicionar={(novas) =>
            executar(
              () =>
                salvarPontos.mutateAsync({
                  novos: novas.map((n) => ({
                    ...n,
                    modelo_id: modeloId,
                    tipo: 'armadilha_luminosa',
                  })),
                }),
              novas.length === 1
                ? `Armadilha ${novas[0].numero} cadastrada.`
                : `${novas.length} armadilhas cadastradas.`,
            )
          }
        />
      </section>

      <SecaoMonitoramento
        titulo="Armadilhas adesivas com feromônio"
        explicacao="Localização e a data da última troca. Quando o técnico conclui uma O.S com a armadilha trocada (T), a data se atualiza sozinha."
        comData
        pontos={(pontos.data ?? []).filter((p) => p.tipo === 'feromonio' && p.ativo)}
        proximoNumero={proximo('feromonio')}
        ocupado={salvarPontos.isPending}
        aoAdicionar={(novos) =>
          executar(
            () =>
              salvarPontos.mutateAsync({
                novos: novos.map((n) => ({ ...n, modelo_id: modeloId, tipo: 'feromonio' })),
              }),
            `${novos.length} armadilha(s) de feromônio cadastrada(s).`,
          )
        }
        aoAlterar={(id, dados, mensagem) =>
          executar(() => salvarPontos.mutateAsync({ alterar: { id, dados } }), mensagem)
        }
      />

      <SecaoMonitoramento
        titulo="Armadilhas biológicas para captura de moscas"
        pontos={(pontos.data ?? []).filter((p) => p.tipo === 'armadilha_moscas' && p.ativo)}
        proximoNumero={proximo('armadilha_moscas')}
        ocupado={salvarPontos.isPending}
        aoAdicionar={(novos) =>
          executar(
            () =>
              salvarPontos.mutateAsync({
                novos: novos.map((n) => ({ ...n, modelo_id: modeloId, tipo: 'armadilha_moscas' })),
              }),
            `${novos.length} armadilha(s) de moscas cadastrada(s).`,
          )
        }
        aoAlterar={(id, dados, mensagem) =>
          executar(() => salvarPontos.mutateAsync({ alterar: { id, dados } }), mensagem)
        }
      />

      {inativos.length > 0 && (
        <p className="text-sm text-texto-suave">
          Retirados (guardados no histórico): {inativos.map((p) => p.numero).join(', ')}
        </p>
      )}
    </Card>
  )
}

function FormEscopo({
  alvo,
  aoSalvar,
}: {
  alvo: AlvoEscopo
  aoSalvar: (acao: () => Promise<unknown>, mensagem: string) => Promise<void>
}) {
  const salvar = useSalvarEscopo(alvo.osId, alvo.modeloId)
  const inicial = (alvo.escopo ?? {}) as Escopo
  const [escopo, setEscopo] = useState<Escopo>({
    ...inicial,
    subtipo: inicial.subtipo ?? 'roedores',
    pragas_alvo: inicial.pragas_alvo ?? [],
    areas_insetos: inicial.areas_insetos ?? '',
  })

  const [locaisTexto, setLocaisTexto] = useState((escopo.locais_planilha ?? []).join(', '))
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
      {escopo.subtipo === 'insetos_roedores' && (
        <Campo
          rotulo="Pragas combatidas (insetos)"
          htmlFor="esc-pragas-insetos"
          dica='Ex.: "Baratas (B), Formigas (F), Moscas (M)".'
        >
          <Input
            id="esc-pragas-insetos"
            value={escopo.pragas_insetos ?? ''}
            onChange={(e) => setEscopo({ ...escopo, pragas_insetos: e.target.value })}
          />
        </Campo>
      )}
      <Campo
        rotulo="Objetivo do monitoramento com feromônio"
        htmlFor="esc-objetivo-feromonio"
        dica="Aparece para o técnico e no PDF (só quando há armadilhas de feromônio)."
      >
        <Textarea
          id="esc-objetivo-feromonio"
          rows={2}
          value={escopo.objetivo_feromonio ?? ''}
          onChange={(e) => setEscopo({ ...escopo, objetivo_feromonio: e.target.value })}
        />
      </Campo>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          className="size-5 accent-verde"
          checked={escopo.planilha_ocorrencias ?? false}
          onChange={(e) => setEscopo({ ...escopo, planilha_ocorrencias: e.target.checked })}
        />
        Planilha de ocorrências com pragas (vivos e mortos por tipo)
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          className="size-5 accent-verde"
          checked={escopo.envelope ?? false}
          onChange={(e) => setEscopo({ ...escopo, envelope: e.target.checked })}
        />
        Perguntar se foi entregue envelope ao cliente
      </label>
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
      <Campo
        rotulo="Locais com planilha de ocorrência de pragas"
        htmlFor="esc-planilha"
        dica='Separe por vírgula. Ex.: "Cozinha, Recepção". O técnico dá o visto em cada um.'
      >
        <Input
          id="esc-planilha"
          value={locaisTexto}
          onChange={(e) => {
            setLocaisTexto(e.target.value)
            setEscopo({
              ...escopo,
              locais_planilha: e.target.value
                .split(',')
                .map((l) => l.trim())
                .filter(Boolean),
            })
          }}
        />
      </Campo>
      <Button
        variante="secundario"
        disabled={salvar.isPending}
        onClick={() =>
          void aoSalvar(
            () => salvar.mutateAsync({ ...((alvo.escopo ?? {}) as object), ...escopo } as Escopo),
            'Escopo salvo neste local.',
          )
        }
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

const mesmaArea = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Áreas já cadastradas, sem repetir (a primeira grafia vale). */
function areasDe(pontos: PontoControle[]) {
  const areas: string[] = []
  for (const p of pontos) if (!areas.some((a) => mesmaArea(a, p.area))) areas.push(p.area)
  return areas
}

const NOVA_AREA = '__nova__'

/**
 * Escolhe uma área já cadastrada ou cria uma nova. A numeração pode recomeçar
 * em cada área (Cozinha 1-5, Saguão 1-10).
 */
function CampoArea({
  id,
  rotulo = 'Área',
  areas,
  valor,
  aoMudar,
  podeCriar,
  opcaoTodas,
}: {
  id: string
  rotulo?: string
  areas: string[]
  valor: string
  aoMudar: (area: string) => void
  podeCriar?: boolean
  opcaoTodas?: string
}) {
  const [criando, setCriando] = useState(false)
  if (podeCriar && (criando || areas.length === 0)) {
    return (
      <Campo rotulo={`${rotulo} (nova)`} htmlFor={id}>
        <div className="flex gap-1">
          <Input
            id={id}
            autoFocus={areas.length > 0}
            placeholder="Ex.: Cozinha"
            value={valor}
            onChange={(e) => aoMudar(e.target.value)}
          />
          {areas.length > 0 && (
            <Button
              variante="fantasma"
              title="Escolher uma área já cadastrada"
              onClick={() => {
                setCriando(false)
                aoMudar('')
              }}
            >
              Lista
            </Button>
          )}
        </div>
      </Campo>
    )
  }
  return (
    <Campo rotulo={rotulo} htmlFor={id}>
      <Select
        id={id}
        value={valor}
        onChange={(e) => {
          if (e.target.value === NOVA_AREA) {
            setCriando(true)
            aoMudar('')
          } else aoMudar(e.target.value)
        }}
      >
        <option value="">{opcaoTodas ?? 'Escolha a área'}</option>
        {areas.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
        {podeCriar && <option value={NOVA_AREA}>+ Nova área…</option>}
      </Select>
    </Campo>
  )
}

function FormLote({
  pontos,
  ocupado,
  aoAdicionar,
}: {
  pontos: PontoControle[]
  ocupado: boolean
  aoAdicionar: (novos: NovoPortaIsca[]) => Promise<void>
}) {
  const areas = areasDe(pontos)
  const [area, setArea] = useState('')
  const [numeros, setNumeros] = useState('')
  const [forma, setForma] = useState('PIE')
  const [tipo, setTipo] = useState('IP')
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    setErro(null)
    const { numeros: lista, invalidos } = lerFaixas(numeros)
    if (!area.trim()) return setErro('Escolha ou crie a área.')
    if (invalidos.length) return setErro(`Não entendi: ${invalidos.join(', ')}.`)
    if (lista.length === 0) return setErro('Informe os números (ex.: 1-25).')
    const repetidos = lista.filter((n) =>
      pontos.some((p) => p.numero === n && mesmaArea(p.area, area)),
    )
    if (repetidos.length)
      return setErro(`Já existe em ${area.trim()}: ${escreverFaixas(repetidos)}.`)
    await aoAdicionar(
      lista.map((numero) => ({ numero, area: area.trim(), forma_iscagem: forma, tipo_isca: tipo })),
    )
    setNumeros('')
  }

  return (
    <div className="grid gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[minmax(12rem,1fr)_7rem_9rem_9rem_auto]">
      {erro && (
        <div className="col-span-full">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      <CampoArea id="lote-area" areas={areas} valor={area} aoMudar={setArea} podeCriar />
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

/**
 * Acha os porta-iscas pelos números dentro da área escolhida. Sem área, só
 * funciona se o número não se repetir em outra área.
 */
function acharPorNumero(pontos: PontoControle[], area: string, lista: number[]) {
  const daArea = area ? pontos.filter((p) => mesmaArea(p.area, area)) : pontos
  const escolhidos: PontoControle[] = []
  const faltando: number[] = []
  const ambiguos: number[] = []
  for (const n of lista) {
    const achados = daArea.filter((p) => p.numero === n)
    if (achados.length === 0) faltando.push(n)
    else if (achados.length > 1) ambiguos.push(n)
    else escolhidos.push(achados[0])
  }
  return { escolhidos, faltando, ambiguos }
}

/**
 * Muda a área (nome), a iscagem ou o tipo de isca de um porta-isca ou de vários
 * ("1-10"). Fica gravado no local e vale para as próximas O.S.
 */
function FormEditar({
  pontos,
  ocupado,
  aoSalvar,
}: {
  pontos: PontoControle[]
  ocupado: boolean
  aoSalvar: (ids: string[], dados: TablesUpdate<'pontos_controle'>) => Promise<void>
}) {
  const areas = areasDe(pontos)
  const [areaAtual, setAreaAtual] = useState('')
  const [numeros, setNumeros] = useState('')
  const [area, setArea] = useState('')
  const [forma, setForma] = useState('')
  const [tipo, setTipo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  if (pontos.length === 0) return null

  const { numeros: lista, invalidos } = lerFaixas(numeros)
  const { escolhidos, faltando, ambiguos } = acharPorNumero(pontos, areaAtual, lista)

  function escolher(texto: string, daArea = areaAtual) {
    setNumeros(texto)
    setErro(null)
    // Com um número só, já mostra o que ele tem hoje para facilitar a correção.
    const um = lerFaixas(texto).numeros
    const achado = um.length === 1 ? acharPorNumero(pontos, daArea, um).escolhidos[0] : undefined
    if (achado) {
      setArea(achado.area)
      setForma(achado.forma_iscagem ?? '')
      setTipo(achado.tipo_isca ?? '')
    }
  }

  async function salvar() {
    setErro(null)
    if (invalidos.length) return setErro(`Não entendi: ${invalidos.join(', ')}.`)
    if (lista.length === 0) return setErro('Informe o número do porta-isca (ex.: 5 ou 1-10).')
    if (ambiguos.length)
      return setErro(
        `O número ${ambiguos.join(', ')} existe em mais de uma área: escolha a área primeiro.`,
      )
    if (faltando.length)
      return setErro(
        `Não há porta-isca com o número ${faltando.join(', ')}${areaAtual ? ` em ${areaAtual}` : ''}.`,
      )
    const dados: TablesUpdate<'pontos_controle'> = {}
    if (area.trim()) dados.area = area.trim()
    if (forma) dados.forma_iscagem = forma
    if (tipo) dados.tipo_isca = tipo
    if (Object.keys(dados).length === 0) return setErro('Informe o que vai mudar.')
    await aoSalvar(
      escolhidos.map((p) => p.id),
      dados,
    )
    setNumeros('')
    setArea('')
    setForma('')
    setTipo('')
  }

  return (
    <details className="rounded-xl bg-fundo-suave p-3">
      <summary className="cursor-pointer font-semibold">
        Alterar porta-isca (nome da área, isca)
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 sm:items-end xl:grid-cols-[11rem_6rem_1fr_9rem_9rem_auto]">
        {erro && (
          <div className="col-span-full">
            <Aviso tipo="erro">{erro}</Aviso>
          </div>
        )}
        <CampoArea
          id="editar-area-atual"
          areas={areas}
          valor={areaAtual}
          opcaoTodas="Todas as áreas"
          aoMudar={(a) => {
            setAreaAtual(a)
            escolher(numeros, a)
          }}
        />
        <Campo rotulo="Números" htmlFor="editar-numeros" dica="Ex.: 5 ou 1-10">
          <Input id="editar-numeros" value={numeros} onChange={(e) => escolher(e.target.value)} />
        </Campo>
        <Campo rotulo="Novo nome da área" htmlFor="editar-area">
          <Input id="editar-area" value={area} onChange={(e) => setArea(e.target.value)} />
        </Campo>
        <Campo rotulo="Iscagem" htmlFor="editar-forma">
          <Select id="editar-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
            <option value="">Manter</option>
            {Object.entries(FORMAS_ISCAGEM).map(([codigo, nome]) => (
              <option key={codigo} value={codigo}>
                {codigo} · {nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Tipo de isca" htmlFor="editar-tipo">
          <Select id="editar-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Manter</option>
            {Object.entries(TIPOS_ISCA).map(([codigo, nome]) => (
              <option key={codigo} value={codigo}>
                {codigo} · {nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Button onClick={() => void salvar()} disabled={ocupado}>
          Salvar
        </Button>
      </div>
    </details>
  )
}

/** Retira um porta-isca: primeiro a área, depois o número (a numeração pode repetir). */
function FormRemover({
  pontos,
  ocupado,
  aoRemover,
}: {
  pontos: PontoControle[]
  ocupado: boolean
  aoRemover: (p: PontoControle) => Promise<void>
}) {
  const areas = areasDe(pontos)
  const [escolhida, setEscolhida] = useState('')
  const [numero, setNumero] = useState('')
  if (pontos.length === 0) return null
  // Com uma área só, ela já vem escolhida.
  const area = escolhida || (areas.length === 1 ? areas[0] : '')
  const alvo = area
    ? pontos.find((p) => mesmaArea(p.area, area) && p.numero === Number(numero))
    : undefined
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-52">
        <CampoArea id="remover-area" areas={areas} valor={area} aoMudar={setEscolhida} />
      </div>
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
      {area && numero && !alvo && (
        <p className="w-full text-sm text-perigo">
          Não há porta-isca {numero} em {area}.
        </p>
      )}
    </div>
  )
}

type NovaArmadilha = { numero: number; area: string; modelo_armadilha: string }

/**
 * Uma armadilha ou várias de uma vez com a mesma localização ("3-33" na
 * "Granja"). Sem número, usa o próximo livre.
 */
function FormArmadilha({
  proximoNumero,
  ocupado,
  aoAdicionar,
}: {
  proximoNumero: number
  ocupado: boolean
  aoAdicionar: (novas: NovaArmadilha[]) => Promise<void>
}) {
  const [area, setArea] = useState('')
  const [numeros, setNumeros] = useState('')
  const [modelo, setModelo] = useState('P')
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    setErro(null)
    if (!area.trim()) return setErro('Informe a localização.')
    const { numeros: lista, invalidos } = numeros.trim()
      ? lerFaixas(numeros)
      : { numeros: [proximoNumero], invalidos: [] }
    if (invalidos.length) return setErro(`Não entendi: ${invalidos.join(', ')}.`)
    if (lista.length === 0) return setErro('Informe os números (ex.: 3-33).')
    await aoAdicionar(
      lista.map((numero) => ({ numero, area: area.trim(), modelo_armadilha: modelo })),
    )
    setNumeros('')
  }

  return (
    <div className="grid gap-2 rounded-xl bg-fundo-suave p-3 sm:grid-cols-[1fr_7rem_10rem_auto] sm:items-end">
      {erro && (
        <div className="sm:col-span-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      <Campo rotulo="Localização" htmlFor="arm-area">
        <Input id="arm-area" value={area} onChange={(e) => setArea(e.target.value)} />
      </Campo>
      <Campo rotulo="Números" htmlFor="arm-numeros" dica="Ex.: 3-33">
        <Input
          id="arm-numeros"
          value={numeros}
          placeholder={String(proximoNumero)}
          onChange={(e) => setNumeros(e.target.value)}
        />
      </Campo>
      <Campo rotulo="Modelo" htmlFor="arm-modelo">
        <Select id="arm-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)}>
          <option value="P">P · Branca</option>
          <option value="M">M</option>
          <option value="G">G · Inox</option>
        </Select>
      </Campo>
      <Button disabled={ocupado} onClick={() => void adicionar()}>
        Adicionar
      </Button>
    </div>
  )
}

/** Uma armadilha: local, data da última troca de lâmpada e observação fixas. */
function ArmadilhaItem({
  armadilha: a,
  ocupado,
  aoAlterar,
}: {
  armadilha: PontoControle
  ocupado: boolean
  aoAlterar: (dados: TablesUpdate<'pontos_controle'>, mensagem: string) => Promise<void>
}) {
  const [troca, setTroca] = useState(a.ultima_troca_lampada ?? '')
  const [obs, setObs] = useState(a.observacao_fixa ?? '')
  const mudou = troca !== (a.ultima_troca_lampada ?? '') || obs.trim() !== (a.observacao_fixa ?? '')
  const id = `arm-${a.id}`

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-borda p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-semibold">
          {String(a.numero).padStart(2, '0')} · {a.area} · {nomeModeloArmadilha(a.modelo_armadilha)}
        </span>
        <Button
          variante="fantasma"
          disabled={ocupado}
          onClick={() => {
            const area = window.prompt(`Novo local da armadilha ${a.numero}:`, a.area)?.trim()
            if (area && area !== a.area) {
              void aoAlterar(
                { area },
                `Armadilha ${a.numero} alterada. Vale para as próximas O.S deste local.`,
              )
            }
          }}
        >
          Editar local
        </Button>
        <Button
          variante="fantasma"
          disabled={ocupado}
          onClick={() => void aoAlterar({ ativo: false }, `Armadilha ${a.numero} retirada.`)}
        >
          Retirar
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[11rem_1fr_auto] sm:items-end">
        <Campo rotulo="Última troca de lâmpada" htmlFor={`${id}-troca`}>
          <Input
            id={`${id}-troca`}
            type="date"
            value={troca}
            onChange={(e) => setTroca(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Observação fixa" htmlFor={`${id}-obs`}>
          <Input
            id={`${id}-obs`}
            maxLength={500}
            placeholder="Ex.: fica atrás da porta da câmara fria"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </Campo>
        {mudou && (
          <Button
            variante="secundario"
            disabled={ocupado}
            onClick={() =>
              void aoAlterar(
                { ultima_troca_lampada: troca || null, observacao_fixa: obs.trim() || null },
                `Armadilha ${a.numero} salva. Vale para as próximas O.S deste local.`,
              )
            }
          >
            Salvar
          </Button>
        )}
      </div>
    </li>
  )
}

type NovoMonitoramento = { numero: number; area: string; ultima_troca_lampada?: string | null }

/**
 * Feromônio e armadilhas de moscas: lista com local (e a última troca, no
 * feromônio), retirar, e o cadastro de um ou vários de uma vez.
 */
function SecaoMonitoramento({
  titulo,
  explicacao,
  comData,
  pontos,
  proximoNumero,
  ocupado,
  aoAdicionar,
  aoAlterar,
}: {
  titulo: string
  explicacao?: string
  comData?: boolean
  pontos: PontoControle[]
  proximoNumero: number
  ocupado: boolean
  aoAdicionar: (novos: NovoMonitoramento[]) => Promise<void>
  aoAlterar: (id: string, dados: TablesUpdate<'pontos_controle'>, mensagem: string) => Promise<void>
}) {
  const [area, setArea] = useState('')
  const [numeros, setNumeros] = useState('')
  const [troca, setTroca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const ordenados = [...pontos].sort((a, b) => a.numero - b.numero)

  async function adicionar() {
    setErro(null)
    if (!area.trim()) return setErro('Informe a localização.')
    const { numeros: lista, invalidos } = numeros.trim()
      ? lerFaixas(numeros)
      : { numeros: [proximoNumero], invalidos: [] }
    if (invalidos.length) return setErro(`Não entendi: ${invalidos.join(', ')}.`)
    await aoAdicionar(
      lista.map((numero) => ({
        numero,
        area: area.trim(),
        ...(comData ? { ultima_troca_lampada: troca || null } : {}),
      })),
    )
    setNumeros('')
    setArea('')
  }

  return (
    <section className="flex flex-col gap-2 border-t border-borda pt-3">
      <h3 className="font-semibold text-verde-escuro">
        {titulo} ({pontos.length})
      </h3>
      {explicacao && <p className="text-sm text-texto-suave">{explicacao}</p>}
      <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
        {ordenados.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2">
            <span className="flex-1">
              <strong>{String(p.numero).padStart(2, '0')}</strong> · {p.area}
            </span>
            {comData && (
              <Input
                type="date"
                aria-label={`Última troca da ${p.numero}`}
                className="w-auto"
                defaultValue={p.ultima_troca_lampada ?? ''}
                disabled={ocupado}
                onBlur={(e) => {
                  if (e.target.value !== (p.ultima_troca_lampada ?? ''))
                    void aoAlterar(
                      p.id,
                      { ultima_troca_lampada: e.target.value || null },
                      `Última troca da ${p.numero} salva.`,
                    )
                }}
              />
            )}
            <Button
              variante="fantasma"
              disabled={ocupado}
              onClick={() => {
                const nova = window.prompt(`Novo local da ${p.numero}:`, p.area)?.trim()
                if (nova && nova !== p.area)
                  void aoAlterar(p.id, { area: nova }, `${p.numero} alterada.`)
              }}
            >
              Editar local
            </Button>
            <Button
              variante="fantasma"
              disabled={ocupado}
              onClick={() => void aoAlterar(p.id, { ativo: false }, `${p.numero} retirada.`)}
            >
              Retirar
            </Button>
          </li>
        ))}
      </ul>
      <div
        className={`grid gap-2 rounded-xl bg-fundo-suave p-3 sm:items-end ${comData ? 'sm:grid-cols-[1fr_7rem_10rem_auto]' : 'sm:grid-cols-[1fr_7rem_auto]'}`}
      >
        {erro && (
          <div className="sm:col-span-4">
            <Aviso tipo="erro">{erro}</Aviso>
          </div>
        )}
        <Campo rotulo="Localização" htmlFor={`mon-area-${titulo}`}>
          <Input id={`mon-area-${titulo}`} value={area} onChange={(e) => setArea(e.target.value)} />
        </Campo>
        <Campo rotulo="Números" htmlFor={`mon-num-${titulo}`} dica="Ex.: 1-3">
          <Input
            id={`mon-num-${titulo}`}
            placeholder={String(proximoNumero)}
            value={numeros}
            onChange={(e) => setNumeros(e.target.value)}
          />
        </Campo>
        {comData && (
          <Campo rotulo="Última troca" htmlFor={`mon-troca-${titulo}`}>
            <Input
              id={`mon-troca-${titulo}`}
              type="date"
              value={troca}
              onChange={(e) => setTroca(e.target.value)}
            />
          </Campo>
        )}
        <Button disabled={ocupado} onClick={() => void adicionar()}>
          Adicionar
        </Button>
      </div>
    </section>
  )
}
