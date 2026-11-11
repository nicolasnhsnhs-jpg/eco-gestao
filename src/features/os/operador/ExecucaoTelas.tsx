import type { ReactNode } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import { usePontosOs } from '../pragasApi'
import {
  PERGUNTA_INSTALADAS,
  PERGUNTA_LIBERACAO_TELAS,
  totalTelas,
  type ChecklistTelas,
  type RespostaSimNao,
} from '../tipos/telas'
import { BotoesCodigo } from './ExecucaoPragas'

type Props = {
  os: OsCompleta
  campos: CamposExecucao
  alterar: (novos: CamposExecucao) => void
  aberta: boolean
  primeira: number
}

const SIM_NAO = { sim: 'Sim', nao: 'Não' }

/** Etapas próprias da entrega de telas na tela do operador. */
export function ExecucaoTelas({ os, campos, alterar, aberta, primeira }: Props) {
  const pontos = usePontosOs(os.id)
  const coifas = (pontos.data?.filter((p) => p.tipo === 'coifa') ?? []).sort(
    (a, b) => a.numero - b.numero,
  )
  const c = (campos.checklist ?? {}) as ChecklistTelas
  const mudar = (parcial: ChecklistTelas) => alterar({ checklist: { ...c, ...parcial } })

  return (
    <>
      <Etapa numero={primeira} titulo="Liberação para instalação de telas">
        <PerguntaSimNao
          {...PERGUNTA_LIBERACAO_TELAS}
          resposta={c.autorizado}
          aberta={aberta}
          aoMudar={(r) => mudar({ autorizado: r })}
        />
      </Etapa>

      <Etapa numero={primeira + 1} titulo="Entrega de telas">
        {pontos.isPending && <Carregando />}
        {pontos.isError && <Aviso tipo="erro">{mensagemDeErro(pontos.error)}</Aviso>}
        {pontos.isSuccess && coifas.length === 0 && (
          <p className="text-texto-suave">Nenhuma coifa cadastrada nesta OS.</p>
        )}
        {coifas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {coifas.map((coifa) => (
              <li
                key={coifa.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-borda p-3"
              >
                <span>
                  <span className="font-semibold">
                    {String(coifa.quantidade ?? 1).padStart(2, '0')}×
                  </span>{' '}
                  {coifa.area}
                </span>
                <span className="shrink-0 font-bold whitespace-nowrap">
                  {coifa.quantidade_telas ?? 0} tela(s)
                </span>
              </li>
            ))}
            <li className="text-right text-sm text-texto-suave">
              Total: <strong>{totalTelas(coifas)}</strong> tela(s)
            </li>
          </ul>
        )}
      </Etapa>

      <Etapa numero={primeira + 2} titulo="Conferência com o cliente">
        <PerguntaSimNao
          {...PERGUNTA_INSTALADAS}
          resposta={c.instaladas}
          aberta={aberta}
          aoMudar={(r) => mudar({ instaladas: r })}
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
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{texto} *</p>
      <BotoesCodigo
        opcoes={SIM_NAO}
        valor={resposta?.sim == null ? null : resposta.sim ? 'sim' : 'nao'}
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
