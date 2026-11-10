import { ArrowLeft, Clock, Info, LoaderCircle, Paperclip, PanelRight, Send, X } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Carregando } from '@/components/ui/Carregando'
import { mensagemDeErro } from '@/lib/erros'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { useEquipe } from '../clientes/api'
import {
  FalhaCrm,
  useAssumir,
  useConversa,
  useEnviarMensagem,
  useMarcarLida,
  useMensagens,
  type Conversa,
  type Mensagem,
} from './api'
import { Bolha } from './Bolha'
import { Avatar } from './componentes'
import { PainelConversa } from './PainelConversa'
import {
  janelaAberta,
  NOME_SETOR,
  NOME_STATUS,
  nomeDoContato,
  podeTransferir,
  rotuloDoDia,
  telefoneDoWaId,
} from './regras'
import { limparNotificacoesDaConversa } from './push'

export function ConversaView({ conversaId }: { conversaId: string }) {
  const conversa = useConversa(conversaId)
  const [painel, setPainel] = useState(false)

  if (conversa.isPending) return <Carregando />
  if (!conversa.data) {
    return (
      <div className="flex flex-1 flex-col">
        <CabecalhoSimples />
        <div className="p-6">
          <Aviso tipo="info">
            Conversa não encontrada. Ela pode ter sido transferida para outra pessoa.
          </Aviso>
        </div>
      </div>
    )
  }
  const c = conversa.data
  return (
    <>
      <Cabecalho conversa={c} aoAbrirPainel={() => setPainel(true)} />
      <Mensagens conversa={c} />
      <Rodape conversa={c} />
      <PainelConversa conversa={c} aberto={painel} aoFechar={() => setPainel(false)} />
    </>
  )
}

function CabecalhoSimples() {
  return (
    <header className="flex items-center gap-2 border-b border-borda bg-white px-2 pt-[env(safe-area-inset-top)] lg:hidden">
      <Link
        to="/crm"
        className="grid size-11 place-items-center rounded-xl text-verde-escuro"
        aria-label="Voltar para as conversas"
      >
        <ArrowLeft aria-hidden />
      </Link>
    </header>
  )
}

function Cabecalho({
  conversa: c,
  aoAbrirPainel,
}: {
  conversa: Conversa
  aoAbrirPainel: () => void
}) {
  const nome = nomeDoContato(c.contato)
  return (
    <header className="flex items-center gap-2 border-b border-borda bg-white px-2 pt-[env(safe-area-inset-top)] lg:px-4">
      <Link
        to="/crm"
        className="grid size-11 shrink-0 place-items-center rounded-xl text-verde-escuro hover:bg-lima-claro lg:hidden"
        aria-label="Voltar para as conversas"
      >
        <ArrowLeft aria-hidden />
      </Link>
      <button
        type="button"
        onClick={aoAbrirPainel}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 text-left"
      >
        <Avatar nome={nome} compacto />
        <span className="min-w-0">
          <span className="block truncate font-titulo font-bold text-verde-escuro">{nome}</span>
          <span className="block truncate text-xs text-texto-suave">
            {c.contato && telefoneDoWaId(c.contato.wa_id)} · {NOME_STATUS[c.status]}
            {c.responsavel ? ` · ${c.responsavel.nome}` : ' · Primeiro contato'}
            {c.setor && ` · ${NOME_SETOR[c.setor]}`}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={aoAbrirPainel}
        className="grid size-11 shrink-0 place-items-center rounded-xl text-verde-escuro hover:bg-lima-claro"
        aria-label="Cliente, responsável, notas e etiquetas"
        title="Detalhes do atendimento"
      >
        <PanelRight aria-hidden />
      </button>
    </header>
  )
}

