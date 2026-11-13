import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import { useAnotarPontos, usePontosOs, type PontoOs } from '../pragasApi'
import {
  aparelhoIncompleto,
  AVISO_FOTOS_AR,
  FOTOS_APARELHO,
  formatarBtu,
  LIMPEZAS,
  PRODUTO_PADRAO_AR,
  type ChecklistAr,
  type EscopoAr,
  type SimNaoNa,
} from '../tipos/arCondicionado'
import { etiqueta } from '../tipos/bebedouro'
import { Etapa, Pergunta } from './ExecucaoBebedouro'
import { BotoesCodigo } from './ExecucaoPragas'

type Props = {
  os: OsCompleta
  campos: CamposExecucao
  alterar: (novos: CamposExecucao) => void
  aberta: boolean
  primeira: number
}

const SIM_NAO = { sim: 'Sim', nao: 'Não' }
// "N/A" = não se aplica (cabe no botão).
const NA_CURTO = { sim: 'Sim', nao: 'Não', na: 'N/A' } satisfies Record<SimNaoNa, string>

type CamposAparelho = {
  limpeza_serpentina?: SimNaoNa | null
  limpeza_gabinete?: SimNaoNa | null
  limpeza_dreno?: SimNaoNa | null
  foto_etiqueta?: boolean | null
  fotos_limpeza?: boolean | null
  observacao?: string | null
}

/** Etapas próprias da limpeza de ar-condicionado na tela do operador. */
export function ExecucaoArCondicionado({ os, campos, alterar, aberta, primeira }: Props) {
  const pontos = usePontosOs(os.id)
  const anotar = useAnotarPontos(os.id)
  const c = (campos.checklist ?? {}) as ChecklistAr
  const produto = ((os.escopo ?? {}) as EscopoAr).produto || PRODUTO_PADRAO_AR
  const lista = pontos.data?.filter((p) => p.tipo === 'ar_condicionado') ?? []
  const faltam = lista.filter(aparelhoIncompleto).length

  return (
    <>
      <Etapa numero={primeira} titulo="Aparelhos de ar-condicionado">
        <Aviso tipo="info">{AVISO_FOTOS_AR}</Aviso>
        {pontos.isPending && <Carregando />}
        {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
        {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
        {lista.length > 0 && (
          <p className="text-sm text-texto-suave">
            {lista.length} aparelho(s){faltam > 0 && ` · faltam ${faltam}`}
          </p>
        )}
        {lista.map((a) => (
          <Aparelho
            key={a.id}
            aparelho={a}
            aberta={aberta}
            anotar={(campos) => anotar.mutate({ ids: [a.id], campos })}
          />
        ))}
        {pontos.isSuccess && lista.length === 0 && (
          <p className="text-texto-suave">Nenhum aparelho cadastrado neste local.</p>
        )}
      </Etapa>

      <Etapa numero={primeira + 1} titulo="Produto utilizado">
        <p>{produto}</p>
        <Campo rotulo="Quantidade utilizada (ml)" htmlFor="ar-produto-ml" obrigatorio>
          <Input
            id="ar-produto-ml"
            inputMode="numeric"
            className="w-40"
            disabled={!aberta}
            value={c.produto_ml == null ? '' : String(c.produto_ml)}
            onChange={(e) => {
              const n = e.target.value.replace(/\D/g, '')
              alterar({ checklist: { ...c, produto_ml: n ? Number(n) : undefined } })
            }}
          />
        </Campo>
        <Campo rotulo="Observações gerais" htmlFor="ex-observacoes">
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

function Aparelho({
  aparelho,
  aberta,
  anotar,
}: {
  aparelho: PontoOs
  aberta: boolean
  anotar: (campos: CamposAparelho) => void
}) {
  const [obs, setObs] = useState(aparelho.observacao ?? '')
  const tudoSim = () =>
    anotar({
      limpeza_serpentina: 'sim',
      limpeza_gabinete: 'sim',
      limpeza_dreno: 'sim',
      foto_etiqueta: true,
      fotos_limpeza: true,
    })
  const detalhes = [formatarBtu(aparelho.btu), aparelho.marca, aparelho.numero_serie].filter(
    Boolean,
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {etiqueta(aparelho.numero)} · {aparelho.area}
          </p>
          {detalhes.length > 0 && (
            <p className="text-sm text-texto-suave">{detalhes.join(' · ')}</p>
          )}
          <p className="text-sm text-texto-suave">
            Limpeza anterior:{' '}
            {aparelho.ultima_limpeza ? formatarData(aparelho.ultima_limpeza) : 'sem registro'}
          </p>
        </div>
        {aberta && aparelhoIncompleto(aparelho) && (
          <button
            type="button"
            className="min-h-11 rounded-xl border-2 border-verde px-3 text-sm font-semibold text-verde-escuro"
            onClick={tudoSim}
          >
            Tudo sim
          </button>
        )}
      </div>
      {LIMPEZAS.map((l) => (
        <Pergunta key={l.campo} texto={`${l.texto} *`}>
          <BotoesCodigo
            opcoes={NA_CURTO}
            valor={aparelho[l.campo]}
            desabilitado={!aberta}
            aoMudar={(v) => anotar({ [l.campo]: v })}
          />
        </Pergunta>
      ))}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {FOTOS_APARELHO.map((f) => (
          <Pergunta key={f.campo} texto={`${f.texto} *`}>
            <BotoesCodigo
              opcoes={SIM_NAO}
              valor={aparelho[f.campo] == null ? null : aparelho[f.campo] ? 'sim' : 'nao'}
              desabilitado={!aberta}
              aoMudar={(v) => anotar({ [f.campo]: v === null ? null : v === 'sim' })}
            />
          </Pergunta>
        ))}
      </div>
      <Input
        aria-label={`Não conformidade de ${aparelho.area}`}
        placeholder="Alguma não conformidade encontrada? (opcional)"
        disabled={!aberta}
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        onBlur={() => {
          if (obs.trim() !== (aparelho.observacao ?? '')) anotar({ observacao: obs.trim() || null })
        }}
      />
    </div>
  )
}
