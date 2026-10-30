import type { ReactNode } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import { useAnotarPontos, usePontosOs, type PontoOs } from '../pragasApi'
import {
  AVISO_DESLOCAMENTO,
  CONDICOES_AMBIENTE,
  ESCOAMENTO,
  FOTOS_DEPOIS,
  MATERIAIS,
  PERGUNTAS_CONFERENCIA,
  PERGUNTAS_LIBERACAO,
  PRODUTO_PADRAO,
  QUANTIDADES_PRODUTO,
  SUJIDADE,
  type ChecklistCoifa,
  type EscopoCoifa,
  type RespostaSimNao,
} from '../tipos/coifa'
import { BotoesCodigo } from './ExecucaoPragas'

type Props = {
  os: OsCompleta
  campos: CamposExecucao
  alterar: (novos: CamposExecucao) => void
  aberta: boolean
  primeira: number
}

const SIM_NAO = { sim: 'Sim', nao: 'Não' }
const paraBotao = (r?: RespostaSimNao) => (r?.sim == null ? null : r.sim ? 'sim' : 'nao')

/** Etapas próprias da limpeza de coifa na tela do operador. */
export function ExecucaoCoifa({ os, campos, alterar, aberta, primeira }: Props) {
  const pontos = usePontosOs(os.id)
  const coifas = pontos.data?.filter((p) => p.tipo === 'coifa') ?? []
  const c = (campos.checklist ?? {}) as ChecklistCoifa
  const mudar = (parcial: ChecklistCoifa) => alterar({ checklist: { ...c, ...parcial } })
  const liberacao = c.liberacao ?? {}
  const conferencia = c.conferencia ?? {}
  const produto = ((os.escopo ?? {}) as EscopoCoifa).produto ?? PRODUTO_PADRAO
  const outroMl =
    c.produto_ml != null && !(QUANTIDADES_PRODUTO as readonly number[]).includes(c.produto_ml)

  return (
    <>
      <Etapa numero={primeira} titulo="Liberação para trabalho">
        <Aviso tipo="info">{AVISO_DESLOCAMENTO}</Aviso>
        {PERGUNTAS_LIBERACAO.map((p) => (
          <PerguntaSimNao
            key={p.campo}
            texto={p.texto}
            detalhe={p.detalhe}
            resposta={liberacao[p.campo]}
            aberta={aberta}
            aoMudar={(r) => mudar({ liberacao: { ...liberacao, [p.campo]: r } })}
          />
        ))}
        <Pergunta texto="Condições do ambiente de trabalho">
          <BotoesCodigo
            opcoes={CONDICOES_AMBIENTE}
            valor={liberacao.condicoes ?? null}
            desabilitado={!aberta}
            aoMudar={(v) => mudar({ liberacao: { ...liberacao, condicoes: v ?? undefined } })}
          />
        </Pergunta>
        <Pergunta texto="Condições de escoamento do piso">
          <BotoesCodigo
            opcoes={ESCOAMENTO}
            valor={liberacao.escoamento ?? null}
            desabilitado={!aberta}
            aoMudar={(v) => mudar({ liberacao: { ...liberacao, escoamento: v ?? undefined } })}
          />
          <Input
            aria-label="Observação do escoamento"
            placeholder="Obs. (opcional)"
            disabled={!aberta}
            value={liberacao.escoamento_obs ?? ''}
            onChange={(e) => mudar({ liberacao: { ...liberacao, escoamento_obs: e.target.value } })}
          />
        </Pergunta>
      </Etapa>

      <Etapa numero={primeira + 1} titulo="Coifas">
        {pontos.isPending && <Carregando />}
        {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
        {pontos.isSuccess && coifas.length === 0 && (
          <p className="text-texto-suave">Nenhuma coifa cadastrada neste local.</p>
        )}
        {coifas.map((coifa) => (
          <Coifa key={coifa.id} osId={os.id} coifa={coifa} aberta={aberta} />
        ))}
      </Etapa>

      <Etapa numero={primeira + 2} titulo="Telas e fotos depois">
        <Pergunta texto="Telas retiradas para higienização na empresa?">
          <BotoesCodigo
            opcoes={SIM_NAO}
            valor={c.telas_retiradas?.sim == null ? null : c.telas_retiradas.sim ? 'sim' : 'nao'}
            desabilitado={!aberta}
            aoMudar={(v) =>
              mudar({
                telas_retiradas: {
                  ...c.telas_retiradas,
                  sim: v === null ? undefined : v === 'sim',
                },
              })
            }
          />
          {c.telas_retiradas?.sim && (
            <Input
              aria-label="Quantidade de telas retiradas"
              inputMode="numeric"
              placeholder="Quantidade"
              disabled={!aberta}
              value={c.telas_retiradas.quantidade?.toString() ?? ''}
              onChange={(e) => {
                const n = e.target.value.replace(/\D/g, '')
                mudar({
                  telas_retiradas: { ...c.telas_retiradas, quantidade: n ? Number(n) : undefined },
                })
              }}
            />
          )}
        </Pergunta>
        <Pergunta texto="Registro fotográfico após a limpeza">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(FOTOS_DEPOIS).map(([campo, nome]) => (
              <label key={campo} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-verde"
                  disabled={!aberta}
                  checked={c.fotos_depois?.[campo as keyof typeof FOTOS_DEPOIS] ?? false}
                  onChange={(e) =>
                    mudar({ fotos_depois: { ...c.fotos_depois, [campo]: e.target.checked } })
                  }
                />
                {nome}
              </label>
            ))}
          </div>
          <p className="text-sm text-texto-suave">
            As fotos em si vão na etapa “Fotos”, mais abaixo.
          </p>
        </Pergunta>
      </Etapa>

      <Etapa numero={primeira + 3} titulo="Produto utilizado">
        <p>{produto}</p>
        <Pergunta texto="Quantidade usada *">
          <div className="flex flex-wrap gap-2">
            {QUANTIDADES_PRODUTO.map((ml) => (
              <button
                key={ml}
                type="button"
                disabled={!aberta}
                aria-pressed={c.produto_ml === ml}
                onClick={() => mudar({ produto_ml: ml })}
                className={
                  c.produto_ml === ml
                    ? 'min-h-12 rounded-xl border-2 border-verde bg-verde px-3 font-bold text-white'
                    : 'min-h-12 rounded-xl border-2 border-borda bg-white px-3 font-bold'
                }
              >
                {ml} ml
              </button>
            ))}
          </div>
          <Input
            aria-label="Outra quantidade em ml"
            inputMode="numeric"
            placeholder="Outra quantidade (ml)"
            disabled={!aberta}
            value={outroMl ? String(c.produto_ml) : ''}
            onChange={(e) => {
              const n = e.target.value.replace(/\D/g, '')
              mudar({ produto_ml: n ? Number(n) : undefined })
            }}
          />
        </Pergunta>
      </Etapa>

      <Etapa numero={primeira + 4} titulo="Conferência com o cliente">
        {PERGUNTAS_CONFERENCIA.map((p) => (
          <PerguntaSimNao
            key={p.campo}
            texto={p.texto}
            detalhe="Se não, motivo"
            resposta={conferencia[p.campo]}
            aberta={aberta}
            aoMudar={(r) => mudar({ conferencia: { ...conferencia, [p.campo]: r } })}
          />
        ))}
        <Campo rotulo="Observações" htmlFor="ex-observacoes">
          <Textarea
            id="ex-observacoes"
            rows={3}
            disabled={!aberta}
            value={(campos.observacoes as string | null) ?? ''}
            onChange={(e) => alterar({ observacoes: e.target.value })}
          />
        </Campo>
      </Etapa>
    </>
  )
}

