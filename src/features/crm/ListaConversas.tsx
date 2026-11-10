import { Bell, BellRing, MessageCircle, Search, WifiOff, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'

import { Input } from '@/components/ui/Campo'
import { Carregando } from '@/components/ui/Carregando'
import { Aviso } from '@/components/ui/Aviso'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { useConversas, useEstadoConexaoCrm, useEtiquetas, type Conversa } from './api'
import { Avatar, CorEtiqueta } from './componentes'
import { situacaoDoAparelho } from './push'
import {
  filtrarConversas,
  filtrosDoPapel,
  horaNaLista,
  NOME_FILTRO,
  NOME_SETOR,
  nomeDoContato,
  type Filtro,
} from './regras'

const CHAVE_FILTRO = 'crm-filtro'

function filtroGuardado(validos: Filtro[]): Filtro {
  try {
    const f = localStorage.getItem(CHAVE_FILTRO) as Filtro | null
    if (f && validos.includes(f)) return f
  } catch {
    // Sem acesso ao armazenamento do navegador: usa o padrão.
  }
  return 'abertas'
}

/** Coluna da esquerda: busca, filtros e a lista de conversas. */
export function ListaConversas() {
  const perfil = usePerfil()
  const filtros = filtrosDoPapel(perfil.papel)
  const [filtro, setFiltro] = useState<Filtro>(() => filtroGuardado(filtros))
  const [busca, setBusca] = useState('')
  const conversas = useConversas()
  const conexao = useEstadoConexaoCrm()

  const escolher = (f: Filtro) => {
    setFiltro(f)
    try {
      localStorage.setItem(CHAVE_FILTRO, f)
    } catch {
      // Sem problema: só não lembra na próxima vez.
    }
  }

  const todas = conversas.data ?? []
  const lista = filtrarConversas(todas, filtro, busca, perfil.id)
  const contagem = (f: Filtro) => filtrarConversas(todas, f, '', perfil.id).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-borda bg-white px-4 pt-4 pb-3 lg:px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Atendimento</h1>
          {conexao === 'reconectando' && (
            <span
              className="flex items-center gap-1 text-xs font-semibold text-alerta"
              role="status"
            >
              <WifiOff className="size-4" aria-hidden />
              Reconectando…
            </span>
          )}
          <Link
            to="/crm/notificacoes"
            className="ml-auto grid size-11 place-items-center rounded-xl text-verde-escuro hover:bg-lima-claro"
            aria-label="Notificações deste aparelho"
            title="Notificações"
          >
            <Bell className="size-5" aria-hidden />
          </Link>
        </div>
        <ConviteNotificacoes />
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-3 left-3 size-5 text-texto-suave"
            aria-hidden
          />
          <Input
            type="search"
            className="pl-10"
            placeholder="Buscar por nome ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar conversa"
          />
        </div>
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          role="tablist"
          aria-label="Filtros"
        >
          {filtros.map((f) => {
            const total = f === 'todas' || f === 'finalizadas' ? null : contagem(f)
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filtro === f}
                onClick={() => escolher(f)}
                className={cn(
                  'flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition-colors',
                  filtro === f
                    ? 'border-verde bg-verde text-white'
                    : 'border-borda bg-white text-texto-suave hover:bg-lima-claro',
                )}
              >
                {NOME_FILTRO[f]}
                {!!total && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs',
                      filtro === f ? 'bg-white/25' : 'bg-fundo-suave',
                    )}
                  >
                    {total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-white lg:overflow-y-auto">
        {conversas.isPending ? (
          <Carregando />
        ) : conversas.isError ? (
          <div className="p-4">
            <Aviso tipo="erro">{mensagemDeErro(conversas.error)}</Aviso>
          </div>
        ) : lista.length === 0 ? (
          <ListaVazia semNenhuma={todas.length === 0} filtro={filtro} buscando={!!busca.trim()} />
        ) : (
          <ul className="divide-y divide-borda">
            {lista.map((c) => (
              <li key={c.id}>
                <ItemConversa conversa={c} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ItemConversa({ conversa: c }: { conversa: Conversa }) {
  const nome = nomeDoContato(c.contato)
  const etiquetas = useEtiquetas().data ?? []
  const minhasEtiquetas = etiquetas.filter((e) => c.etiquetas.some((x) => x.etiqueta_id === e.id))
  const naoLida = c.nao_lidas > 0

  return (
    <NavLink
      to={`/crm/${c.id}`}
      className={({ isActive }) =>
        cn(
          'flex gap-3 px-4 py-3 transition-colors',
          isActive ? 'bg-lima-claro' : 'hover:bg-fundo-suave',
        )
      }
    >
      <Avatar nome={nome} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('truncate text-texto', naoLida ? 'font-bold' : 'font-semibold')}>
            {nome}
          </p>
          <span
            className={cn(
              'shrink-0 text-xs',
              naoLida ? 'font-bold text-verde' : 'text-texto-suave',
            )}
          >
            {horaNaLista(c.ultima_mensagem_em)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'truncate text-sm',
              naoLida ? 'font-semibold text-texto' : 'text-texto-suave',
            )}
          >
            {c.ultima_mensagem_previa ?? ' '}
          </p>
          {naoLida && (
            <span
              className="grid min-w-5 shrink-0 place-items-center rounded-full bg-verde px-1.5 text-xs leading-5 font-bold text-white"
              aria-label={`${c.nao_lidas} não lida(s)`}
            >
              {c.nao_lidas > 99 ? '99+' : c.nao_lidas}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-texto-suave">
          {c.status !== 'aberta' && (
            <span
              className={cn(
                'rounded-full px-2 font-semibold',
                c.status === 'pendente' ? 'bg-amber-50 text-alerta' : 'bg-fundo-suave',
              )}
            >
              {c.status === 'pendente' ? 'Pendente' : 'Finalizada'}
            </span>
          )}
          <span className={cn(!c.responsavel && 'font-semibold text-verde-escuro')}>
            {c.responsavel?.nome ?? 'Primeiro contato'}
          </span>
          {c.setor && <span>· {NOME_SETOR[c.setor]}</span>}
          {minhasEtiquetas.map((e) => (
            <CorEtiqueta key={e.id} etiqueta={e} pequena />
          ))}
        </div>
      </div>
    </NavLink>
  )
}

function ListaVazia({
  semNenhuma,
  filtro,
  buscando,
}: {
  semNenhuma: boolean
  filtro: Filtro
  buscando: boolean
}) {
  return (
    <div className="px-6 py-12 text-center text-texto-suave">
      <MessageCircle className="mx-auto mb-3 size-10" aria-hidden />
      {semNenhuma ? (
        <p>
          Nenhuma conversa ainda. Quando um cliente mandar mensagem para o WhatsApp da empresa, ela
          aparece aqui.
        </p>
      ) : buscando ? (
        <p>Nenhuma conversa encontrada com essa busca.</p>
      ) : (
        <p>Nenhuma conversa em “{NOME_FILTRO[filtro]}”.</p>
      )}
    </div>
  )
}

const CHAVE_CONVITE = 'crm-convite-notificacoes-fechado'

/** Lembrete para ligar as notificações neste aparelho (some quando já estão ligadas). */
function ConviteNotificacoes() {
  const [fechado, setFechado] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_CONVITE) === '1'
    } catch {
      return false
    }
  })
  const s = situacaoDoAparelho()
  if (fechado || s.permissao === 'granted' || (!s.suportaPush && !s.ios)) return null
  const fechar = () => {
    setFechado(true)
    try {
      localStorage.setItem(CHAVE_CONVITE, '1')
    } catch {
      // Só volta a aparecer na próxima vez.
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-borda bg-lima-claro px-3 py-2 text-sm">
      <BellRing className="size-5 shrink-0 text-verde-escuro" aria-hidden />
      <Link to="/crm/notificacoes" className="flex-1 font-semibold text-verde-escuro">
        Ative as notificações para saber quando um cliente chamar.
      </Link>
      <button
        type="button"
        onClick={fechar}
        className="grid size-9 place-items-center rounded-lg text-texto-suave hover:bg-white"
        aria-label="Fechar lembrete"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
