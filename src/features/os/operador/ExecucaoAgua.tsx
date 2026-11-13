import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import { useAnotarPontos, usePontosOs, type PontoOs } from '../pragasApi'
import {
  AVISO_PONTOS,
  PARAMETROS_PADRAO,
  PERGUNTA_REFRIGERADAS,
  PROCEDIMENTO_COLETA,
  type ChecklistAgua,
  type EscopoAgua,
} from '../tipos/agua'
import { Etapa, Pergunta, PerguntaSimNao } from './ExecucaoBebedouro'
import { BotoesCodigo } from './ExecucaoPragas'

type Props = {
  os: OsCompleta
  campos: CamposExecucao
  alterar: (novos: CamposExecucao) => void
  aberta: boolean
  primeira: number
}

const SIM_NAO = { sim: 'Sim', nao: 'Não' }

/** "09:05" de agora. */
const agora = () => new Date().toTimeString().slice(0, 5)

/** Etapas próprias da coleta de água para análise na tela do operador. */
export function ExecucaoAgua({ os, campos, alterar, aberta, primeira }: Props) {
  const pontos = usePontosOs(os.id)
  const anotar = useAnotarPontos(os.id)
  const c = (campos.checklist ?? {}) as ChecklistAgua
  const mudar = (parcial: ChecklistAgua) => alterar({ checklist: { ...c, ...parcial } })
  const escopo = (os.escopo ?? {}) as EscopoAgua
  const lista = pontos.data?.filter((p) => p.tipo === 'ponto_coleta') ?? []

  return (
    <>
      <Etapa numero={primeira} titulo="Procedimento de coleta">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {PROCEDIMENTO_COLETA.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border-2 border-borda p-3 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-verde"
            disabled={!aberta}
            checked={c.procedimento === true}
            onChange={(e) => mudar({ procedimento: e.target.checked || undefined })}
          />
          Segui o procedimento de coleta *
        </label>
      </Etapa>

      <Etapa numero={primeira + 1} titulo="Pontos de coleta">
        <p className="text-sm text-texto-suave">{AVISO_PONTOS}</p>
        <p className="text-sm">
          <strong>Parâmetros:</strong> {escopo.parametros || PARAMETROS_PADRAO}
          {escopo.frascos && (
            <>
              <br />
              <strong>Frascos:</strong> {escopo.frascos}
            </>
          )}
        </p>
        {pontos.isPending && <Carregando />}
        {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
        {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
        {lista.map((p) => (
          <PontoColeta
            key={p.id}
            ponto={p}
            aberta={aberta}
            anotar={(campos) => anotar.mutate({ ids: [p.id], campos })}
          />
        ))}
        {pontos.isSuccess && lista.length === 0 && (
          <p className="text-texto-suave">Nenhum ponto de coleta cadastrado neste local.</p>
        )}
      </Etapa>

      <Etapa numero={primeira + 2} titulo="Amostras">
        <PerguntaSimNao
          texto={PERGUNTA_REFRIGERADAS.texto}
          detalhe={PERGUNTA_REFRIGERADAS.detalhe}
          resposta={c.refrigeradas}
          aberta={aberta}
          aoMudar={(r) => mudar({ refrigeradas: r })}
        />
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

function PontoColeta({
  ponto,
  aberta,
  anotar,
}: {
  ponto: PontoOs
  aberta: boolean
  anotar: (campos: {
    coletado?: boolean | null
    hora_coleta?: string | null
    observacao?: string | null
  }) => void
}) {
  const [obs, setObs] = useState(ponto.observacao ?? '')
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {String(ponto.numero).padStart(2, '0')} · {ponto.area}
      </p>
      <p className="text-sm text-texto-suave">
        Coleta anterior:{' '}
        {ponto.ultima_limpeza ? formatarData(ponto.ultima_limpeza) : 'sem registro'}
      </p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Pergunta texto="Coletado? *">
          <BotoesCodigo
            opcoes={SIM_NAO}
            valor={ponto.coletado == null ? null : ponto.coletado ? 'sim' : 'nao'}
            desabilitado={!aberta}
            aoMudar={(v) =>
              anotar(
                v === 'sim'
                  ? { coletado: true, hora_coleta: ponto.hora_coleta ?? agora() }
                  : { coletado: v === null ? null : false, hora_coleta: null },
              )
            }
          />
        </Pergunta>
        {ponto.coletado && (
          <Campo rotulo="Hora da coleta *" htmlFor={`coleta-${ponto.id}`}>
            <Input
              id={`coleta-${ponto.id}`}
              type="time"
              className="w-32"
              disabled={!aberta}
              value={ponto.hora_coleta?.slice(0, 5) ?? ''}
              onChange={(e) => anotar({ hora_coleta: e.target.value || null })}
            />
          </Campo>
        )}
      </div>
      <Input
        aria-label={`Observação de ${ponto.area}`}
        placeholder={ponto.coletado === false ? 'Motivo de não coletar' : 'Obs. (opcional)'}
        disabled={!aberta}
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        onBlur={() => {
          if (obs.trim() !== (ponto.observacao ?? '')) anotar({ observacao: obs.trim() || null })
        }}
      />
    </div>
  )
}
