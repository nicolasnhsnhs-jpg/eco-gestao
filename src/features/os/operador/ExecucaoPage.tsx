import { CheckCircle2, CloudOff, MapPin, Phone, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Assinatura } from '@/components/ui/Assinatura'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Card } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Etiqueta } from '@/components/ui/Etiqueta'
import { formatarData, hojeISO } from '@/lib/datas'
import { formatarTelefone } from '@/lib/documentos'
import { mensagemDeErro } from '@/lib/erros'

import { pendenteDaOs, useFila } from '../offline/fila'
import { FotosOs } from '../offline/FotosOs'
import { pendenciasLocais } from '../offline/pendencias'
import {
  enderecoDaFicha,
  enviarAssinatura,
  fichaDaOs,
  NOME_STATUS_OS,
  osAberta,
  useConcluirOs,
  useIniciarOs,
  useOrdemServico,
  useVeiculos,
  type CamposExecucao,
  type OsCompleta,
} from '../api'
import { usePontosOs } from '../pragasApi'
import { ETAPAS_COIFA } from '../tipos/coifa'
import { quantasEtapasPragas } from '../tipos/pragas'
import { ExecucaoCoifa } from './ExecucaoCoifa'
import { ExecucaoPragas } from './ExecucaoPragas'
import { useRascunhoExecucao, type EstadoEnvio } from './rascunho'

type CampoHora = 'hora_chegada' | 'hora_inicio' | 'hora_termino' | 'hora_saida'

const HORARIOS: { campo: CampoHora; rotulo: string }[] = [
  { campo: 'hora_chegada', rotulo: 'Chegada' },
  { campo: 'hora_inicio', rotulo: 'Início' },
  { campo: 'hora_termino', rotulo: 'Término' },
  { campo: 'hora_saida', rotulo: 'Saída' },
]

