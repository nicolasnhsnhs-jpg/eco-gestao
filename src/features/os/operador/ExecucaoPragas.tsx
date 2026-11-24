import { Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { cn } from '@/lib/utils'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import {
  nomeDoProduto,
  textoMl,
  useAnotarPontos,
  useCatalogoProdutos,
  useGravarInseto,
  useGravarProduto,
  useInsetos,
  usePontosOs,
  useProdutos,
  type PontoOs,
} from '../pragasApi'
import {
  CONDICOES,
  DILUENTES,
  escreverFaixas,
  ESPECIES,
  FORMAS_ISCAGEM,
  FORMAS_PRODUTO,
  HIGIENE,
  lerFaixas,
  nomeModeloArmadilha,
  numeracaoPorForma,
  NIVEIS,
  OCORRENCIAS,
  ordenarPontos,
  PRAGAS_ALVO,
  PRAGAS_INSETOS,
  PROCEDIMENTOS,
  REFIL,
  SITUACOES_ARMADILHA,
  SITUACOES_FEROMONIO,
  SITUACOES_ISCA,
  SITUACOES_PLACA,
  sugerirNivelRoedores,
  quantasEtapasPragas,
  type ChecklistPragas,
  type EscopoPragas,
  type Nivel,
  type Ocorrencia,
} from '../tipos/pragas'
import { capturasCompletas } from '../offline/pendencias'
import { MarcarProdutosProgramados } from '../ProdutosProgramados'
import type { ChecklistProgramas } from '../tipos/programas'
import { CadastroImplantacao } from './CadastroImplantacao'
import { ConferenciaPortaIscas } from './ConferenciaPortaIscas'

type Props = {
  os: OsCompleta
  campos: CamposExecucao
  alterar: (novos: CamposExecucao) => void
  aberta: boolean
  /** Número da primeira etapa (as etapas comuns vêm antes e depois). */
  primeira: number
}

/** Etapas próprias do controle de pragas na tela do operador. */
export function ExecucaoPragas({ os, campos, alterar, aberta, primeira }: Props) {
  const pontos = usePontosOs(os.id)
  const escopo = (os.escopo ?? {}) as EscopoPragas
  const checklist = (campos.checklist ?? {}) as ChecklistPragas & ChecklistProgramas
  const mudar = (parcial: ChecklistPragas & ChecklistProgramas) =>
    alterar({ checklist: { ...checklist, ...parcial } })

  const portaIscas = pontos.data?.filter((p) => p.tipo === 'porta_isca') ?? []
  const armadilhas = pontos.data?.filter((p) => p.tipo === 'armadilha_luminosa') ?? []
  const feromonios = pontos.data?.filter((p) => p.tipo === 'feromonio') ?? []
  const moscas = pontos.data?.filter((p) => p.tipo === 'armadilha_moscas') ?? []
  const temMonitoramento = feromonios.length + moscas.length > 0
  const etapaInsetos = primeira + 2 + (armadilhas.length > 0 ? 1 : 0) + (temMonitoramento ? 1 : 0)
  const sugestao = sugerirNivelRoedores(portaIscas.map((p) => p.situacao))
  const pragasAlvo = checklist.pragas_alvo ?? escopo.pragas_alvo ?? []

  return (
    <>
      <Etapa numero={primeira} titulo="Porta-iscas">
        {pontos.isPending && <Carregando />}
        {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
        {os.implantacao && pontos.isSuccess && (
          <CadastroImplantacao osId={os.id} pontos={pontos.data} aberta={aberta} />
        )}
        {portaIscas.length > 0 ? (
          <>
            <ObservacoesFixas pontos={portaIscas} />
            <ConferenciaPortaIscas osId={os.id} pontos={portaIscas} aberta={aberta} />
            <ExcecoesPortaIscas osId={os.id} pontos={portaIscas} aberta={aberta} />
          </>
        ) : (
          !os.implantacao && <p className="text-texto-suave">Nenhum porta-isca neste local.</p>
        )}

        <fieldset className="flex flex-wrap gap-x-4">
          <legend className="mb-1 font-semibold">Pragas alvo</legend>
          {PRAGAS_ALVO.map((praga) => (
            <label key={praga} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5 accent-verde"
                disabled={!aberta}
                checked={pragasAlvo.includes(praga)}
                onChange={(e) =>
                  mudar({
                    pragas_alvo: e.target.checked
                      ? [...pragasAlvo, praga]
                      : pragasAlvo.filter((p) => p !== praga),
                  })
                }
              />
              {praga}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <p className="font-semibold">
            Nível de infestação de roedores <span className="text-perigo">*</span>
          </p>
          {sugestao.nivel && (
            <p className="text-sm text-texto-suave">
              Sugestão: <strong>{NIVEIS[sugestao.nivel]}</strong> ({sugestao.percentual.toFixed(0)}%
              das iscas visitadas com consumo).
            </p>
          )}
          <BotoesCodigo
            opcoes={NIVEIS}
            valor={checklist.nivel_infestacao ?? null}
            desabilitado={!aberta}
            aoMudar={(nivel) =>
              mudar({ nivel_infestacao: (nivel ?? undefined) as Nivel | undefined })
            }
          />
        </div>

        <Campo rotulo="Porta-iscas sem acesso: quais e por quê?" htmlFor="pr-sem-acesso">
          <Textarea
            id="pr-sem-acesso"
            rows={2}
            disabled={!aberta}
            value={checklist.sem_acesso ?? ''}
            onChange={(e) => mudar({ sem_acesso: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Porta-iscas quebrados: quais e por quê?" htmlFor="pr-quebrados">
          <Textarea
            id="pr-quebrados"
            rows={2}
            disabled={!aberta}
            value={checklist.quebrados ?? ''}
            onChange={(e) => mudar({ quebrados: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Comentários" htmlFor="pr-comentarios">
          <Textarea
            id="pr-comentarios"
            rows={2}
            disabled={!aberta}
            value={checklist.comentarios_roedores ?? ''}
            onChange={(e) => mudar({ comentarios_roedores: e.target.value })}
          />
        </Campo>
      </Etapa>

      <Etapa numero={primeira + 1} titulo="Produtos utilizados">
        <MarcarProdutosProgramados
          escopo={os.escopo}
          checklist={checklist}
          aberta={aberta}
          mudar={mudar}
        />
        <Produtos osId={os.id} aberta={aberta} />
      </Etapa>

      {armadilhas.length > 0 && (
        <Etapa numero={primeira + 2} titulo="Armadilhas luminosas">
          <ObservacoesFixas pontos={armadilhas} />
          {armadilhas.map((a) => (
            <Armadilha key={a.id} osId={os.id} ponto={a} aberta={aberta} />
          ))}
        </Etapa>
      )}

      {temMonitoramento && (
        <Etapa
          numero={primeira + 2 + (armadilhas.length > 0 ? 1 : 0)}
          titulo="Feromônio e armadilhas de moscas"
        >
          {feromonios.length > 0 && (
            <>
              <h3 className="font-semibold text-verde-escuro">
                Armadilha adesiva com feromônio e atrativo alimentar
              </h3>
              {escopo.objetivo_feromonio && (
                <p className="text-sm text-texto-suave">{escopo.objetivo_feromonio}</p>
              )}
              {feromonios.map((f) => (
                <Feromonio key={f.id} osId={os.id} ponto={f} aberta={aberta} />
              ))}
            </>
          )}
          {moscas.length > 0 && (
            <>
              <h3 className="font-semibold text-verde-escuro">
                Armadilha biológica para captura de moscas
              </h3>
              {moscas.map((m) => (
                <ArmadilhaMoscas key={m.id} osId={os.id} ponto={m} aberta={aberta} />
              ))}
            </>
          )}
        </Etapa>
      )}

      {escopo.subtipo === 'insetos_roedores' && (
        <Etapa numero={etapaInsetos} titulo="Controle de insetos">
          {escopo.areas_insetos && (
            <p>
              <span className="font-semibold">Áreas do cliente:</span> {escopo.areas_insetos}
            </p>
          )}
          {escopo.pragas_insetos && (
            <p>
              <span className="font-semibold">Pragas combatidas:</span> {escopo.pragas_insetos}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <p className="font-semibold">
              Monitoramento de insetos <span className="text-perigo">*</span>
            </p>
            <BotoesCodigo
              opcoes={{
                sim: 'Realizado monitoramento programado nas áreas',
                nao: 'Realizado monitoramento, sem necessidade de aplicação',
              }}
              valor={
                checklist.monitoramento_insetos == null
                  ? null
                  : checklist.monitoramento_insetos
                    ? 'sim'
                    : 'nao'
              }
              desabilitado={!aberta}
              aoMudar={(v) =>
                mudar({ monitoramento_insetos: v === null ? undefined : v === 'sim' })
              }
            />
          </div>
          <Insetos osId={os.id} aberta={aberta} />
        </Etapa>
      )}

      <Etapa
        numero={primeira + quantasEtapasPragas(os, pontos.data) - 1}
        titulo="Observações gerais"
      >
        {(escopo.locais_planilha ?? []).length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Locais com planilha de ocorrência de pragas</p>
            {(escopo.locais_planilha ?? []).map((local) => (
              <label key={local} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5 accent-verde"
                  disabled={!aberta}
                  checked={checklist.planilha_vistos?.[local] === true}
                  onChange={(e) =>
                    mudar({
                      planilha_vistos: { ...checklist.planilha_vistos, [local]: e.target.checked },
                    })
                  }
                />
                {local} — visto técnico
              </label>
            ))}
          </div>
        )}
        {escopo.planilha_ocorrencias && (
          <PlanilhaOcorrencias checklist={checklist} aberta={aberta} mudar={mudar} />
        )}
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Sugestão de medidas físicas e preventivas?</p>
          <BotoesCodigo
            opcoes={{ nao: 'Não', sim: 'Sim' }}
            valor={
              checklist.medidas_preventivas == null
                ? null
                : checklist.medidas_preventivas
                  ? 'sim'
                  : 'nao'
            }
            desabilitado={!aberta}
            aoMudar={(v) => mudar({ medidas_preventivas: v === null ? undefined : v === 'sim' })}
          />
          {checklist.medidas_preventivas && (
            <Textarea
              aria-label="Descreva as medidas"
              rows={2}
              disabled={!aberta}
              value={checklist.medidas_descricao ?? ''}
              onChange={(e) => mudar({ medidas_descricao: e.target.value })}
            />
          )}
        </div>
        <Campo rotulo="Comentários e locais de aplicação" htmlFor="pr-aplicacao">
          <Textarea
            id="pr-aplicacao"
            rows={2}
            disabled={!aberta}
            value={checklist.comentarios_aplicacao ?? ''}
            onChange={(e) => mudar({ comentarios_aplicacao: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Solicitações ou considerações do cliente" htmlFor="pr-solicitacoes">
          <Textarea
            id="pr-solicitacoes"
            rows={2}
            disabled={!aberta}
            value={checklist.solicitacoes_cliente ?? ''}
            onChange={(e) => mudar({ solicitacoes_cliente: e.target.value })}
          />
        </Campo>
        {escopo.envelope && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Foi entregue envelope?</p>
            <BotoesCodigo
              opcoes={{ nao: 'Não', sim: 'Sim' }}
              valor={
                checklist.envelope_entregue == null
                  ? null
                  : checklist.envelope_entregue
                    ? 'sim'
                    : 'nao'
              }
              desabilitado={!aberta}
              aoMudar={(v) => mudar({ envelope_entregue: v === null ? undefined : v === 'sim' })}
            />
            {checklist.envelope_entregue && (
              <>
                <Campo rotulo="Documentos entregues" htmlFor="pr-env-docs">
                  <Textarea
                    id="pr-env-docs"
                    rows={2}
                    disabled={!aberta}
                    value={checklist.envelope_documentos ?? ''}
                    onChange={(e) => mudar({ envelope_documentos: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Quem recebeu (nome e setor)" htmlFor="pr-env-resp">
                  <Input
                    id="pr-env-resp"
                    disabled={!aberta}
                    value={checklist.envelope_responsavel ?? ''}
                    onChange={(e) => mudar({ envelope_responsavel: e.target.value })}
                  />
                </Campo>
              </>
            )}
          </div>
        )}
        <Campo rotulo="Outras observações" htmlFor="ex-observacoes">
          <Textarea
            id="ex-observacoes"
            rows={2}
            disabled={!aberta}
            value={(campos.observacoes as string | null) ?? ''}
            onChange={(e) => alterar({ observacoes: e.target.value })}
          />
        </Campo>
      </Etapa>
    </>
  )
}

/**
 * Observações fixas do escritório (ex.: "retirada pelo cliente em 10/11", "em
 * manutenção pelo cliente"), juntas no alto da etapa para o técnico não passar batido.
 */
function ObservacoesFixas({ pontos }: { pontos: PontoOs[] }) {
  const com = pontos.filter((p) => p.observacao_fixa?.trim())
  if (com.length === 0) return null
  return (
    <div className="rounded-xl border border-alerta/40 bg-amber-50 p-3 text-alerta">
      <p className="font-bold">Observações do escritório</p>
      <ul className="mt-1 flex flex-col gap-1">
        {com.map((p) => (
          <li key={p.id}>
            <strong>
              Nº {String(p.numero).padStart(2, '0')} · {p.area}:
            </strong>{' '}
            {p.observacao_fixa}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Exceções por número: todos começam MS (placa: M). Para cada código o operador
 * digita só os números ("12, 15, 40-45"); o resto continua no padrão.
 */
function ExcecoesPortaIscas({
  osId,
  pontos: todos,
  aberta,
}: {
  osId: string
  pontos: PontoOs[]
  aberta: boolean
}) {
  const anotar = useAnotarPontos(osId)
  const contagem = new Map<string, number>()
  for (const p of todos) contagem.set(p.situacao ?? '—', (contagem.get(p.situacao ?? '—') ?? 0) + 1)

  // Cliente que recomeça a numeração: o técnico escolhe o grupo e digita os
  // números dele. Externos e internos numerados cada um a partir do 01 (Neovia):
  // o grupo é a forma de iscagem. Numeração que recomeça em cada área (Cozinha 1-5,
  // Saguão 1-10): o grupo é a área.
  const porForma = numeracaoPorForma(todos)
  const grupoDe = (p: PontoOs) =>
    porForma ? (FORMAS_ISCAGEM[p.forma_iscagem as keyof typeof FORMAS_ISCAGEM] ?? 'Outros') : p.area
  const grupos = [...new Set(ordenarPontos(todos).map(grupoDe))]
  const vistos = new Set<string>()
  const repete =
    porForma ||
    todos.some((p) => {
      const chave = `${p.tipo_isca === 'CO'}-${p.numero}`
      if (vistos.has(chave)) return true
      vistos.add(chave)
      return false
    })
  const [areaEscolhida, setAreaEscolhida] = useState('')
  const area = repete ? (grupos.includes(areaEscolhida) ? areaEscolhida : grupos[0]) : ''
  const pontos = area ? todos.filter((p) => grupoDe(p) === area) : todos
  const temPlaca = pontos.some((p) => p.tipo_isca === 'CO')
  const temIsca = pontos.some((p) => p.tipo_isca !== 'CO')

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-lima-claro p-3 text-verde-escuro">
        <strong>{todos.length} porta-iscas:</strong>{' '}
        {[...contagem].map(([codigo, n]) => `${n} ${codigo}`).join(' · ')}
      </p>
      {repete && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold">
            {porForma
              ? 'Externos ou internos (cada um tem a sua numeração: escolha e digite os números dele)'
              : 'Área (a numeração recomeça em cada área: escolha a área e digite os números dela)'}
          </span>
          <Select value={area} onChange={(e) => setAreaEscolhida(e.target.value)}>
            {grupos.map((a) => (
              <option key={a} value={a}>
                {a} ({todos.filter((p) => grupoDe(p) === a).length})
              </option>
            ))}
          </Select>
        </label>
      )}
      <p className="text-sm text-texto-suave">
        Todos começam como <strong>MS</strong> (placas de cola: <strong>M</strong>). Digite só os
        números das exceções, ex.: <strong>12, 15, 40-45</strong> (ou com espaço:{' '}
        <strong>12 15 40-45</strong>) e toque em <strong>Aplicar</strong>. Os aplicados ficam
        guardados embaixo; para tirar um, toque na lixeira.
      </p>
      {temIsca &&
        Object.entries(SITUACOES_ISCA)
          .filter(([codigo]) => codigo !== 'MS')
          .map(([codigo, nome]) => (
            <LinhaExcecao
              key={`isca-${area}-${codigo}`}
              codigo={codigo}
              nome={nome}
              padrao="MS"
              pontos={pontos.filter((p) => p.tipo_isca !== 'CO')}
              aplicados={todos.filter((p) => p.tipo_isca !== 'CO' && p.situacao === codigo)}
              aberta={aberta}
              ocupado={anotar.isPending}
              aoAplicar={(ids) => anotar.mutateAsync({ ids, campos: { situacao: codigo } })}
              aoRemover={(ids) => anotar.mutateAsync({ ids, campos: { situacao: 'MS' } })}
            />
          ))}
      {temPlaca && (
        <>
          <p className="font-semibold text-verde-escuro">Placas de cola</p>
          {Object.entries(SITUACOES_PLACA)
            .filter(([codigo]) => codigo !== 'M')
            .map(([codigo, nome]) => (
              <LinhaExcecao
                key={`placa-${area}-${codigo}`}
                codigo={codigo}
                nome={nome}
                padrao="M"
                pontos={pontos.filter((p) => p.tipo_isca === 'CO')}
                aplicados={todos.filter((p) => p.tipo_isca === 'CO' && p.situacao === codigo)}
                aberta={aberta}
                ocupado={anotar.isPending}
                aoAplicar={(ids) => anotar.mutateAsync({ ids, campos: { situacao: codigo } })}
                aoRemover={(ids) => anotar.mutateAsync({ ids, campos: { situacao: 'M' } })}
              />
            ))}
        </>
      )}
    </div>
  )
}

/**
 * Uma situação (MC, CT, …): o técnico digita números e aplica. Aplicar só
 * acrescenta; o que já foi aplicado fica listado embaixo e só sai pela lixeira
 * (com confirmação), para não perder nada apagando o campo sem querer.
 */
function LinhaExcecao({
  codigo,
  nome,
  padrao,
  pontos,
  aplicados,
  aberta,
  ocupado,
  aoAplicar,
  aoRemover,
}: {
  codigo: string
  nome: string
  /** Situação para onde o porta-isca volta quando sai daqui (MS ou M). */
  padrao: string
  /** Onde os números digitados são procurados (a área escolhida, se houver). */
  pontos: PontoOs[]
  /** Todos os que estão nesta situação, de todas as áreas. */
  aplicados: PontoOs[]
  aberta: boolean
  ocupado: boolean
  aoAplicar: (ids: string[]) => Promise<void>
  aoRemover: (ids: string[]) => Promise<void>
}) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const id = `exc-${codigo}-${pontos[0]?.tipo_isca === 'CO' ? 'placa' : 'isca'}`

  const semSinal = (e: unknown) =>
    navigator.onLine ? mensagemDeErro(e) : 'Sem sinal: tente de novo quando a internet voltar.'

  async function aplicar() {
    setErro(null)
    if (!texto.trim()) return
    const { numeros, invalidos } = lerFaixas(texto)
    const porNumero = new Map(pontos.map((p) => [p.numero, p]))
    const inexistentes = numeros.filter((n) => !porNumero.has(n))
    if (invalidos.length || inexistentes.length) {
      setErro(
        [
          invalidos.length && `não entendi ${invalidos.join(', ')}`,
          inexistentes.length && `não existe ${escreverFaixas(inexistentes)}`,
        ]
          .filter(Boolean)
          .join('; '),
      )
      return
    }
    const ids = numeros
      .map((n) => porNumero.get(n)!)
      .filter((p) => p.situacao !== codigo)
      .map((p) => p.id)
    try {
      if (ids.length) await aoAplicar(ids)
      setTexto('')
    } catch (e) {
      setErro(semSinal(e))
    }
  }

  async function remover(p: PontoOs) {
    const ok = window.confirm(
      `Tem certeza que deseja apagar o porta-isca ${p.numero} (${p.area}) de ${codigo} · ${nome}?\n` +
        `Ele volta para ${padrao}.`,
    )
    if (!ok) return
    setErro(null)
    try {
      await aoRemover([p.id])
    } catch (e) {
      setErro(semSinal(e))
    }
  }

  const ordenados = [...aplicados].sort(
    (a, b) => a.area.localeCompare(b.area) || a.numero - b.numero,
  )

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2">
        <span className="grid min-w-12 place-items-center rounded-lg bg-verde px-2 py-1 font-bold text-white">
          {codigo}
        </span>
        <span>{nome}</span>
      </label>
      {aberta && (
        <div className="flex gap-2">
          <Input
            id={id}
            // Teclado normal: o numérico do iPhone não tem vírgula nem hífen ("12, 40-45").
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Números, ex.: 3, 7, 10-12"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // "OK" do teclado: fecha o teclado e o onBlur aplica.
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            onBlur={() => void aplicar()}
          />
          <Button
            type="button"
            variante="secundario"
            disabled={ocupado || !texto.trim()}
            onClick={() => void aplicar()}
          >
            Aplicar
          </Button>
        </div>
      )}
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      {ordenados.length > 0 && (
        <div className="rounded-xl border border-borda bg-fundo-suave p-2">
          <p className="mb-1 text-xs font-semibold text-texto-suave">
            {ordenados.length} {ordenados.length === 1 ? 'aplicado' : 'aplicados'} em {codigo}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {ordenados.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-1 rounded-lg border border-borda bg-white py-0.5 pr-0.5 pl-2 text-sm"
              >
                <strong>{String(p.numero).padStart(2, '0')}</strong>
                <span className="text-texto-suave">· {p.area}</span>
                {aberta && (
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-md text-perigo hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Apagar o porta-isca ${p.numero} (${p.area}) de ${codigo}`}
                    disabled={ocupado}
                    onClick={() => void remover(p)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Armadilha({ osId, ponto, aberta }: { osId: string; ponto: PontoOs; aberta: boolean }) {
  const anotar = useAnotarPontos(osId)
  const capturas = (ponto.capturas ?? {}) as Record<string, number>
  const completas = capturasCompletas(capturas)
  const [obs, setObs] = useState(ponto.observacao ?? '')
  const gravar = (campos: Parameters<typeof anotar.mutate>[0]['campos']) =>
    anotar.mutate({ ids: [ponto.id], campos })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {String(ponto.numero).padStart(2, '0')} · {ponto.area} ·{' '}
        {nomeModeloArmadilha(ponto.modelo_armadilha)}
      </p>
      <p className="-mt-2 text-sm text-texto-suave">
        Última troca de lâmpada:{' '}
        {ponto.ultima_troca_lampada ? formatarData(ponto.ultima_troca_lampada) : 'sem registro'}
      </p>
      {ponto.observacao_fixa && (
        <p className="rounded-lg border border-alerta/40 bg-amber-50 px-3 py-2 text-alerta">
          <strong>Obs. do escritório:</strong> {ponto.observacao_fixa}
        </p>
      )}
      {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
      <Linha rotulo="Situação *">
        <BotoesCodigo
          opcoes={SITUACOES_ARMADILHA}
          valor={ponto.situacao_armadilha}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ situacao_armadilha: v })}
        />
      </Linha>
      <Linha rotulo="Refil">
        <BotoesCodigo
          opcoes={REFIL}
          valor={ponto.refil}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ refil: v })}
        />
      </Linha>
      <Linha rotulo="Lâmpadas trocadas">
        <BotoesCodigo
          opcoes={{ nao: 'Não', sim: 'Sim' }}
          valor={ponto.lampadas_trocadas == null ? null : ponto.lampadas_trocadas ? 'sim' : 'nao'}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ lampadas_trocadas: v === null ? null : v === 'sim' })}
        />
      </Linha>
      <Linha rotulo="Higiene">
        <BotoesCodigo
          opcoes={HIGIENE}
          valor={ponto.higiene}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ higiene: v })}
        />
      </Linha>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Capturas *</span>
          {aberta && !completas && (
            <Button
              variante="secundario"
              onClick={() =>
                gravar({
                  capturas: Object.fromEntries(
                    Object.keys(ESPECIES).map((codigo) => [codigo, capturas[codigo] ?? 0]),
                  ),
                })
              }
            >
              {Object.keys(capturas).length ? 'Zerar o que falta' : 'Nenhuma captura'}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(ESPECIES).map(([codigo, nome]) => (
            <Campo key={codigo} rotulo={nome} htmlFor={`cap-${ponto.id}-${codigo}`}>
              <Input
                // Remonta quando o valor muda por fora (botão "Nenhuma captura").
                key={capturas[codigo] ?? 'vazio'}
                id={`cap-${ponto.id}-${codigo}`}
                inputMode="numeric"
                disabled={!aberta}
                defaultValue={capturas[codigo]?.toString() ?? ''}
                className={aberta && capturas[codigo] == null ? 'border-alerta' : undefined}
                onBlur={(e) => {
                  const n = e.target.value.replace(/\D/g, '')
                  const novo = { ...capturas }
                  if (n) novo[codigo] = Number(n)
                  else delete novo[codigo]
                  if (novo[codigo] !== capturas[codigo]) gravar({ capturas: novo })
                }}
              />
            </Campo>
          ))}
        </div>
        {aberta && !completas && (
          <p className="text-xs text-texto-suave">
            Anote a quantidade de cada inseto. Se não pegou nada, coloque 0.
          </p>
        )}
      </div>
      {/* Vai para o escritório na conferência, para preparar a próxima visita. */}
      <Campo
        rotulo="Observação para a próxima visita"
        htmlFor={`arm-obs-${ponto.id}`}
        dica={aberta ? 'Ex.: lâmpada queimada, levar lâmpada para trocar.' : undefined}
      >
        <Input
          id={`arm-obs-${ponto.id}`}
          disabled={!aberta}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onBlur={() => {
            if (obs.trim() !== (ponto.observacao ?? '')) gravar({ observacao: obs.trim() || null })
          }}
        />
      </Campo>
    </div>
  )
}

/** Armadilha adesiva com feromônio: situação, higiene, quantidade e pragas identificadas. */
function Feromonio({ osId, ponto, aberta }: { osId: string; ponto: PontoOs; aberta: boolean }) {
  const anotar = useAnotarPontos(osId)
  const capturas = (ponto.capturas ?? {}) as Record<string, number>
  const [pragas, setPragas] = useState(ponto.observacao ?? '')
  const gravar = (campos: Parameters<typeof anotar.mutate>[0]['campos']) =>
    anotar.mutate({ ids: [ponto.id], campos })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {String(ponto.numero).padStart(2, '0')} · {ponto.area}
      </p>
      <p className="-mt-2 text-sm text-texto-suave">
        Última troca:{' '}
        {ponto.ultima_troca_lampada ? formatarData(ponto.ultima_troca_lampada) : 'sem registro'}
      </p>
      {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
      <Linha rotulo="Situação da armadilha">
        <BotoesCodigo
          opcoes={SITUACOES_FEROMONIO}
          valor={ponto.refil}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ refil: v })}
        />
      </Linha>
      <Linha rotulo="Higiene da armadilha">
        <BotoesCodigo
          opcoes={HIGIENE}
          valor={ponto.higiene}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ higiene: v })}
        />
      </Linha>
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <Campo rotulo="Qtd" htmlFor={`fer-qtd-${ponto.id}`}>
          <Input
            key={capturas.qtd ?? 'vazio'}
            id={`fer-qtd-${ponto.id}`}
            inputMode="numeric"
            disabled={!aberta}
            defaultValue={capturas.qtd?.toString() ?? ''}
            onBlur={(e) => {
              const n = e.target.value.replace(/\D/g, '')
              const novo = { ...capturas }
              if (n) novo.qtd = Number(n)
              else delete novo.qtd
              if (novo.qtd !== capturas.qtd) gravar({ capturas: novo })
            }}
          />
        </Campo>
        <Campo rotulo="Praga(s) identificada(s)" htmlFor={`fer-pragas-${ponto.id}`}>
          <Input
            id={`fer-pragas-${ponto.id}`}
            disabled={!aberta}
            placeholder="Ex.: gorgulho, traça"
            value={pragas}
            onChange={(e) => setPragas(e.target.value)}
            onBlur={() => {
              if (pragas.trim() !== (ponto.observacao ?? ''))
                gravar({ observacao: pragas.trim() || null })
            }}
          />
        </Campo>
      </div>
    </div>
  )
}

/** Armadilha biológica de moscas: refil, higiene, nível de infestação e observação. */
function ArmadilhaMoscas({
  osId,
  ponto,
  aberta,
}: {
  osId: string
  ponto: PontoOs
  aberta: boolean
}) {
  const anotar = useAnotarPontos(osId)
  const [obs, setObs] = useState(ponto.observacao ?? '')
  const gravar = (campos: Parameters<typeof anotar.mutate>[0]['campos']) =>
    anotar.mutate({ ids: [ponto.id], campos })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {String(ponto.numero).padStart(2, '0')} · {ponto.area}
      </p>
      {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
      <Linha rotulo="Situação do refil">
        <BotoesCodigo
          opcoes={REFIL}
          valor={ponto.refil}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ refil: v })}
        />
      </Linha>
      <Linha rotulo="Condições de higiene">
        <BotoesCodigo
          opcoes={HIGIENE}
          valor={ponto.higiene}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ higiene: v })}
        />
      </Linha>
      <Linha rotulo="Nível de infestação">
        <BotoesCodigo
          opcoes={NIVEIS}
          valor={ponto.nivel}
          desabilitado={!aberta}
          aoMudar={(v) => gravar({ nivel: v })}
        />
      </Linha>
      <Input
        aria-label={`Observação de ${ponto.area}`}
        placeholder="Observação (opcional)"
        disabled={!aberta}
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        onBlur={() => {
          if (obs.trim() !== (ponto.observacao ?? '')) gravar({ observacao: obs.trim() || null })
        }}
      />
    </div>
  )
}

type TipoOcorrencia = keyof typeof OCORRENCIAS

/** Planilha de gerenciamento de ocorrências com pragas: vivos e mortos por tipo. */
function PlanilhaOcorrencias({
  checklist,
  aberta,
  mudar,
}: {
  checklist: ChecklistPragas
  aberta: boolean
  mudar: (parcial: ChecklistPragas) => void
}) {
  const atual = checklist.ocorrencias ?? {}
  const mudarTipo = (tipo: TipoOcorrencia, dados: Ocorrencia) =>
    mudar({ ocorrencias: { ...atual, [tipo]: { ...atual[tipo], ...dados } } })
  const numero = (t: string) => {
    const n = t.replace(/\D/g, '')
    return n ? Number(n) : undefined
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">Planilha de ocorrências com pragas</p>
      <p className="text-sm text-texto-suave">
        Só o que encontrou: quantidade de vivos e mortos e onde (áreas e comentários).
      </p>
      {(Object.entries(OCORRENCIAS) as [TipoOcorrencia, string][]).map(([tipo, nome]) => (
        <div
          key={tipo}
          className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 sm:grid-cols-[10rem_5rem_5rem_1fr]"
        >
          <span className="self-center text-sm font-semibold">{nome}</span>
          <Input
            aria-label={`${nome}: vivos`}
            placeholder="vivos"
            inputMode="numeric"
            disabled={!aberta}
            value={atual[tipo]?.vivos?.toString() ?? ''}
            onChange={(e) => mudarTipo(tipo, { vivos: numero(e.target.value) })}
          />
          <Input
            aria-label={`${nome}: mortos`}
            placeholder="mortos"
            inputMode="numeric"
            disabled={!aberta}
            value={atual[tipo]?.mortos?.toString() ?? ''}
            onChange={(e) => mudarTipo(tipo, { mortos: numero(e.target.value) })}
          />
          <Input
            aria-label={`${nome}: áreas e comentários`}
            className="col-span-3 sm:col-span-1"
            placeholder="áreas e comentários"
            disabled={!aberta}
            value={atual[tipo]?.comentario ?? ''}
            onChange={(e) => mudarTipo(tipo, { comentario: e.target.value })}
          />
        </div>
      ))}
    </div>
  )
}

export function Produtos({ osId, aberta }: { osId: string; aberta: boolean }) {
  const produtos = useProdutos(osId)
  const gravar = useGravarProduto(osId)
  const catalogo = useCatalogoProdutos()
  const [produtoId, setProdutoId] = useState('')
  const escolhido = catalogo.data?.find((c) => c.id === produtoId)
  const [forma, setForma] = useState('bloco')
  // Uma quantidade e a unidade dela (litro vai para o campo de mL: 1 L = 1.000 mL).
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState<'un' | 'g' | 'mL' | 'L'>('g')
  const valor = quantidade ? Number(quantidade.replace(',', '.')) : null
  const emMl =
    valor == null ? null : unidade === 'L' ? valor * 1000 : unidade === 'mL' ? valor : null

  return (
    <div className="flex flex-col gap-3">
      {gravar.isError && <Aviso tipo="erro">{mensagemDeErro(gravar.error)}</Aviso>}
      <ul className="flex flex-col gap-1">
        {produtos.data?.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="flex-1">
              <strong>{nomeDoProduto(p)}</strong> ·{' '}
              {FORMAS_PRODUTO[p.forma as keyof typeof FORMAS_PRODUTO]}
              {p.unidades != null && ` · ${p.unidades} un`}
              {p.gramas != null && ` · ${p.gramas} g`}
              {p.ml != null && ` · ${textoMl(p.ml)}`}
            </span>
            {aberta && (
              <Button variante="fantasma" onClick={() => gravar.mutate({ remover: p.id })}>
                Remover
              </Button>
            )}
          </li>
        ))}
        {produtos.data?.length === 0 && (
          <li className="text-texto-suave">Nenhum produto anotado.</li>
        )}
      </ul>
      {aberta && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-fundo-suave p-3">
          <div className="col-span-2">
            <Campo
              rotulo="Produto"
              htmlFor="prod-produto"
              dica="Não achou o produto? Peça ao escritório para cadastrar."
            >
              <Select
                id="prod-produto"
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value)}
              >
                <option value="">
                  {catalogo.isPending ? 'Carregando produtos…' : 'Escolha o produto…'}
                </option>
                {catalogo.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nomeDoProduto(c)}
                  </option>
                ))}
              </Select>
            </Campo>
            {catalogo.isError && (
              <Aviso tipo="erro">
                Não foi possível carregar a lista de produtos. Abra a OS com sinal uma vez.
              </Aviso>
            )}
          </div>
          <div className="col-span-2">
            <Campo rotulo="Forma" htmlFor="prod-forma">
              <Select id="prod-forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                {Object.entries(FORMAS_PRODUTO).map(([codigo, nome]) => (
                  <option key={codigo} value={codigo}>
                    {nome}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>
          <div className="col-span-2">
            <Campo rotulo="Quantidade" htmlFor="prod-quantidade">
              <div className="flex gap-1">
                <Input
                  id="prod-quantidade"
                  inputMode="decimal"
                  className="min-w-0"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value.replace(/[^\d.,]/g, ''))}
                />
                <Select
                  aria-label="Unidade"
                  className="w-24 shrink-0"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as typeof unidade)}
                >
                  <option value="g">g</option>
                  <option value="mL">mL</option>
                  <option value="L">L</option>
                  <option value="un">un</option>
                </Select>
              </div>
            </Campo>
          </div>
          <Button
            className="col-span-2"
            disabled={!escolhido || gravar.isPending}
            onClick={() =>
              escolhido &&
              gravar.mutate(
                {
                  adicionar: {
                    os_id: osId,
                    produto_id: escolhido.id,
                    nome_comercial: escolhido.nome_comercial,
                    principio_ativo: escolhido.principio_ativo,
                    forma,
                    unidades: unidade === 'un' ? valor : null,
                    gramas: unidade === 'g' ? valor : null,
                    ml: emMl,
                  },
                },
                {
                  onSuccess: () => {
                    setProdutoId('')
                    setQuantidade('')
                  },
                },
              )
            }
          >
            Adicionar produto
          </Button>
        </div>
      )}
    </div>
  )
}

const UNIDADES_APLICACAO = ['mL', 'L', 'g', 'pts'] as const
type UnidadeAplicacao = (typeof UNIDADES_APLICACAO)[number]

function Insetos({ osId, aberta }: { osId: string; aberta: boolean }) {
  const insetos = useInsetos(osId)
  const gravar = useGravarInseto(osId)
  const catalogo = useCatalogoProdutos()
  // Quantidade em número + unidade (sai "100 mL" na OS e no certificado).
  const [qtd, setQtd] = useState('')
  const [unidade, setUnidade] = useState<UnidadeAplicacao>('mL')
  const [novo, setNovo] = useState({
    area: '',
    praga: 'B',
    nivel: 'B',
    condicoes: 'LE',
    principio_ativo: '',
    quantidade: '',
    diluente: 'agua',
    calda: '',
    procedimento: 'PL',
  })

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Controle localizado</p>
      {gravar.isError && <Aviso tipo="erro">{mensagemDeErro(gravar.error)}</Aviso>}
      <ul className="flex flex-col gap-1">
        {insetos.data?.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <span className="flex-1">
              <strong>{i.area}</strong> · {PRAGAS_INSETOS[i.praga as keyof typeof PRAGAS_INSETOS]} ·
              nível {i.nivel} · {i.condicoes} · {i.principio_ativo} {i.quantidade}
              {i.diluente && ` · ${DILUENTES[i.diluente as keyof typeof DILUENTES] ?? i.diluente}`}
              {i.calda && ` · calda ${i.calda} L`} ·{' '}
              {i.procedimento && PROCEDIMENTOS[i.procedimento as keyof typeof PROCEDIMENTOS]}
            </span>
            {aberta && (
              <Button variante="fantasma" onClick={() => gravar.mutate({ remover: i.id })}>
                Remover
              </Button>
            )}
          </li>
        ))}
        {insetos.data?.length === 0 && (
          <li className="text-texto-suave">Nenhuma aplicação localizada.</li>
        )}
      </ul>
      {aberta && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-fundo-suave p-3">
          <div className="col-span-2">
            <Campo rotulo="Área" htmlFor="ins-area">
              <Input
                id="ins-area"
                value={novo.area}
                onChange={(e) => setNovo({ ...novo, area: e.target.value })}
              />
            </Campo>
          </div>
          {(
            [
              ['praga', 'Praga', PRAGAS_INSETOS],
              ['nivel', 'Nível', NIVEIS],
              ['condicoes', 'Condições', CONDICOES],
              ['procedimento', 'Procedimento', PROCEDIMENTOS],
            ] as const
          ).map(([campo, rotulo, opcoes]) => (
            <Campo key={campo} rotulo={rotulo} htmlFor={`ins-${campo}`}>
              <Select
                id={`ins-${campo}`}
                value={novo[campo]}
                onChange={(e) => setNovo({ ...novo, [campo]: e.target.value })}
              >
                {Object.entries(opcoes).map(([codigo, nome]) => (
                  <option key={codigo} value={codigo}>
                    {codigo} · {nome}
                  </option>
                ))}
              </Select>
            </Campo>
          ))}
          {/* Da lista de produtos (sem digitar: evita erro de escrita, ex.: "diclocos"). */}
          <div className="col-span-2">
            <Campo
              rotulo="Produto (princípio ativo)"
              htmlFor="ins-principio"
              dica="Não achou o produto? Peça ao escritório para cadastrar."
            >
              <Select
                id="ins-principio"
                value={novo.principio_ativo}
                onChange={(e) => setNovo({ ...novo, principio_ativo: e.target.value })}
              >
                <option value="">
                  {catalogo.isPending ? 'Carregando produtos…' : 'Escolha o produto…'}
                </option>
                {catalogo.data?.map((c) => (
                  <option key={c.id} value={nomeDoProduto(c)}>
                    {nomeDoProduto(c)}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>
          <Campo rotulo="QNT" htmlFor="ins-quantidade">
            <div className="flex gap-1">
              <Input
                id="ins-quantidade"
                inputMode="decimal"
                className="min-w-0"
                value={qtd}
                onChange={(e) => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
              />
              <Select
                aria-label="Unidade da quantidade"
                className="w-20 shrink-0"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value as UnidadeAplicacao)}
              >
                {UNIDADES_APLICACAO.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
          </Campo>
          <Campo rotulo="Diluente" htmlFor="ins-diluente">
            <Select
              id="ins-diluente"
              value={novo.diluente}
              onChange={(e) => setNovo({ ...novo, diluente: e.target.value })}
            >
              {Object.entries(DILUENTES).map(([codigo, nome]) => (
                <option key={codigo} value={codigo}>
                  {nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Qtde calda (L)" htmlFor="ins-calda">
            <Input
              id="ins-calda"
              inputMode="decimal"
              value={novo.calda}
              onChange={(e) => setNovo({ ...novo, calda: e.target.value })}
            />
          </Campo>
          <Button
            className="col-span-2"
            disabled={!novo.area.trim() || !novo.principio_ativo || gravar.isPending}
            onClick={() =>
              gravar.mutate(
                {
                  adicionar: {
                    os_id: osId,
                    ...novo,
                    quantidade: qtd ? `${qtd} ${unidade}` : null,
                    area: novo.area.trim(),
                    calda: novo.calda.trim() || null,
                    pronto_uso: novo.diluente === 'pronto',
                  },
                },
                {
                  onSuccess: () => {
                    setNovo({ ...novo, area: '', principio_ativo: '', quantidade: '', calda: '' })
                    setQtd('')
                  },
                },
              )
            }
          >
            Adicionar aplicação
          </Button>
        </div>
      )}
    </div>
  )
}

/** Botões grandes para escolher um código (bons para usar de luva). */
export function BotoesCodigo<T extends string>({
  opcoes,
  valor,
  desabilitado,
  aoMudar,
}: {
  opcoes: Record<T, string>
  valor: string | null
  desabilitado?: boolean
  aoMudar: (valor: T | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {(Object.entries(opcoes) as [T, string][]).map(([codigo, nome]) => {
        const ativo = valor === codigo
        return (
          <button
            key={codigo}
            type="button"
            disabled={desabilitado}
            aria-pressed={ativo}
            title={nome}
            onClick={() => aoMudar(ativo ? null : codigo)}
            className={cn(
              'min-h-12 min-w-12 rounded-xl border-2 px-3 font-bold transition-colors disabled:opacity-60',
              ativo ? 'border-verde bg-verde text-white' : 'border-borda bg-white text-texto',
            )}
          >
            {/* Códigos da ficha (MS, LT…) aparecem com o nome; "sim"/"não" só com o nome. */}
            {codigo === codigo.toUpperCase() ? (
              <>
                {codigo}
                <span className="ml-1 text-xs font-normal">{nome}</span>
              </>
            ) : (
              nome
            )}
          </button>
        )
      })}
    </div>
  )
}

function Etapa({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: ReactNode
}) {
  return (
    <Card className="flex scroll-mt-20 flex-col gap-3" data-etapa={titulo}>
      <h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-verde-escuro">
        <span className="grid size-8 place-items-center rounded-full bg-lima text-verde-noite">
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </Card>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{rotulo}</span>
      {children}
    </div>
  )
}
