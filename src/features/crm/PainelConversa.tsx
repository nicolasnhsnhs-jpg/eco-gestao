import { ArrowRightLeft, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Campo, Input, Select, Textarea } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { formatarDataHora } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { NOME_DO_PAPEL } from '@/lib/papeis'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import { ClienteSeletor, type ClienteEscolhido } from '../clientes/ClienteSeletor'
import {
  useAdicionarNota,
  useAlternarEtiqueta,
  useApagarNota,
  useAssumir,
  useAtendentes,
  useCriarEtiqueta,
  useEtiquetas,
  useMudarStatus,
  useNotas,
  useRegistrarAtendimento,
  useTransferencias,
  useTransferir,
  useVincularCliente,
  type Conversa,
} from './api'
import { CorEtiqueta } from './componentes'
import { CORES_ETIQUETA, NOMES_CORES } from './cores'
import {
  NOME_SETOR,
  NOME_STATUS,
  nomeDoContato,
  podeTransferir,
  SETORES,
  telefoneDoWaId,
  telefoneParaCadastro,
  type SetorAtendimento,
  type StatusConversa,
} from './regras'

type Props = { conversa: Conversa; aberto: boolean; aoFechar: () => void }

/** Gaveta à direita com tudo do atendimento (no celular, ocupa a tela). */
export function PainelConversa({ conversa, aberto, aoFechar }: Props) {
  useEffect(() => {
    if (!aberto) return
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto, aoFechar])

  if (!aberto) return null
  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do atendimento"
    >
      <button
        type="button"
        className="absolute inset-0 bg-verde-noite/40"
        onClick={aoFechar}
        aria-label="Fechar detalhes"
      />
      <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-fundo-suave shadow-xl sm:w-[26rem]">
        <div className="flex items-center justify-between border-b border-borda bg-white px-4 pt-[env(safe-area-inset-top)]">
          <h2 className="py-4 text-lg font-bold">Atendimento</h2>
          <button
            type="button"
            onClick={aoFechar}
            className="grid size-11 place-items-center rounded-xl text-verde-escuro hover:bg-lima-claro"
            aria-label="Fechar detalhes"
          >
            <X aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SecaoCliente conversa={conversa} />
          <SecaoAtendimento conversa={conversa} />
          <SecaoEtiquetas conversa={conversa} />
          <SecaoNotas conversa={conversa} />
          <SecaoHistorico conversa={conversa} />
        </div>
      </div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-borda bg-white p-4">
      <h3 className="mb-3 text-sm font-bold tracking-wide text-texto-suave uppercase">{titulo}</h3>
      {children}
    </section>
  )
}

function SecaoCliente({ conversa: c }: { conversa: Conversa }) {
  const vincular = useVincularCliente()
  const [escolhido, setEscolhido] = useState<ClienteEscolhido | null>(null)
  const contato = c.contato
  const cliente = contato?.cliente

  const novoCliente = new URLSearchParams({
    whatsapp: contato ? telefoneParaCadastro(contato.wa_id) : '',
    nome: contato?.nome_perfil ?? '',
    conversa: c.id,
  })

  return (
    <Secao titulo="Cliente">
      <p className="font-semibold">{nomeDoContato(contato)}</p>
      <p className="text-sm text-texto-suave">
        {contato && telefoneDoWaId(contato.wa_id)}
        {contato?.nome_perfil && ` · no WhatsApp: ${contato.nome_perfil}`}
      </p>

      {vincular.isError && (
        <div className="mt-3">
          <Aviso tipo="erro">{mensagemDeErro(vincular.error)}</Aviso>
        </div>
      )}

      {cliente ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={`/clientes/${cliente.id}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-borda px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            Abrir ficha do cliente
          </Link>
          <Button
            variante="fantasma"
            disabled={vincular.isPending}
            onClick={() => vincular.mutate({ conversa: c.id, cliente: null })}
          >
            Desvincular
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-texto-suave">
            Este número não está no cadastro de clientes. Ligue a um cliente que já existe ou
            cadastre um novo.
          </p>
          <ClienteSeletor
            valor={escolhido}
            aoMudar={(cli) => {
              setEscolhido(cli)
              if (cli) vincular.mutate({ conversa: c.id, cliente: cli.id })
            }}
          />
          <Link
            to={`/clientes/novo?${novoCliente}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-borda px-4 font-semibold text-verde-escuro hover:bg-lima-claro"
          >
            <UserPlus className="size-5" aria-hidden />
            Cadastrar novo cliente
          </Link>
        </div>
      )}
    </Secao>
  )
}

