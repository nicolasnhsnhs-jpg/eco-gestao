import {
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  Download,
  FileText,
  LoaderCircle,
  MapPin,
  RotateCcw,
} from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { useUrlMidia, type Mensagem } from './api'

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Texto com os links clicáveis (só http/https). */
function TextoComLinks({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/[^\s<>"]+)/g)
  return (
    <>
      {partes.map((parte, i) =>
        /^https?:\/\//.test(parte) ? (
          <a
            key={i}
            href={parte}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-verde underline"
          >
            {parte}
          </a>
        ) : (
          <Fragment key={i}>{parte}</Fragment>
        ),
      )}
    </>
  )
}

function tamanho(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

function Midia({ m }: { m: Mensagem }) {
  const url = useUrlMidia(m)
  if (url.isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-texto-suave">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Carregando arquivo…
      </div>
    )
  }
  if (url.isError || !url.data) {
    return (
      <button
        type="button"
        onClick={() => void url.refetch()}
        className="flex items-center gap-2 py-2 text-sm text-perigo"
      >
        <CircleAlert className="size-4" aria-hidden />
        Arquivo indisponível. Tocar para tentar de novo.
      </button>
    )
  }
  const link = url.data
  const nome = m.midia_nome ?? 'arquivo'

  switch (m.tipo) {
    case 'imagem':
    case 'figurinha':
      return (
        <a href={link} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={link}
            alt={m.texto ?? 'Foto enviada na conversa'}
            className={cn(
              'rounded-lg object-cover',
              m.tipo === 'figurinha' ? 'size-32' : 'max-h-80 w-full',
            )}
            loading="lazy"
          />
        </a>
      )
    case 'audio':
      return (
        <div className="space-y-1">
          <audio controls preload="metadata" src={link} className="w-64 max-w-full" />
          {/* Áudio de voz do WhatsApp é OGG/Opus: se o navegador não tocar, dá para baixar. */}
          <a href={link} download className="block text-xs text-texto-suave underline">
            Baixar áudio
          </a>
        </div>
      )
    case 'video':
      return (
        <video
          controls
          playsInline
          preload="metadata"
          src={link}
          className="max-h-80 w-full rounded-lg"
        />
      )
    default:
      return (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-borda bg-white/70 p-2 hover:bg-white"
        >
          <FileText className="size-8 shrink-0 text-verde" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{nome}</span>
            <span className="text-xs text-texto-suave">{tamanho(m.midia_tamanho)}</span>
          </span>
          <Download className="size-5 shrink-0 text-texto-suave" aria-hidden />
        </a>
      )
  }
}

function Localizacao({ texto }: { texto: string }) {
  const linhas = texto.split('\n')
  const coordenadas = linhas[linhas.length - 1]
  return (
    <a
      href={`https://www.google.com/maps?q=${encodeURIComponent(coordenadas)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2 text-verde underline"
    >
      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="whitespace-pre-wrap">
        {linhas.length > 1 ? linhas.slice(0, -1).join('\n') : 'Ver localização no mapa'}
      </span>
    </a>
  )
}

const ICONE_STATUS: Record<string, { icone: ReactNode; rotulo: string }> = {
  pendente: { icone: <Clock className="size-3.5" aria-hidden />, rotulo: 'Enviando' },
  enviada: { icone: <Check className="size-3.5" aria-hidden />, rotulo: 'Enviada' },
  entregue: { icone: <CheckCheck className="size-3.5" aria-hidden />, rotulo: 'Entregue' },
  lida: { icone: <CheckCheck className="size-3.5 text-sky-600" aria-hidden />, rotulo: 'Lida' },
  falhou: { icone: <CircleAlert className="size-3.5 text-perigo" aria-hidden />, rotulo: 'Falhou' },
}

type Props = {
  m: Mensagem
  /** Nome de quem da equipe enviou (só nas mensagens enviadas). */
  autor?: string
  /** Mensagem citada (quando o cliente responde uma mensagem específica). */
  citada?: Mensagem
  aoTentarDeNovo?: () => void
}

export function Bolha({ m, autor, citada, aoTentarDeNovo }: Props) {
  const saida = m.direcao === 'saida'
  const temMidia = !!(m.midia_caminho || m.midia_id)
  const status = saida ? ICONE_STATUS[m.status] : null

  if (m.tipo === 'reacao') {
    return (
      <p className="text-center text-xs text-texto-suave">
        {saida ? 'Você reagiu' : 'O cliente reagiu'} com {m.texto ?? '—'} · {hora(m.enviada_em)}
      </p>
    )
  }

  return (
    <div className={cn('flex', saida ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[70%]',
          saida ? 'rounded-br-md bg-lima-claro' : 'rounded-bl-md bg-white',
          m.status === 'falhou' && 'ring-1 ring-perigo/40',
        )}
      >
        {saida && autor && (
          <p className="mb-0.5 text-xs font-semibold text-verde-escuro">{autor}</p>
        )}
        {citada && (
          <div className="mb-1 rounded-lg border-l-4 border-verde bg-black/5 px-2 py-1 text-xs text-texto-suave">
            <p className="line-clamp-2">{citada.texto ?? 'Arquivo'}</p>
          </div>
        )}
        {temMidia && (
          <div className={cn(m.texto && 'mb-1')}>
            <Midia m={m} />
          </div>
        )}
        {m.texto &&
          (m.tipo === 'localizacao' ? (
            <Localizacao texto={m.texto} />
          ) : (
            <p className="text-[15px] leading-snug break-words whitespace-pre-wrap">
              <TextoComLinks texto={m.texto} />
            </p>
          ))}
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-texto-suave">
          {hora(m.enviada_em)}
          {status && (
            <span title={status.rotulo} aria-label={status.rotulo}>
              {status.icone}
            </span>
          )}
        </p>
        {m.status === 'falhou' && (
          <div className="mt-1 border-t border-perigo/20 pt-1 text-xs text-perigo">
            <p>{m.erro ?? 'A mensagem não foi enviada.'}</p>
            {aoTentarDeNovo && (
              <button
                type="button"
                onClick={aoTentarDeNovo}
                className="mt-1 inline-flex items-center gap-1 font-semibold underline"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Tentar de novo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
