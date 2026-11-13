import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import { descreverReservatorio, ultimaLimpeza } from '../EscopoReservatorio'
import { useAnotarPontos, usePontosOs, type PontoOs } from '../pragasApi'
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

/** Etapa da limpeza de reservatórios na tela do operador. */
export function ExecucaoReservatorio({ os, campos, alterar, aberta, primeira }: Props) {
  const pontos = usePontosOs(os.id)
  const anotar = useAnotarPontos(os.id)
  const lista = pontos.data?.filter((p) => p.tipo === 'reservatorio') ?? []
  const faltam = lista.filter((p) => p.limpo == null)

  return (
    <Etapa numero={primeira} titulo="Reservatórios">
      {pontos.isPending && <Carregando />}
      {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
      {anotar.isError && <Aviso tipo="erro">{mensagemDeErro(anotar.error)}</Aviso>}
      {aberta && faltam.length > 1 && (
        <button
          type="button"
          className="min-h-11 self-start rounded-xl border-2 border-verde px-3 text-sm font-semibold text-verde-escuro"
          onClick={() => anotar.mutate({ ids: faltam.map((p) => p.id), campos: { limpo: true } })}
        >
          Marcar os {faltam.length} como limpos
        </button>
      )}
      {lista.map((r) => (
        <Reservatorio
          key={r.id}
          reservatorio={r}
          aberta={aberta}
          anotar={(c) => anotar.mutate({ ids: [r.id], campos: c })}
        />
      ))}
      {pontos.isSuccess && lista.length === 0 && (
        <p className="text-texto-suave">
          Nenhum reservatório cadastrado neste local. Descreva o serviço nas observações.
        </p>
      )}
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
  )
}

function Reservatorio({
  reservatorio: r,
  aberta,
  anotar,
}: {
  reservatorio: PontoOs
  aberta: boolean
  anotar: (campos: { limpo?: boolean | null; observacao?: string | null }) => void
}) {
  const [obs, setObs] = useState(r.observacao ?? '')
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-3">
      <p className="font-semibold">
        {r.area} · {descreverReservatorio(r)}
      </p>
      <p className="text-sm text-texto-suave">{ultimaLimpeza(r.ultima_limpeza)}</p>
      <Pergunta texto="Limpo hoje? *">
        <BotoesCodigo
          opcoes={SIM_NAO}
          valor={r.limpo == null ? null : r.limpo ? 'sim' : 'nao'}
          desabilitado={!aberta}
          aoMudar={(v) => anotar({ limpo: v === null ? null : v === 'sim' })}
        />
      </Pergunta>
      <Input
        aria-label={`Observação de ${r.area}`}
        placeholder={r.limpo === false ? 'Motivo de não limpar' : 'Obs. (opcional)'}
        disabled={!aberta}
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        onBlur={() => {
          if (obs.trim() !== (r.observacao ?? '')) anotar({ observacao: obs.trim() || null })
        }}
      />
    </div>
  )
}