function Coifa({ osId, coifa, aberta }: { osId: string; coifa: PontoOs; aberta: boolean }) {
  const anotar = useAnotarPontos(osId)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {coifa.quantidade ?? 1}× {coifa.area} ·{' '}
        {MATERIAIS[coifa.material as keyof typeof MATERIAIS]} · {coifa.quantidade_telas ?? 0}{' '}
        tela(s)
      </p>
      {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
      <Pergunta texto="Nível de sujidade *">
        <BotoesCodigo
          opcoes={SUJIDADE}
          valor={coifa.sujidade}
          desabilitado={!aberta}
          aoMudar={(v) => anotar.mutate({ ids: [coifa.id], campos: { sujidade: v } })}
        />
      </Pergunta>
      <Pergunta texto="Registro fotográfico antes?">
        <BotoesCodigo
          opcoes={SIM_NAO}
          valor={coifa.foto_antes == null ? null : coifa.foto_antes ? 'sim' : 'nao'}
          desabilitado={!aberta}
          aoMudar={(v) =>
            anotar.mutate({
              ids: [coifa.id],
              campos: { foto_antes: v === null ? null : v === 'sim' },
            })
          }
        />
      </Pergunta>
    </div>
  )
}

function PerguntaSimNao({
  texto,
  detalhe,
  resposta,
  aberta,
  aoMudar,
}: {
  texto: string
  detalhe: string
  resposta?: RespostaSimNao
  aberta: boolean
  aoMudar: (r: RespostaSimNao) => void
}) {
  return (
    <Pergunta texto={`${texto} *`}>
      <BotoesCodigo
        opcoes={SIM_NAO}
        valor={paraBotao(resposta)}
        desabilitado={!aberta}
        aoMudar={(v) => aoMudar({ ...resposta, sim: v === null ? undefined : v === 'sim' })}
      />
      <Input
        aria-label={`${texto} ${detalhe}`}
        placeholder={`${detalhe} (opcional)`}
        disabled={!aberta}
        value={resposta?.texto ?? ''}
        onChange={(e) => aoMudar({ ...resposta, texto: e.target.value })}
      />
    </Pergunta>
  )
}

function Pergunta({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-borda pt-3 first:border-0 first:pt-0">
      <p className="font-semibold">{texto}</p>
      {children}
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
