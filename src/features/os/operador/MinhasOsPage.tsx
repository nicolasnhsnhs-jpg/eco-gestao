import { ArrowDown, ArrowUp, CircleCheck, Megaphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'

import { usePerfil } from '../../auth/useAuth'
import { osAberta, useOrdensServico } from '../api'
import { useBaixarOsDoDia } from '../offline/baixar'
import { CartaoOs } from '../OsListaPage'
import { assinaturaDosAvisos, avisosDasOs, type AvisoDaOs } from './avisosGerais'
import { moverNaOrdem, ordenarPelaEscolha, useOrdemDoOperador } from './ordemOs'

const CHAVE_AVISOS_VISTOS = 'eco-os-avisos-vistos'

/**
 * Início do operador: as OS dele, da semana passada (para terminar o que ficou
 * aberto) até os próximos 7 dias. O banco só devolve as OS atribuídas a ele.
 * As do dia ficam guardadas no celular para trabalhar sem internet.
 *
 * - Ao abrir, mostra numa caixa tudo o que o escritório pediu nas OS dele.
 * - Ele põe as OS na ordem que quiser; a ordem não muda ao concluir: a feita fica
 *   no mesmo lugar, marcada. Concluídas aparecem só as terminadas hoje.
 */
export function MinhasOsPage() {
  const perfil = usePerfil()
  const hoje = hojeISO()
  const lista = useOrdensServico({ de: somarDias(hoje, -7), ate: somarDias(hoje, 7) })
  const { ordem, salvarOrdem } = useOrdemDoOperador(perfil.id)
  const [organizando, setOrganizando] = useState(false)

  // Abertas + concluídas hoje (passou da meia-noite, as concluídas saem).
  const visiveis = useMemo(() => {
    const doDia = (lista.data ?? []).filter(
      (os) =>
        osAberta(os.status) ||
        (os.status !== 'cancelada' &&
          (os.concluida_em ? hojeISO(new Date(os.concluida_em)) : os.data_agendada) === hoje),
    )
    return ordenarPelaEscolha(doDia, ordem)
  }, [lista.data, ordem, hoje])
  const faltam = visiveis.filter((os) => osAberta(os.status)).length

  const avisos = useMemo(() => avisosDasOs(lista.data ?? []), [lista.data])
  const [avisosAbertos, setAvisosAbertos] = useState(false)
  // Abre sozinho ao entrar, e de novo só quando o escritório escrever algo novo.
  useEffect(() => {
    if (avisos.length === 0) return
    const assinatura = assinaturaDosAvisos(avisos)
    let vista: string | null = null
    try {
      vista = sessionStorage.getItem(CHAVE_AVISOS_VISTOS)
    } catch {
      // sem acesso: mostra
    }
    if (vista !== assinatura) setAvisosAbertos(true)
  }, [avisos])
  const fecharAvisos = () => {
    try {
      sessionStorage.setItem(CHAVE_AVISOS_VISTOS, assinaturaDosAvisos(avisos))
    } catch {
      // sem acesso: volta a aparecer ao abrir o Início
    }
    setAvisosAbertos(false)
  }

  const mover = (id: string, direcao: -1 | 1) =>
    salvarOrdem(
      moverNaOrdem(
        visiveis.map((os) => os.id),
        id,
        direcao,
      ),
    )

  const { baixadoEm, baixadoHoje, online } = useBaixarOsDoDia(lista.data)
  const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <PageHeader
        titulo={`Olá, ${perfil.nome.split(' ')[0]}!`}
        descricao="Suas ordens de serviço."
      />
      {baixadoEm && baixadoHoje ? (
        <p className="mb-3 rounded-xl bg-lima-claro px-3 py-2 text-sm text-verde-escuro">
          OS do dia guardadas no celular · atualizado às {hora(baixadoEm)}
          {!online && ' · sem internet agora'}
        </p>
      ) : (
        !online && (
          <div className="mb-3">
            <Aviso tipo="erro">
              Sem internet e as OS de hoje ainda não foram baixadas. Abra o app com internet (o
              Wi-Fi de casa serve) antes de sair para o serviço.
            </Aviso>
          </div>
        )
      )}
      {lista.isPending && online && <Carregando />}
      {lista.isError && <Aviso tipo="erro">{mensagemDeErro(lista.error)}</Aviso>}

      {avisos.length > 0 && (
        <button
          type="button"
          onClick={() => setAvisosAbertos(true)}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-alerta/40 bg-amber-50 p-4 text-left font-semibold text-texto"
        >
          <Megaphone className="size-6 shrink-0 text-alerta" aria-hidden />
          <span>
            Avisos do escritório ({avisos.length} {avisos.length === 1 ? 'cliente' : 'clientes'})
            <span className="block text-sm font-normal text-texto-suave">Toque para ler</span>
          </span>
        </button>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">
          Suas OS
          {visiveis.length > 0 && (
            <span className="ml-2 text-sm font-normal text-texto-suave">
              {faltam === 0 ? 'todas feitas' : `faltam ${faltam} de ${visiveis.length}`}
            </span>
          )}
        </h2>
        {visiveis.length > 1 && (
          <Button
            variante={organizando ? 'primario' : 'secundario'}
            onClick={() => setOrganizando((v) => !v)}
          >
            {organizando ? 'Pronto' : 'Mudar a ordem'}
          </Button>
        )}
      </div>
      {organizando && (
        <p className="mb-2 text-sm text-texto-suave">
          Use as setas para pôr as OS na ordem em que vai fazer. A ordem fica guardada.
        </p>
      )}
      {lista.isSuccess && visiveis.length === 0 && (
        <p className="mb-4 rounded-2xl border border-borda bg-white p-6 text-center text-texto-suave">
          Nenhuma OS para fazer agora.
        </p>
      )}
      <ol className="mb-6 flex flex-col gap-2">
        {visiveis.map((os, i) => {
          const feita = !osAberta(os.status)
          return (
            <li key={os.id} className="flex items-stretch gap-2">
              <div className={`relative min-w-0 flex-1 ${feita ? 'opacity-60' : ''}`}>
                {feita && (
                  <span className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-verde px-2 py-0.5 text-xs font-bold text-white">
                    <CircleCheck className="size-4" aria-hidden /> Feita
                  </span>
                )}
                <CartaoOs os={os} para={`/os/${os.id}/executar`} />
              </div>
              {organizando && (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() => mover(os.id, -1)}
                    className="grid w-12 flex-1 place-items-center rounded-xl border border-borda bg-white text-verde-escuro disabled:opacity-30"
                  >
                    <ArrowUp aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Descer"
                    disabled={i === visiveis.length - 1}
                    onClick={() => mover(os.id, 1)}
                    className="grid w-12 flex-1 place-items-center rounded-xl border border-borda bg-white text-verde-escuro disabled:opacity-30"
                  >
                    <ArrowDown aria-hidden />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <Modal aberto={avisosAbertos} aoFechar={fecharAvisos} titulo="Avisos do escritório">
        <AvisosGerais avisos={avisos} aoFechar={fecharAvisos} />
      </Modal>
    </>
  )
}

function AvisosGerais({ avisos, aoFechar }: { avisos: AvisoDaOs[]; aoFechar: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <p className="text-sm text-texto-suave">
        Leia antes de começar. Dentro de cada OS o aviso do cliente aparece de novo.
      </p>
      <ul className="flex flex-col gap-3">
        {avisos.map((a) => (
          <li key={a.osId} className="rounded-xl border border-borda bg-fundo-suave p-3">
            <p>
              <strong className="text-verde-escuro">{a.cliente}:</strong>{' '}
              {a.observacoes && <span className="whitespace-pre-line">{a.observacoes}</span>}
            </p>
            {a.ocorrencias.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {a.ocorrencias.map((texto, i) => (
                  <li key={i}>
                    <strong>Ocorrência:</strong> {texto}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-texto-suave">
              {a.servico}
              {a.servico && ' · '}
              {formatarData(a.data)}
            </p>
          </li>
        ))}
      </ul>
      <Button onClick={aoFechar}>Entendi</Button>
    </div>
  )
}
