import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CircleCheck, Megaphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { Modal } from '@/components/ui/Modal'
import { formatarData, hojeISO, somarDias } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { usePerfil } from '../../auth/useAuth'
import { osAberta, useOrdensServico } from '../api'
import { useBaixarOsDoDia } from '../offline/baixar'
import { CartaoOs } from '../OsListaPage'
import { avisosDasOs, chavesDosAvisos, temAvisoNovo, type AvisoDaOs } from './avisosGerais'
import {
  diasComOs,
  moverNaOrdem,
  ordemComODia,
  ordenarPelaEscolha,
  osDoDia,
  useOrdemDoOperador,
} from './ordemOs'

const CHAVE_AVISOS_VISTOS = 'eco-os-avisos-vistos'

/** Até quantos dias para trás e para frente o operador navega. */
const DIAS_ATRAS = 7
const DIAS_FRENTE = 30

/** "2026-11-27" → { semana: "sex", data: "27/11" } */
function partesDoDia(dia: string) {
  const dt = new Date(`${dia}T12:00:00`)
  return {
    semana: dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
    semanaLonga: dt.toLocaleDateString('pt-BR', { weekday: 'long' }),
    data: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }
}

/** Avisos já lidos nesta abertura do app (some ao fechar o app). */
function avisosVistos(): string[] {
  try {
    const lidos: unknown = JSON.parse(sessionStorage.getItem(CHAVE_AVISOS_VISTOS) ?? '[]')
    return Array.isArray(lidos) ? lidos.filter((c): c is string => typeof c === 'string') : []
  } catch {
    return []
  }
}

/**
 * Início do operador: as OS dele, um dia de cada vez (abre em hoje, como a agenda).
 * Hoje mostra também as atrasadas que seguem abertas; as setas e os dias com OS
 * levam a outro dia. O banco só devolve as OS atribuídas a ele. As do dia ficam
 * guardadas no celular para trabalhar sem internet.
 *
 * - Ao abrir, mostra numa caixa tudo o que o escritório pediu nas OS dele.
 * - Ele põe as OS na ordem que quiser; a ordem não muda ao concluir: a feita fica
 *   no mesmo lugar, marcada. Concluídas aparecem só as terminadas hoje.
 */
export function MinhasOsPage() {
  const perfil = usePerfil()
  const hoje = hojeISO()
  const lista = useOrdensServico({
    de: somarDias(hoje, -DIAS_ATRAS),
    ate: somarDias(hoje, DIAS_FRENTE),
  })
  const { ordem, salvarOrdem } = useOrdemDoOperador(perfil.id)
  const [organizando, setOrganizando] = useState(false)

  // O dia escolhido fica no endereço: voltar de uma OS cai no mesmo dia.
  const [params, setParams] = useSearchParams()
  const pedido = params.get('dia') ?? ''
  const primeiro = somarDias(hoje, -DIAS_ATRAS)
  const ultimo = somarDias(hoje, DIAS_FRENTE)
  const dia =
    /^\d{4}-\d{2}-\d{2}$/.test(pedido) && pedido >= primeiro && pedido <= ultimo ? pedido : hoje
  const irPara = (d: string) => {
    setOrganizando(false)
    setParams(d === hoje ? {} : { dia: d }, { replace: true })
  }

  // Hoje: as de hoje, as atrasadas abertas e as concluídas hoje. Outro dia: só as dele.
  const visiveis = useMemo(
    () => ordenarPelaEscolha(osDoDia(lista.data ?? [], dia, hoje), ordem),
    [lista.data, ordem, dia, hoje],
  )
  const proximosDias = useMemo(() => diasComOs(lista.data ?? [], hoje), [lista.data, hoje])
  const faltam = visiveis.filter((os) => osAberta(os.status)).length

  const avisos = useMemo(() => avisosDasOs(lista.data ?? []), [lista.data])
  const [avisosAbertos, setAvisosAbertos] = useState(false)
  // Abre sozinho ao entrar, e de novo só quando o escritório escrever algo novo.
  useEffect(() => {
    if (temAvisoNovo(avisos, avisosVistos())) setAvisosAbertos(true)
  }, [avisos])
  const fecharAvisos = () => {
    try {
      const todos = new Set([...avisosVistos(), ...chavesDosAvisos(avisos)])
      sessionStorage.setItem(CHAVE_AVISOS_VISTOS, JSON.stringify([...todos]))
    } catch {
      // sem acesso: volta a aparecer ao abrir o Início
    }
    setAvisosAbertos(false)
  }

  const mover = (id: string, direcao: -1 | 1) =>
    salvarOrdem(
      ordemComODia(
        ordem,
        moverNaOrdem(
          visiveis.map((os) => os.id),
          id,
          direcao,
        ),
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
            Avisos do escritório ({avisos.length} OS)
            <span className="block text-sm font-normal text-texto-suave">Toque para ler</span>
          </span>
        </button>
      )}

      {/* Um dia de cada vez: setas e os dias que têm OS. */}
      <div className="mb-2 flex items-center gap-2">
        <Button
          variante="secundario"
          aria-label="Dia anterior"
          disabled={dia <= primeiro}
          onClick={() => irPara(somarDias(dia, -1))}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <p className="flex-1 text-center">
          <span className="block font-titulo text-lg font-bold text-verde-escuro capitalize">
            {dia === hoje
              ? 'Hoje'
              : dia === somarDias(hoje, 1)
                ? 'Amanhã'
                : dia === somarDias(hoje, -1)
                  ? 'Ontem'
                  : partesDoDia(dia).semanaLonga}
          </span>
          <span className="text-sm text-texto-suave">{formatarData(dia)}</span>
        </p>
        <Button
          variante="secundario"
          aria-label="Próximo dia"
          disabled={dia >= ultimo}
          onClick={() => irPara(somarDias(dia, 1))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>
      {proximosDias.length > 1 && (
        <nav aria-label="Dias com OS" className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {proximosDias.map(({ dia: d, qtd }) => {
            const ativo = d === dia
            const p = partesDoDia(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => irPara(d)}
                aria-current={ativo ? 'date' : undefined}
                className={cn(
                  'flex min-w-[4.6rem] shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 text-center',
                  ativo
                    ? 'border-verde bg-verde text-white'
                    : 'border-lima bg-lima-claro text-verde-escuro hover:border-verde',
                )}
              >
                <span className="text-[11px] font-bold tracking-wider uppercase">
                  {d === hoje ? 'Hoje' : p.semana}
                </span>
                <span className="text-base leading-tight font-extrabold">{p.data}</span>
                <span className={cn('text-[11px] font-semibold', ativo && 'text-white/85')}>
                  {qtd === 1 ? '1 OS' : `${qtd} OS`}
                </span>
              </button>
            )
          })}
        </nav>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-titulo text-lg font-bold text-verde-escuro">
          {dia === hoje ? 'Suas OS de hoje' : `Suas OS de ${formatarData(dia).slice(0, 5)}`}
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
          {dia === hoje ? 'Nenhuma OS para fazer hoje.' : 'Nenhuma OS neste dia.'}
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