function Mensagens({ conversa }: { conversa: Conversa }) {
  const [paginas, setPaginas] = useState(1)
  const consulta = useMensagens(conversa.id, paginas)
  const equipe = useEquipe().data ?? []
  const marcarLida = useMarcarLida()
  const enviar = useEnviarMensagem(conversa.id)
  const fim = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const ultimaVista = useRef<string | null>(null)

  const mensagens = consulta.data?.mensagens ?? []
  const ultima = mensagens[mensagens.length - 1]

  // Mensagem nova (ou abriu a conversa): desce até o fim. Ao carregar as antigas, não.
  useLayoutEffect(() => {
    if (!ultima || ultima.id === ultimaVista.current) return
    const primeiraVez = ultimaVista.current === null
    ultimaVista.current = ultima.id
    const el = area.current
    const pertoDoFim = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 200
    if (primeiraVez || pertoDoFim || ultima.direcao === 'saida') {
      fim.current?.scrollIntoView({ block: 'end' })
    }
  }, [ultima])

  // Abriu ou chegou mensagem com a conversa na tela: marca como lida.
  const { mutate: marcar } = marcarLida
  useEffect(() => {
    if (conversa.nao_lidas > 0 && document.visibilityState === 'visible') marcar(conversa.id)
  }, [conversa.id, conversa.nao_lidas, marcar])

  // Conversa na tela: some com as notificações dela que ainda estão no aparelho.
  useEffect(() => {
    void limparNotificacoesDaConversa(conversa.id)
  }, [conversa.id, ultima?.id])

  const nomeDe = (id: string | null) => equipe.find((p) => p.id === id)?.nome.split(' ')[0]
  const porWamid = new Map(mensagens.filter((m) => m.wamid).map((m) => [m.wamid!, m]))

  const tentarDeNovo = (m: Mensagem) =>
    m.tipo === 'texto' && m.texto ? () => enviar.mutate({ texto: m.texto! }) : undefined

  return (
    <div ref={area} className="min-h-0 flex-1 overflow-y-auto bg-fundo-suave px-3 py-4 lg:px-6">
      {consulta.isPending ? (
        <Carregando />
      ) : consulta.isError ? (
        <Aviso tipo="erro">{mensagemDeErro(consulta.error)}</Aviso>
      ) : (
        <div className="mx-auto max-w-3xl space-y-2">
          {consulta.data?.temMais && (
            <div className="text-center">
              <Button variante="secundario" onClick={() => setPaginas((p) => p + 1)}>
                Carregar mensagens anteriores
              </Button>
            </div>
          )}
          {mensagens.map((m, i) => {
            const dia = rotuloDoDia(m.enviada_em)
            const novoDia = i === 0 || rotuloDoDia(mensagens[i - 1].enviada_em) !== dia
            return (
              <Fragment key={m.id}>
                {novoDia && (
                  <p className="sticky top-0 z-[1] py-1 text-center">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-texto-suave shadow-sm">
                      {dia}
                    </span>
                  </p>
                )}
                <Bolha
                  m={m}
                  autor={m.direcao === 'saida' ? nomeDe(m.enviada_por) : undefined}
                  citada={m.responde_wamid ? porWamid.get(m.responde_wamid) : undefined}
                  aoTentarDeNovo={m.status === 'falhou' ? tentarDeNovo(m) : undefined}
                />
              </Fragment>
            )
          })}
          <div ref={fim} />
        </div>
      )}
    </div>
  )
}

