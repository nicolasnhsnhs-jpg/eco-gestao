import { useState, type ReactNode } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import { useAnotarPontos, usePontosOs, type PontoOs } from '../pragasApi'
import {
  etiqueta,
  PERGUNTAS_CONFERENCIA_BEBEDOURO,
  TIPOS_BEBEDOURO,
  TRABALHO,
  type ChecklistBebedouro,
  type RespostaSimNao,
  type TipoBebedouro,
} from '../tipos/bebedouro'
import { BotoesCodigo } from './ExecucaoPragas'

type Props = {
  os: OsCompleta
  campos: CamposExecucao
  alterar: (novos: CamposExecucao) => void
  aberta: boolean
  primeira: number
}

const SIM_NAO = { sim: 'Sim', nao: 'Não' }
const paraBotao = (v: boolean | null | undefined) => (v == null ? null : v ? 'sim' : 'nao')
const doBotao = (v: string | null) => (v === null ? null : v === 'sim')

/** Etapas próprias da limpeza de bebedouros na tela do operador. */
export function ExecucaoBebedouro({ os, campos, alterar, aberta, primeira }: Props) {
  const pontos = usePontosOs(os.id)
  const c = (campos.checklist ?? {}) as ChecklistBebedouro
  const mudar = (parcial: ChecklistBebedouro) => alterar({ checklist: { ...c, ...parcial } })
  const conferencia = c.conferencia ?? {}
  const anotar = useAnotarPontos(os.id)

  return (
    <>
      <Etapa numero={primeira} titulo="Trabalho a ser realizado">
        <Pergunta texto="Preventivo ou corretivo? *">
          <BotoesCodigo
            opcoes={TRABALHO}
            valor={c.trabalho ?? null}
            desabilitado={!aberta}
            aoMudar={(v) => mudar({ trabalho: v ?? undefined })}
          />
        </Pergunta>
      </Etapa>

      <Etapa numero={primeira + 1} titulo="Bebedouros">
        {pontos.isPending && <Carregando />}
        {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
        {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
        {(Object.keys(TIPOS_BEBEDOURO) as TipoBebedouro[]).map((tipo) => {
          const lista = pontos.data?.filter((p) => p.tipo === tipo) ?? []
          if (lista.length === 0) return null
          const faltam = lista.filter((p) => p.limpo == null)
          return (
            <section key={tipo} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-verde-escuro">{TIPOS_BEBEDOURO[tipo].titulo}</h3>
                {aberta && faltam.length > 1 && (
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border-2 border-verde px-3 text-sm font-semibold text-verde-escuro"
                    onClick={() =>
                      anotar.mutate({ ids: faltam.map((p) => p.id), campos: { limpo: true } })
                    }
                  >
                    Marcar os {faltam.length} como limpos
                  </button>
                )}
              </div>
              {lista.map((b) => (
                <Bebedouro
                  key={b.id}
                  bebedouro={b}
                  aberta={aberta}
                  anotar={(campos) => anotar.mutate({ ids: [b.id], campos })}
                />
              ))}
            </section>
          )
        })}
        {pontos.isSuccess &&
          !pontos.data.some((p) => p.tipo === 'bebedouro' || p.tipo === 'bebedouro_garrafao') && (
            <p className="text-texto-suave">Nenhum bebedouro cadastrado neste local.</p>
          )}
      </Etapa>

      <Etapa numero={primeira + 2} titulo="Conferência com o cliente">
        {PERGUNTAS_CONFERENCIA_BEBEDOURO.map((p) => (
          <PerguntaSimNao
            key={p.campo}
            texto={p.texto}
            detalhe={p.detalhe}
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

function Bebedouro({
  bebedouro,
  aberta,
  anotar,
}: {
  bebedouro: PontoOs
  aberta: boolean
  anotar: (campos: {
    limpo?: boolean | null
    filtro_trocado?: boolean | null
    observacao?: string | null
  }) => void
}) {
  const [obs, setObs] = useState(bebedouro.observacao ?? '')
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {etiqueta(bebedouro.numero)} · {bebedouro.area}
        {bebedouro.codigo_filtro && (
          <span className="font-normal text-texto-suave"> · filtro {bebedouro.codigo_filtro}</span>
        )}
      </p>
      <p className="text-sm text-texto-suave">
        Limpeza anterior:{' '}
        {bebedouro.ultima_limpeza ? formatarData(bebedouro.ultima_limpeza) : 'sem registro'}
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Pergunta texto="Limpo hoje? *">
          <BotoesCodigo
            opcoes={SIM_NAO}
            valor={paraBotao(bebedouro.limpo)}
            desabilitado={!aberta}
            aoMudar={(v) => anotar({ limpo: doBotao(v) })}
          />
        </Pergunta>
        <Pergunta texto="Trocou o filtro?">
          <BotoesCodigo
            opcoes={SIM_NAO}
            valor={paraBotao(bebedouro.filtro_trocado)}
            desabilitado={!aberta}
            aoMudar={(v) => anotar({ filtro_trocado: doBotao(v) })}
          />
        </Pergunta>
      </div>
      <Input
        aria-label={`Observação de ${bebedouro.area}`}
        placeholder={bebedouro.limpo === false ? 'Motivo de não limpar' : 'Obs. (opcional)'}
        disabled={!aberta}
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        onBlur={() => {
          if (obs.trim() !== (bebedouro.observacao ?? ''))
            anotar({ observacao: obs.trim() || null })
        }}
      />
    </div>
  )
}

export function PerguntaSimNao({
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
        valor={paraBotao(resposta?.sim)}
        desabilitado={!aberta}
        aoMudar={(v) => aoMudar({ ...resposta, sim: doBotao(v) ?? undefined })}
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

export function Pergunta({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{texto}</p>
      {children}
    </div>
  )
}

export function Etapa({
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
