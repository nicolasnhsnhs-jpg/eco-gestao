import { Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Textarea } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { formatarData } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import type { CamposExecucao, OsCompleta } from '../api'
import { useAnotarPontos, usePontosColeta, usePontosOs, type PontoOs } from '../pragasApi'
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
  const coleta = usePontosColeta(os.id)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  /** Ação que precisa de sinal (grava direto na O.S salva). */
  async function comSinal(acao: () => Promise<unknown>) {
    setErro(null)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErro('Sem sinal agora. Cadastrar ou mudar ponto de coleta precisa de internet.')
      return false
    }
    try {
      await acao()
      return true
    } catch (e) {
      setErro(mensagemDeErro(e))
      return false
    }
  }

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
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {lista.map((p) => (
          <PontoColeta
            key={p.id}
            ponto={p}
            aberta={aberta}
            anotar={(campos) => anotar.mutate({ ids: [p.id], campos })}
            renomear={(area) =>
              comSinal(() => coleta.renomear.mutateAsync({ ponto: p.ponto_id!, area }))
            }
            tirar={() => {
              const pergunta = `Tirar o ponto "${p.area}"? Ele não aparece mais nas próximas coletas.`
              if (!window.confirm(pergunta)) return
              void comSinal(() => coleta.remover.mutateAsync(p.ponto_id!))
            }}
          />
        ))}
        {pontos.isSuccess && lista.length === 0 && (
          <p className="text-texto-suave">
            Nenhum ponto ainda. Escreva abaixo onde você coletou a amostra.
          </p>
        )}
        {aberta && (
          <form
            className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-borda p-3"
            onSubmit={(e) => {
              e.preventDefault()
              const nome = novo.trim()
              if (!nome) return
              void comSinal(() => coleta.adicionar.mutateAsync(nome)).then((ok) => {
                if (ok) setNovo('')
              })
            }}
          >
            <Campo
              rotulo="Onde foi coletado?"
              htmlFor="coleta-novo"
              dica='Ex.: "Torneira da cozinha", "Banheiro", "Reservatório superior".'
            >
              <Input
                id="coleta-novo"
                maxLength={80}
                value={novo}
                onChange={(e) => setNovo(e.target.value)}
              />
            </Campo>
            <Button type="submit" disabled={!novo.trim() || coleta.adicionar.isPending}>
              <Plus className="size-4" aria-hidden />
              {coleta.adicionar.isPending ? 'Adicionando…' : 'Adicionar ponto de coleta'}
            </Button>
          </form>
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
  renomear,
  tirar,
}: {
  renomear: (area: string) => Promise<boolean>
  tirar: () => void
  ponto: PontoOs
  aberta: boolean
  anotar: (campos: {
    coletado?: boolean | null
    hora_coleta?: string | null
    observacao?: string | null
  }) => void
}) {
  const [obs, setObs] = useState(ponto.observacao ?? '')
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(ponto.area)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-3">
      {editando ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!nome.trim() || nome.trim() === ponto.area) return setEditando(false)
            void renomear(nome.trim()).then((ok) => ok && setEditando(false))
          }}
        >
          <Campo rotulo="Nome do ponto" htmlFor={`nome-${ponto.id}`}>
            <Input
              id={`nome-${ponto.id}`}
              maxLength={80}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </Campo>
          <div className="flex gap-2">
            <Button type="submit">Salvar</Button>
            <Button
              type="button"
              variante="secundario"
              onClick={() => {
                setNome(ponto.area)
                setEditando(false)
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">
            {String(ponto.numero).padStart(2, '0')} · {ponto.area}
          </p>
          {aberta && ponto.ponto_id && (
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-lg border border-borda"
                aria-label={`Mudar o nome de ${ponto.area}`}
                onClick={() => setEditando(true)}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="flex size-10 items-center justify-center rounded-lg border border-borda text-perigo"
                aria-label={`Tirar ${ponto.area}`}
                onClick={tirar}
              >
                <X className="size-4" aria-hidden />
              </button>
            </span>
          )}
        </div>
      )}
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