function SecaoAtendimento({ conversa: c }: { conversa: Conversa }) {
  const perfil = usePerfil()
  const status = useMudarStatus()
  const assumir = useAssumir()
  const [transferindo, setTransferindo] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const erro = status.error ?? assumir.error

  const mudar = (novo: StatusConversa) =>
    novo === 'finalizada'
      ? setFinalizando(true)
      : status.mutate({ conversa: c.id, novo_status: novo })

  const podeAssumir =
    c.responsavel_id !== perfil.id && (!c.responsavel_id || perfil.papel === 'admin')

  return (
    <Secao titulo="Atendimento">
      {erro && (
        <div className="mb-3">
          <Aviso tipo="erro">{mensagemDeErro(erro)}</Aviso>
        </div>
      )}
      <p className="mb-2 text-sm font-semibold">Situação</p>
      <div
        className="mb-4 grid grid-cols-3 gap-2"
        role="group"
        aria-label="Situação do atendimento"
      >
        {(['aberta', 'pendente', 'finalizada'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={c.status === s}
            disabled={status.isPending}
            onClick={() => c.status !== s && mudar(s)}
            className={cn(
              'min-h-11 rounded-xl border text-sm font-semibold transition-colors',
              c.status === s
                ? 'border-verde bg-verde text-white'
                : 'border-borda bg-white text-texto-suave hover:bg-lima-claro',
            )}
          >
            {s === 'finalizada' ? 'Finalizar' : NOME_STATUS[s]}
          </button>
        ))}
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-texto-suave">Responsável</dt>
          <dd className="font-semibold">{c.responsavel?.nome ?? 'Primeiro contato'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-texto-suave">Setor</dt>
          <dd className="font-semibold">{c.setor ? NOME_SETOR[c.setor] : '—'}</dd>
        </div>
        {c.ultimo_responsavel && !c.responsavel && (
          <div className="flex justify-between gap-2">
            <dt className="text-texto-suave">Último atendimento</dt>
            <dd>{c.ultimo_responsavel.nome}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {podeAssumir && (
          <Button
            variante="secundario"
            disabled={assumir.isPending}
            onClick={() => assumir.mutate({ conversa: c.id })}
          >
            Assumir
          </Button>
        )}
        {podeTransferir(perfil.papel) && (
          <Button variante="secundario" onClick={() => setTransferindo(true)}>
            <ArrowRightLeft className="size-4" aria-hidden />
            Transferir
          </Button>
        )}
      </div>

      <Modal
        aberto={transferindo}
        aoFechar={() => setTransferindo(false)}
        titulo="Transferir conversa"
      >
        <FormTransferir conversa={c} aoTerminar={() => setTransferindo(false)} />
      </Modal>
      <Modal
        aberto={finalizando}
        aoFechar={() => setFinalizando(false)}
        titulo="Finalizar atendimento"
      >
        <FormFinalizar conversa={c} aoTerminar={() => setFinalizando(false)} />
      </Modal>
    </Secao>
  )
}

function FormTransferir({
  conversa: c,
  aoTerminar,
}: {
  conversa: Conversa
  aoTerminar: () => void
}) {
  const atendentes = useAtendentes()
  const transferir = useTransferir()
  const [responsavel, setResponsavel] = useState(c.responsavel_id ?? '')
  const [setor, setSetor] = useState<SetorAtendimento | ''>(c.setor ?? '')
  const [motivo, setMotivo] = useState('')

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        transferir.mutate(
          {
            conversa: c.id,
            responsavel: responsavel || null,
            novo_setor: setor || null,
            motivo: motivo.trim() || null,
          },
          { onSuccess: aoTerminar },
        )
      }}
    >
      {transferir.isError && <Aviso tipo="erro">{mensagemDeErro(transferir.error)}</Aviso>}
      <Campo
        rotulo="Para quem"
        htmlFor="transferir-para"
        dica="Só aparece quem tem a permissão “atende WhatsApp” (tela de usuários)."
      >
        <Select
          id="transferir-para"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
        >
          <option value="">Primeiro contato (sem responsável)</option>
          {(atendentes.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({NOME_DO_PAPEL[p.papel]})
            </option>
          ))}
        </Select>
      </Campo>
      <Campo
        rotulo="Setor"
        htmlFor="transferir-setor"
        dica="No setor administrativo, o ADM também vê a conversa (documentação, certificados, agendamento de contrato)."
      >
        <Select
          id="transferir-setor"
          value={setor}
          onChange={(e) => setSetor(e.target.value as SetorAtendimento | '')}
        >
          <option value="">Sem setor</option>
          {SETORES.map((s) => (
            <option key={s} value={s}>
              {NOME_SETOR[s]}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Motivo (opcional)" htmlFor="transferir-motivo">
        <Input
          id="transferir-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: pediu segunda via do boleto"
        />
      </Campo>
      <Button type="submit" className="w-full" disabled={transferir.isPending}>
        Transferir
      </Button>
    </form>
  )
}

function FormFinalizar({
  conversa: c,
  aoTerminar,
}: {
  conversa: Conversa
  aoTerminar: () => void
}) {
  const status = useMudarStatus()
  const registrar = useRegistrarAtendimento()
  const [resumo, setResumo] = useState('')
  const [erro, setErro] = useState<unknown>(null)
  const clienteId = c.contato?.cliente_id

  async function finalizar() {
    setErro(null)
    try {
      if (clienteId && resumo.trim().length >= 2) {
        await registrar.mutateAsync({ clienteId, resumo: resumo.trim() })
      }
      await status.mutateAsync({ conversa: c.id, novo_status: 'finalizada' })
      aoTerminar()
    } catch (e) {
      setErro(e)
    }
  }

  return (
    <div className="space-y-4">
      {!!erro && <Aviso tipo="erro">{mensagemDeErro(erro)}</Aviso>}
      <p className="text-sm text-texto-suave">
        A conversa sai das abertas. Se o cliente escrever de novo, ela volta para o primeiro
        contato.
      </p>
      {clienteId ? (
        <Campo
          rotulo="Resumo para a ficha do cliente (opcional)"
          htmlFor="finalizar-resumo"
          dica="Fica no histórico de atendimentos do cliente, com o canal WhatsApp."
        >
          <Textarea
            id="finalizar-resumo"
            rows={3}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            placeholder="Ex.: pediu orçamento de desentupimento, visita marcada para quinta."
          />
        </Campo>
      ) : (
        <Aviso tipo="info">
          O contato não está ligado a um cliente: o resumo não vai para nenhuma ficha.
        </Aviso>
      )}
      <Button
        className="w-full"
        disabled={status.isPending || registrar.isPending}
        onClick={() => void finalizar()}
      >
        Finalizar atendimento
      </Button>
    </div>
  )
}

function SecaoEtiquetas({ conversa: c }: { conversa: Conversa }) {
  const perfil = usePerfil()
  const etiquetas = useEtiquetas()
  const alternar = useAlternarEtiqueta()
  const criar = useCriarEtiqueta()
  const [nova, setNova] = useState('')
  const [cor, setCor] = useState('verde')
  const marcadas = new Set(c.etiquetas.map((e) => e.etiqueta_id))
  const lista = etiquetas.data ?? []
  const erro = alternar.error ?? criar.error

  return (
    <Secao titulo="Etiquetas">
      {erro && (
        <div className="mb-3">
          <Aviso tipo="erro">{mensagemDeErro(erro)}</Aviso>
        </div>
      )}
      {lista.length === 0 ? (
        <p className="text-sm text-texto-suave">
          {perfil.papel === 'admin'
            ? 'Nenhuma etiqueta criada ainda. Crie abaixo.'
            : 'Nenhuma etiqueta criada ainda. O administrador cria as etiquetas.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lista.map((e) => {
            const marcada = marcadas.has(e.id)
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={marcada}
                disabled={alternar.isPending}
                onClick={() =>
                  alternar.mutate({ conversaId: c.id, etiquetaId: e.id, marcar: !marcada })
                }
                className={cn(
                  'rounded-full transition-opacity',
                  !marcada && 'opacity-40 hover:opacity-80',
                )}
                title={marcada ? 'Tirar etiqueta' : 'Pôr etiqueta'}
              >
                <CorEtiqueta etiqueta={e} />
              </button>
            )
          })}
        </div>
      )}
      {perfil.papel === 'admin' && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!nova.trim()) return
            criar.mutate({ nome: nova.trim(), cor }, { onSuccess: () => setNova('') })
          }}
        >
          <Input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Nova etiqueta"
            maxLength={40}
            aria-label="Nome da nova etiqueta"
          />
          <Select
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            aria-label="Cor"
            className={cn('w-28', CORES_ETIQUETA[cor])}
          >
            {NOMES_CORES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            disabled={criar.isPending || !nova.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-verde text-white disabled:opacity-40"
            aria-label="Criar etiqueta"
          >
            <Plus aria-hidden />
          </button>
        </form>
      )}
    </Secao>
  )
}