/** Faixa de baixo: avisos (primeiro contato, janela de 24h) e a caixa de envio. */
function Rodape({ conversa: c }: { conversa: Conversa }) {
  const perfil = usePerfil()
  const assumir = useAssumir()
  const aberta = janelaAberta(c.ultima_entrada_em)
  const primeiroContato = !c.responsavel_id

  return (
    <div className="border-t border-borda bg-white pb-[env(safe-area-inset-bottom)]">
      {primeiroContato && podeTransferir(perfil.papel) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-borda bg-lima-claro px-4 py-2 text-sm text-verde-escuro">
          <Info className="size-4 shrink-0" aria-hidden />
          <p className="flex-1 basis-48">
            Primeiro contato: quem responder assume o atendimento.
            {c.ultimo_responsavel && ` Último atendimento: ${c.ultimo_responsavel.nome}.`}
          </p>
          <Button
            variante="secundario"
            className="min-h-9"
            disabled={assumir.isPending}
            onClick={() => assumir.mutate({ conversa: c.id })}
          >
            Assumir
          </Button>
        </div>
      )}
      {assumir.isError && (
        <div className="px-4 pt-2">
          <Aviso tipo="erro">{mensagemDeErro(assumir.error)}</Aviso>
        </div>
      )}
      {aberta ? (
        <CaixaDeEnvio conversa={c} />
      ) : (
        <div className="flex gap-2 px-4 py-3 text-sm text-texto-suave">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Passaram 24 horas desde a última mensagem do cliente. Pela regra da Meta, agora só dá
            para mandar um modelo (template) aprovado, o que chega numa próxima etapa. Se o cliente
            escrever de novo, a conversa reabre.
          </p>
        </div>
      )}
    </div>
  )
}

function CaixaDeEnvio({ conversa }: { conversa: Conversa }) {
  const enviar = useEnviarMensagem(conversa.id)
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const seletor = useRef<HTMLInputElement>(null)

  // Cresce com o texto (até um limite) e volta ao tamanho de uma linha depois de enviar.
  useLayoutEffect(() => {
    const el = campo.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [texto])

  const podeEnviar = (texto.trim() || arquivo) && !enviar.isPending

  function mandar() {
    if (!podeEnviar) return
    const dados = { texto: texto.trim() || undefined, arquivo: arquivo ?? undefined }
    const limpar = () => {
      setTexto('')
      setArquivo(null)
    }
    enviar.mutate(dados, {
      onSuccess: limpar,
      onError: (erro) => {
        // Já ficou na conversa como "falhou", com o motivo e o "Tentar de novo".
        if (erro instanceof FalhaCrm && erro.mensagemId) {
          limpar()
          enviar.reset()
        }
      },
    })
  }

  // No computador, Enter envia e Shift+Enter quebra a linha. No celular, Enter quebra a linha.
  function teclas(e: KeyboardEvent<HTMLTextAreaElement>) {
    const toque = window.matchMedia('(pointer: coarse)').matches
    if (e.key === 'Enter' && !e.shiftKey && !toque && !e.nativeEvent.isComposing) {
      e.preventDefault()
      mandar()
    }
  }

  return (
    <div className="px-3 py-2">
      {enviar.isError && (
        <div className="mb-2">
          <Aviso tipo="erro">{mensagemDeErro(enviar.error)}</Aviso>
        </div>
      )}
      {arquivo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-borda bg-fundo-suave px-3 py-2 text-sm">
          <Paperclip className="size-4 shrink-0 text-texto-suave" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
          <button
            type="button"
            onClick={() => setArquivo(null)}
            className="grid size-8 place-items-center rounded-lg text-texto-suave hover:bg-white"
            aria-label="Tirar o arquivo"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={seletor}
          type="file"
          className="hidden"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => seletor.current?.click()}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-texto-suave hover:bg-lima-claro hover:text-verde-escuro"
          aria-label="Anexar foto, vídeo ou documento"
          title="Anexar"
        >
          <Paperclip aria-hidden />
        </button>
        <textarea
          ref={campo}
          rows={1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={teclas}
          placeholder={arquivo ? 'Legenda (opcional)' : 'Escreva uma mensagem'}
          aria-label="Mensagem"
          maxLength={4096}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-borda bg-white px-3 py-2.5 text-base leading-snug text-texto placeholder:text-texto-suave/60 focus:border-verde focus:ring-2 focus:ring-lima/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={mandar}
          disabled={!podeEnviar}
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl bg-verde text-white transition-colors hover:bg-verde-escuro disabled:opacity-40',
          )}
          aria-label="Enviar"
          title="Enviar"
        >
          {enviar.isPending ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <Send className="size-5" aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}