/** "2026-11-05T11:10:00Z" → "08:10" (horário de Brasília). */
function horaDe(valor: string | null | undefined) {
  if (!valor) return ''
  return new Date(valor).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

/** Data + "08:10" → horário completo (o Brasil não tem mais horário de verão). */
function comporHora(data: string, hora: string) {
  return `${data}T${hora}:00-03:00`
}

export function ExecucaoPage() {
  const { id = '' } = useParams()
  const os = useOrdemServico(id)

  if (os.isPending) return <Carregando />
  if (os.isError) return <Aviso tipo="erro">{mensagemDeErro(os.error)}</Aviso>
  if (!os.data || !os.data.execucao) return <Aviso tipo="erro">OS não encontrada.</Aviso>
  return <Execucao key={os.data.id} os={os.data} />
}

function Execucao({ os }: { os: OsCompleta }) {
  const navigate = useNavigate()
  const execucao = os.execucao!
  const aberta = osAberta(os.status)
  const ficha = fichaDaOs(os.ficha_cliente)
  const veiculos = useVeiculos()
  const iniciar = useIniciarOs(os.id)
  const concluir = useConcluirOs(os.id)
  const { campos, alterar, estado, enviarAgora } = useRascunhoExecucao(os.id, execucao, aberta)
  const [erro, setErro] = useState<string | null>(null)
  const [assinando, setAssinando] = useState<'cliente' | 'operador' | null>(null)
  const dataServico = campos.data ?? hojeISO()
  const pragas = os.tipo?.formulario_os === 'pragas'
  const pontos = usePontosOs(os.id)
  // Etapas: 1 chegada, depois as do tipo de serviço, depois fotos, cliente e operador.
  const coifa = os.tipo?.formulario_os === 'coifa'
  const fila = useFila()
  const aguardandoEnvio = pendenteDaOs(fila, os.id).length > 0
  const depois = 2 + (pragas ? quantasEtapasPragas(os, pontos.data) : coifa ? ETAPAS_COIFA : 1)

  async function registrarAgora(campo: CampoHora) {
    setErro(null)
    if (os.status === 'agendada') {
      try {
        await iniciar.mutateAsync()
      } catch (e) {
        setErro(mensagemDeErro(e))
        return
      }
    }
    alterar({ [campo]: new Date().toISOString(), data: campos.data ?? hojeISO() })
  }

  async function assinar(quem: 'cliente' | 'operador', imagem: Blob) {
    setErro(null)
    setAssinando(quem)
    try {
      const arquivoId = await enviarAssinatura(os.cliente_id, os.id, imagem, quem)
      alterar(
        quem === 'cliente'
          ? { assinatura_cliente_id: arquivoId }
          : { assinatura_operador_id: arquivoId },
      )
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setAssinando(null)
    }
  }

  async function finalizar() {
    setErro(null)
    // Confere no próprio celular (funciona sem sinal); o banco confere de novo ao receber.
    const falta = pendenciasLocais(os.tipo?.formulario_os, campos, pontos.data ?? [])
    if (falta.length > 0) {
      setErro(`Falta preencher: ${falta.join(', ')}.`)
      return
    }
    // Tenta mandar agora o que foi digitado; sem sinal, vai junto com a conclusão.
    void enviarAgora()
    try {
      await concluir.mutateAsync()
      navigate('/', { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const campo = (nome: keyof CamposExecucao) => (campos[nome] as string | null | undefined) ?? ''

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 pb-24">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-titulo text-2xl font-bold text-verde-escuro">{os.tipo?.nome}</h1>
        <Etiqueta cor={aberta ? 'alerta' : 'verde'}>{NOME_STATUS_OS[os.status]}</Etiqueta>
        <IndicadorEnvio estado={estado} />
      </div>
      <p className="-mt-3 text-sm text-texto-suave">
        {os.numero} · {formatarData(os.data_agendada)}
        {os.hora_agendada && ` às ${os.hora_agendada.slice(0, 5)}`}
      </p>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {!aberta &&
        (aguardandoEnvio ? (
          <Aviso tipo="info">
            Concluída no celular, aguardando envio. Ela sobe sozinha quando houver sinal.
          </Aviso>
        ) : (
          <Aviso tipo="sucesso">OS concluída. Para mudar algo, fale com o escritório.</Aviso>
        ))}

      {/* Escopo: o que o escritório combinou (só leitura) */}
      <Card className="flex flex-col gap-2">
        <p className="text-lg font-semibold">
          {ficha.nome_fantasia || ficha.nome}
          {ficha.unidade?.apelido && ` · ${ficha.unidade.apelido}`}
        </p>
        {ficha.unidade && (
          <a
            className="flex min-h-11 items-center gap-2 text-verde underline"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoDaFicha(ficha))}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin className="size-5 shrink-0" aria-hidden /> {enderecoDaFicha(ficha)}
          </a>
        )}
        {ficha.contatos?.map((c) => (
          <p key={`${c.nome}-${c.telefone}`} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{c.nome}</span>
            {c.cargo && <span className="text-texto-suave">({c.cargo})</span>}
            {c.telefone && (
              <a
                className="flex min-h-11 items-center gap-1 text-verde underline"
                href={`tel:${c.telefone}`}
              >
                <Phone className="size-4" aria-hidden /> {formatarTelefone(c.telefone)}
              </a>
            )}
          </p>
        ))}
        {os.observacoes_adm && (
          <div className="rounded-xl bg-alerta/10 p-3">
            <p className="text-sm font-semibold">Observações do escritório</p>
            <p className="whitespace-pre-line">{os.observacoes_adm}</p>
          </div>
        )}
        {os.descricao && (
          <div>
            <p className="text-sm font-semibold">Serviço a fazer</p>
            <p className="whitespace-pre-line">{os.descricao}</p>
          </div>
        )}
      </Card>

      <Etapa numero={1} titulo="Chegada e horários">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data" htmlFor="ex-data">
            <Input
              id="ex-data"
              type="date"
              disabled={!aberta}
              value={campo('data')}
              onChange={(e) => alterar({ data: e.target.value || null })}
            />
          </Campo>
          <Campo rotulo="KM na chegada" htmlFor="ex-km">
            <Input
              id="ex-km"
              inputMode="numeric"
              disabled={!aberta}
              value={campos.km_chegada?.toString() ?? ''}
              onChange={(e) => {
                const digitos = e.target.value.replace(/\D/g, '')
                alterar({ km_chegada: digitos ? Number(digitos) : null })
              }}
            />
          </Campo>
        </div>
        <Campo rotulo="Veículo" htmlFor="ex-veiculo">
          <Select
            id="ex-veiculo"
            disabled={!aberta}
            value={campo('veiculo_id')}
            onChange={(e) => alterar({ veiculo_id: e.target.value || null })}
          >
            <option value="">Escolha…</option>
            {veiculos.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} · {v.descricao}
              </option>
            ))}
          </Select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          {HORARIOS.map(({ campo: nome, rotulo }) => (
            <div key={nome} className="flex flex-col gap-1">
              <label htmlFor={`ex-${nome}`} className="font-semibold">
                {rotulo}
              </label>
              {campos[nome] || !aberta ? (
                <Input
                  id={`ex-${nome}`}
                  type="time"
                  disabled={!aberta}
                  value={horaDe(campos[nome])}
                  onChange={(e) =>
                    alterar({
                      [nome]: e.target.value ? comporHora(dataServico, e.target.value) : null,
                    })
                  }
                />
              ) : (
                <Button id={`ex-${nome}`} type="button" onClick={() => void registrarAgora(nome)}>
                  Registrar agora
                </Button>
              )}
            </div>
          ))}
        </div>
      </Etapa>

      {pragas ? (
        <ExecucaoPragas os={os} campos={campos} alterar={alterar} aberta={aberta} primeira={2} />
      ) : coifa ? (
        <ExecucaoCoifa os={os} campos={campos} alterar={alterar} aberta={aberta} primeira={2} />
      ) : (
        <Etapa numero={2} titulo="Serviço realizado">
          <Campo rotulo="Resultado" htmlFor="ex-resultado" obrigatorio>
            <Textarea
              id="ex-resultado"
              rows={4}
              disabled={!aberta}
              value={campo('resultado')}
              onChange={(e) => alterar({ resultado: e.target.value })}
            />
          </Campo>
          <Campo rotulo="Observações" htmlFor="ex-observacoes">
            <Textarea
              id="ex-observacoes"
              rows={3}
              disabled={!aberta}
              value={campo('observacoes')}
              onChange={(e) => alterar({ observacoes: e.target.value })}
            />
          </Campo>
        </Etapa>
      )}

      <Etapa numero={depois} titulo="Fotos">
        <FotosOs clienteId={os.cliente_id} osId={os.id} aberta={aberta} />
      </Etapa>

      <Etapa numero={depois + 1} titulo="Quem acompanhou (cliente)">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Nome" htmlFor="ex-resp-nome" obrigatorio>
            <Input
              id="ex-resp-nome"
              disabled={!aberta}
              value={campo('responsavel_nome')}
              onChange={(e) => alterar({ responsavel_nome: e.target.value })}
            />
          </Campo>
          <Campo rotulo="Setor" htmlFor="ex-resp-setor">
            <Input
              id="ex-resp-setor"
              disabled={!aberta}
              value={campo('responsavel_setor')}
              onChange={(e) => alterar({ responsavel_setor: e.target.value })}
            />
          </Campo>
        </div>
        <QuadroAssinatura
          titulo="Assinatura de quem acompanhou"
          feita={!!campos.assinatura_cliente_id}
          aberta={aberta}
          ocupado={assinando === 'cliente'}
          aoConfirmar={(img) => assinar('cliente', img)}
          aoRefazer={() => alterar({ assinatura_cliente_id: null })}
        />
      </Etapa>

      <Etapa numero={depois + 2} titulo="Operador">
        <Campo rotulo="Seu nome completo" htmlFor="ex-operador" obrigatorio>
          <Input
            id="ex-operador"
            disabled={!aberta}
            value={campo('operador_nome')}
            onChange={(e) => alterar({ operador_nome: e.target.value })}
          />
        </Campo>
        <QuadroAssinatura
          titulo="Seu visto"
          feita={!!campos.assinatura_operador_id}
          aberta={aberta}
          ocupado={assinando === 'operador'}
          aoConfirmar={(img) => assinar('operador', img)}
          aoRefazer={() => alterar({ assinatura_operador_id: null })}
        />
      </Etapa>

      {aberta && (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t border-borda bg-white/95 p-3 lg:bottom-0">
          <div className="mx-auto max-w-xl">
            <Button
              className="w-full"
              onClick={() => void finalizar()}
              disabled={concluir.isPending}
            >
              <CheckCircle2 className="size-5" aria-hidden />
              {concluir.isPending ? 'Concluindo…' : 'Concluir OS'}
            </Button>
          </div>
        </div>
      )}
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

function QuadroAssinatura({
  titulo,
  feita,
  aberta,
  ocupado,
  aoConfirmar,
  aoRefazer,
}: {
  titulo: string
  feita: boolean
  aberta: boolean
  ocupado: boolean
  aoConfirmar: (imagem: Blob) => Promise<void>
  aoRefazer: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">
        {titulo} <span className="text-perigo">*</span>
      </p>
      {feita ? (
        <div className="flex items-center gap-3">
          <Etiqueta cor="verde">Assinado</Etiqueta>
          {aberta && (
            <Button type="button" variante="fantasma" onClick={aoRefazer}>
              Refazer
            </Button>
          )}
        </div>
      ) : aberta ? (
        <Assinatura aoConfirmar={aoConfirmar} ocupado={ocupado} />
      ) : (
        <p className="text-texto-suave">Sem assinatura.</p>
      )}
    </div>
  )
}

function IndicadorEnvio({ estado }: { estado: EstadoEnvio }) {
  if (estado === 'enviado') return <Etiqueta cor="verde">Salvo</Etiqueta>
  if (estado === 'enviando')
    return (
      <span className="flex items-center gap-1 text-sm text-texto-suave">
        <RefreshCw className="size-4 animate-spin" aria-hidden /> Enviando…
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-sm text-alerta">
      <CloudOff className="size-4" aria-hidden /> Salvo no celular
    </span>
  )
}