function SecaoNotas({ conversa: c }: { conversa: Conversa }) {
  const perfil = usePerfil()
  const notas = useNotas(c.id)
  const adicionar = useAdicionarNota(c.id)
  const apagar = useApagarNota()
  const [texto, setTexto] = useState('')
  const erro = adicionar.error ?? apagar.error

  return (
    <Secao titulo="Notas internas">
      <p className="mb-3 text-xs text-texto-suave">Só a equipe vê. O cliente não recebe.</p>
      {erro && (
        <div className="mb-3">
          <Aviso tipo="erro">{mensagemDeErro(erro)}</Aviso>
        </div>
      )}
      <ul className="mb-3 space-y-2">
        {(notas.data ?? []).map((n) => (
          <li key={n.id} className="rounded-xl bg-amber-50 p-3 text-sm">
            <p className="whitespace-pre-wrap">{n.texto}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-texto-suave">
              <span>
                {n.autor?.nome} · {formatarDataHora(n.criado_em)}
              </span>
              {(n.autor_id === perfil.id || perfil.papel === 'admin') && (
                <button
                  type="button"
                  onClick={() => apagar.mutate(n.id)}
                  className="grid size-8 place-items-center rounded-lg hover:bg-white"
                  aria-label="Apagar nota"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!texto.trim()) return
          adicionar.mutate(texto.trim(), { onSuccess: () => setTexto('') })
        }}
      >
        <Textarea
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma nota para a equipe"
          aria-label="Nova nota interna"
        />
        <Button type="submit" variante="secundario" disabled={adicionar.isPending || !texto.trim()}>
          Adicionar nota
        </Button>
      </form>
    </Secao>
  )
}

function SecaoHistorico({ conversa: c }: { conversa: Conversa }) {
  const historico = useTransferencias(c.id)
  const lista = historico.data ?? []
  if (!lista.length) return null
  return (
    <Secao titulo="Histórico de responsáveis">
      <ul className="space-y-2 text-sm">
        {lista.map((t) => (
          <li key={t.id}>
            <p>
              <span className="font-semibold">{t.novo?.nome ?? 'Primeiro contato'}</span>
              {t.anterior && <span className="text-texto-suave"> (antes: {t.anterior.nome})</span>}
              {t.setor && <span className="text-texto-suave"> · {NOME_SETOR[t.setor]}</span>}
            </p>
            <p className="text-xs text-texto-suave">
              {formatarDataHora(t.em)}
              {t.feita && ` · por ${t.feita.nome}`}
              {t.motivo && ` · ${t.motivo}`}
            </p>
          </li>
        ))}
      </ul>
    </Secao>
  )
}
