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
  useAnotarPontos,
  useGravarInseto,
  useGravarProduto,
  useInsetos,
  usePontosOs,
  useProdutos,
  type PontoOs,
} from '../pragasApi'
import {
  CONDICOES,
  escreverFaixas,
  ESPECIES,
  FORMAS_PRODUTO,
  HIGIENE,
  lerFaixas,
  NIVEIS,
  PRAGAS_ALVO,
  PRAGAS_INSETOS,
  PROCEDIMENTOS,
  REFIL,
  SITUACOES_ARMADILHA,
  SITUACOES_ISCA,
  SITUACOES_PLACA,
  sugerirNivelRoedores,
  quantasEtapasPragas,
  type ChecklistPragas,
  type EscopoPragas,
  type Nivel,
} from '../tipos/pragas'

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
  const checklist = (campos.checklist ?? {}) as ChecklistPragas
  const mudar = (parcial: ChecklistPragas) => alterar({ checklist: { ...checklist, ...parcial } })

  const portaIscas = pontos.data?.filter((p) => p.tipo === 'porta_isca') ?? []
  const armadilhas = pontos.data?.filter((p) => p.tipo === 'armadilha_luminosa') ?? []
  const sugestao = sugerirNivelRoedores(portaIscas.map((p) => p.situacao))
  const pragasAlvo = checklist.pragas_alvo ?? escopo.pragas_alvo ?? []

  return (
    <>
      <Etapa numero={primeira} titulo="Porta-iscas">
        {pontos.isPending && <Carregando />}
        {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
        {portaIscas.length > 0 ? (
          <ExcecoesPortaIscas osId={os.id} pontos={portaIscas} aberta={aberta} />
        ) : (
          <p className="text-texto-suave">Nenhum porta-isca neste local.</p>
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
        <Produtos osId={os.id} aberta={aberta} />
      </Etapa>

      {armadilhas.length > 0 && (
        <Etapa numero={primeira + 2} titulo="Armadilhas luminosas">
          {armadilhas.map((a) => (
            <Armadilha key={a.id} osId={os.id} ponto={a} aberta={aberta} />
          ))}
        </Etapa>
      )}

      {escopo.subtipo === 'insetos_roedores' && (
        <Etapa numero={primeira + 2 + (armadilhas.length > 0 ? 1 : 0)} titulo="Controle de insetos">
          {escopo.areas_insetos && (
            <p>
              <span className="font-semibold">Áreas do cliente:</span> {escopo.areas_insetos}
            </p>
          )}
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-verde"
              disabled={!aberta}
              checked={checklist.monitoramento_insetos ?? false}
              onChange={(e) => mudar({ monitoramento_insetos: e.target.checked })}
            />
            Realizado monitoramento programado nas áreas
          </label>
          <Insetos osId={os.id} aberta={aberta} />
        </Etapa>
      )}

      <Etapa
        numero={primeira + quantasEtapasPragas(os, pontos.data) - 1}
        titulo="Observações gerais"
      >
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
 * Exceções por número: todos começam MS (placa: M). Para cada código o operador
 * digita só os números ("12, 15, 40-45"); o resto continua no padrão.
 */
function ExcecoesPortaIscas({
  osId,
  pontos,
  aberta,
}: {
  osId: string
  pontos: PontoOs[]
  aberta: boolean
}) {
  const anotar = useAnotarPontos(osId)
  const temPlaca = pontos.some((p) => p.tipo_isca === 'CO')
  const temIsca = pontos.some((p) => p.tipo_isca !== 'CO')
  const contagem = new Map<string, number>()
  for (const p of pontos)
    contagem.set(p.situacao ?? '—', (contagem.get(p.situacao ?? '—') ?? 0) + 1)

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-lima-claro p-3 text-verde-escuro">
        <strong>{pontos.length} porta-iscas:</strong>{' '}
        {[...contagem].map(([codigo, n]) => `${n} ${codigo}`).join(' · ')}
      </p>
      <p className="text-sm text-texto-suave">
        Todos começam como <strong>MS</strong> (placas de cola: <strong>M</strong>). Digite só os
        números das exceções, ex.: <strong>12, 15, 40-45</strong>.
      </p>
      {temIsca &&
        Object.entries(SITUACOES_ISCA)
          .filter(([codigo]) => codigo !== 'MS')
          .map(([codigo, nome]) => (
            <LinhaExcecao
              key={`isca-${codigo}`}
              codigo={codigo}
              nome={nome}
              pontos={pontos.filter((p) => p.tipo_isca !== 'CO')}
              aberta={aberta}
              ocupado={anotar.isPending}
              aoAplicar={(ids, voltar) =>
                anotar
                  .mutateAsync({ ids, campos: { situacao: codigo } })
                  .then(() => anotar.mutateAsync({ ids: voltar, campos: { situacao: 'MS' } }))
              }
            />
          ))}
      {temPlaca && (
        <>
          <p className="font-semibold text-verde-escuro">Placas de cola</p>
          {Object.entries(SITUACOES_PLACA)
            .filter(([codigo]) => codigo !== 'M')
            .map(([codigo, nome]) => (
              <LinhaExcecao
                key={`placa-${codigo}`}
                codigo={codigo}
                nome={nome}
                pontos={pontos.filter((p) => p.tipo_isca === 'CO')}
                aberta={aberta}
                ocupado={anotar.isPending}
                aoAplicar={(ids, voltar) =>
                  anotar
                    .mutateAsync({ ids, campos: { situacao: codigo } })
                    .then(() => anotar.mutateAsync({ ids: voltar, campos: { situacao: 'M' } }))
                }
              />
            ))}
        </>
      )}
    </div>
  )
}

function LinhaExcecao({
  codigo,
  nome,
  pontos,
  aberta,
  ocupado,
  aoAplicar,
}: {
  codigo: string
  nome: string
  pontos: PontoOs[]
  aberta: boolean
  ocupado: boolean
  aoAplicar: (ids: string[], voltarAoPadrao: string[]) => Promise<void>
}) {
  const atuais = pontos.filter((p) => p.situacao === codigo).map((p) => p.numero)
  const [texto, setTexto] = useState(escreverFaixas(atuais))
  const [erro, setErro] = useState<string | null>(null)
  const id = `exc-${codigo}-${pontos[0]?.tipo_isca === 'CO' ? 'placa' : 'isca'}`

  async function aplicar() {
    setErro(null)
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
    const ids = numeros.map((n) => porNumero.get(n)!.id)
    const voltar = pontos
      .filter((p) => p.situacao === codigo && !numeros.includes(p.numero))
      .map((p) => p.id)
    try {
      await aoAplicar(ids, voltar)
      setTexto(escreverFaixas(numeros))
    } catch (e) {
      setErro(
        navigator.onLine ? mensagemDeErro(e) : 'Sem sinal: tente de novo quando a internet voltar.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2">
        <span className="grid min-w-12 place-items-center rounded-lg bg-verde px-2 py-1 font-bold text-white">
          {codigo}
        </span>
        <span>{nome}</span>
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="numeric"
          placeholder="nenhum"
          disabled={!aberta}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            if (texto !== escreverFaixas(atuais)) void aplicar()
          }}
        />
        {aberta && (
          <Button
            type="button"
            variante="secundario"
            disabled={ocupado}
            onClick={() => void aplicar()}
          >
            Aplicar
          </Button>
        )}
      </div>
      {erro && <p className="text-sm text-perigo">{erro}</p>}
    </div>
  )
}

function Armadilha({ osId, ponto, aberta }: { osId: string; ponto: PontoOs; aberta: boolean }) {
  const anotar = useAnotarPontos(osId)
  const capturas = (ponto.capturas ?? {}) as Record<string, number>
  const gravar = (campos: Parameters<typeof anotar.mutate>[0]['campos']) =>
    anotar.mutate({ ids: [ponto.id], campos })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {String(ponto.numero).padStart(2, '0')} · {ponto.area} ·{' '}
        {ponto.modelo_armadilha === 'P' ? 'Branca (P)' : 'Inox (G)'}
      </p>
      <p className="-mt-2 text-sm text-texto-suave">
        Última troca de lâmpada:{' '}
        {ponto.ultima_troca_lampada ? formatarData(ponto.ultima_troca_lampada) : 'sem registro'}
      </p>
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
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(ESPECIES).map(([codigo, nome]) => (
          <Campo key={codigo} rotulo={nome} htmlFor={`cap-${ponto.id}-${codigo}`}>
            <Input
              id={`cap-${ponto.id}-${codigo}`}
              inputMode="numeric"
              disabled={!aberta}
              defaultValue={capturas[codigo]?.toString() ?? ''}
              onBlur={(e) => {
                const n = e.target.value.replace(/\D/g, '')
                const novo = { ...capturas, [codigo]: n ? Number(n) : 0 }
                if (novo[codigo] !== (capturas[codigo] ?? 0)) gravar({ capturas: novo })
              }}
            />
          </Campo>
        ))}
      </div>
    </div>
  )
}

function Produtos({ osId, aberta }: { osId: string; aberta: boolean }) {
  const produtos = useProdutos(osId)
  const gravar = useGravarProduto(osId)
  const [principio, setPrincipio] = useState('')
  const [forma, setForma] = useState('bloco')
  const [unidades, setUnidades] = useState('')
  const [gramas, setGramas] = useState('')
  const numero = (t: string) => (t ? Number(t.replace(',', '.')) : null)

  return (
    <div className="flex flex-col gap-3">
      {gravar.isError && <Aviso tipo="erro">{mensagemDeErro(gravar.error)}</Aviso>}
      <ul className="flex flex-col gap-1">
        {produtos.data?.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="flex-1">
              <strong>{p.principio_ativo}</strong> ·{' '}
              {FORMAS_PRODUTO[p.forma as keyof typeof FORMAS_PRODUTO]}
              {p.unidades != null && ` · ${p.unidades} un`}
              {p.gramas != null && ` · ${p.gramas} g`}
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
            <Campo rotulo="Princípio ativo" htmlFor="prod-principio">
              <Input
                id="prod-principio"
                value={principio}
                onChange={(e) => setPrincipio(e.target.value)}
              />
            </Campo>
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
          <Campo rotulo="Unidades" htmlFor="prod-unidades">
            <Input
              id="prod-unidades"
              inputMode="decimal"
              value={unidades}
              onChange={(e) => setUnidades(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Gramas" htmlFor="prod-gramas">
            <Input
              id="prod-gramas"
              inputMode="decimal"
              value={gramas}
              onChange={(e) => setGramas(e.target.value)}
            />
          </Campo>
          <Button
            className="col-span-2"
            disabled={principio.trim().length < 2 || gravar.isPending}
            onClick={() =>
              gravar.mutate(
                {
                  adicionar: {
                    os_id: osId,
                    principio_ativo: principio.trim(),
                    forma,
                    unidades: numero(unidades),
                    gramas: numero(gramas),
                  },
                },
                {
                  onSuccess: () => {
                    setPrincipio('')
                    setUnidades('')
                    setGramas('')
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

function Insetos({ osId, aberta }: { osId: string; aberta: boolean }) {
  const insetos = useInsetos(osId)
  const gravar = useGravarInseto(osId)
  const [novo, setNovo] = useState({
    area: '',
    praga: 'B',
    nivel: 'B',
    condicoes: 'LE',
    principio_ativo: '',
    quantidade: '',
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
              nível {i.nivel} · {i.condicoes} · {i.principio_ativo} {i.quantidade} ·{' '}
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
          <Campo rotulo="Princípio ativo" htmlFor="ins-principio">
            <Input
              id="ins-principio"
              value={novo.principio_ativo}
              onChange={(e) => setNovo({ ...novo, principio_ativo: e.target.value })}
            />
          </Campo>
          <Campo rotulo="Quantidade" htmlFor="ins-quantidade">
            <Input
              id="ins-quantidade"
              value={novo.quantidade}
              onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })}
            />
          </Campo>
          <Button
            className="col-span-2"
            disabled={!novo.area.trim() || gravar.isPending}
            onClick={() =>
              gravar.mutate(
                { adicionar: { os_id: osId, ...novo, area: novo.area.trim() } },
                {
                  onSuccess: () =>
                    setNovo({ ...novo, area: '', principio_ativo: '', quantidade: '' }),
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
    <Card className="flex flex-col gap-3">
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
