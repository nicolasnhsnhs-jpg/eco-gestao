import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import {
  ArrowLeft,
  BellRing,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Aviso } from '@/components/ui/Aviso'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatarDataHora } from '@/lib/datas'
import { mensagemDeErro } from '@/lib/erros'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { usePerfil } from '../auth/useAuth'
import {
  ativarNotificacoes,
  chavePublicaVapid,
  desativarNotificacoes,
  inscricaoDesteAparelho,
  registroDoServiceWorker,
  situacaoDoAparelho,
} from './push'
import { podeUsarCrm } from './regras'

const CHAVE = ['crm', 'notificacoes'] as const

type Preferencias = { ativo: boolean; mostrar_previa: boolean; apenas_minhas: boolean }
const PADRAO: Preferencias = { ativo: true, mostrar_previa: true, apenas_minhas: false }

/** Configuração das notificações do atendimento e diagnóstico deste aparelho. */
export function NotificacoesPage() {
  const perfil = usePerfil()
  if (!podeUsarCrm(perfil)) {
    return (
      <Aviso tipo="info">
        Seu usuário não usa o atendimento pelo WhatsApp. Peça ao administrador para ligar a
        permissão “atende WhatsApp”.
      </Aviso>
    )
  }
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/crm"
        className="mb-3 inline-flex min-h-11 items-center gap-2 font-semibold text-verde-escuro"
      >
        <ArrowLeft className="size-5" aria-hidden />
        Atendimento
      </Link>
      <PageHeader
        titulo="Notificações"
        descricao="Receba um aviso no celular quando um cliente mandar mensagem no WhatsApp."
      />
      <div className="space-y-4">
        <EsteAparelho />
        <PreferenciasCard />
        <MeusAparelhos />
      </div>
    </div>
  )
}

type Estado = 'ok' | 'erro' | 'alerta' | 'nao_se_aplica'

function Item({
  estado,
  titulo,
  children,
}: {
  estado: Estado
  titulo: string
  children?: ReactNode
}) {
  const Icone = estado === 'ok' ? CircleCheck : estado === 'erro' ? CircleAlert : CircleHelp
  return (
    <li className="flex gap-3 py-2">
      <Icone
        className={cn(
          'mt-0.5 size-5 shrink-0',
          estado === 'ok' && 'text-verde',
          estado === 'erro' && 'text-perigo',
          estado === 'alerta' && 'text-alerta',
          estado === 'nao_se_aplica' && 'text-texto-suave',
        )}
        aria-label={
          { ok: 'Ok', erro: 'Problema', alerta: 'Atenção', nao_se_aplica: 'Não se aplica' }[estado]
        }
      />
      <div className="min-w-0">
        <p className="font-semibold">{titulo}</p>
        {children && <div className="text-sm text-texto-suave">{children}</div>}
      </div>
    </li>
  )
}

function useDiagnostico() {
  return useQuery({
    queryKey: [...CHAVE, 'diagnostico'],
    staleTime: 0,
    queryFn: async () => {
      const situacao = situacaoDoAparelho()
      const registro = await registroDoServiceWorker().catch(() => null)
      const endpoint = await inscricaoDesteAparelho().catch(() => null)
      let salvoNoServidor = false
      if (endpoint) {
        const { data } = await supabase
          .from('push_inscricoes')
          .select('id')
          .eq('endpoint', endpoint)
          .maybeSingle()
        salvoNoServidor = !!data
      }
      let chave: string | null = null
      let erroChave: string | null = null
      try {
        chave = await chavePublicaVapid()
      } catch (e) {
        erroChave = (e as Error).message
      }
      return {
        situacao,
        serviceWorker: !!registro?.active,
        endpoint,
        salvoNoServidor,
        chave,
        erroChave,
      }
    },
  })
}

function EsteAparelho() {
  const queryClient = useQueryClient()
  const diag = useDiagnostico()
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [teste, setTeste] = useState<
    { dispositivo: string | null; ok: boolean; erro: string | null }[] | null
  >(null)

  const atualizar = () => void queryClient.invalidateQueries({ queryKey: CHAVE })

  // Volta para o app (ex.: depois de mexer nos Ajustes do iPhone): confere tudo de novo.
  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && atualizar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  })

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    setErro(null)
    setOk(null)
    setOcupado(true)
    try {
      await acao()
      setOk(sucesso)
    } catch (e) {
      setErro(e instanceof Error && !('code' in e) ? e.message : mensagemDeErro(e))
    } finally {
      setOcupado(false)
      atualizar()
    }
  }

  async function testar() {
    setTeste(null)
    await executar(async () => {
      const { data, error } = await supabase.functions.invoke('push', { body: { acao: 'teste' } })
      if (error) {
        const detalhe =
          error instanceof FunctionsHttpError
            ? ((await error.context.json().catch(() => null)) as { erro?: string } | null)
            : null
        throw new Error(detalhe?.erro ?? 'Não foi possível pedir o teste.')
      }
      const r = data as {
        configurado: boolean
        resultados: { dispositivo: string | null; ok: boolean; erro: string | null }[]
      }
      if (!r.configurado)
        throw new Error('As notificações ainda não foram configuradas no servidor.')
      if (!r.resultados.length)
        throw new Error('Nenhum aparelho seu está com as notificações ativas.')
      setTeste(r.resultados)
    }, 'Pedido enviado. A notificação deve chegar em alguns segundos (com o app fechado ou aberto).')
  }

  if (diag.isPending) return <Card>Conferindo este aparelho…</Card>
  const d = diag.data
  if (!d) return <Aviso tipo="erro">{mensagemDeErro(diag.error)}</Aviso>
  const { situacao } = d
  const iosAntigo = situacao.ios && situacao.versaoIos !== null && situacao.versaoIos < 16.4
  const ativo = situacao.permissao === 'granted' && !!d.endpoint && d.salvoNoServidor
  const podeAtivar =
    situacao.suportaPush && !(situacao.ios && !situacao.instalado) && !!d.chave && !iosAntigo

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Smartphone className="size-5" aria-hidden />
        Este aparelho
      </h2>
      <p className={cn('mb-3 text-sm font-semibold', ativo ? 'text-verde' : 'text-alerta')}>
        {ativo
          ? 'Notificações ativas neste aparelho.'
          : 'Notificações ainda não ativas neste aparelho.'}
      </p>

      <ul className="divide-y divide-borda">
        {situacao.ios && (
          <Item
            estado={iosAntigo ? 'erro' : situacao.versaoIos === null ? 'alerta' : 'ok'}
            titulo={`iOS ${situacao.versaoIos ?? 'versão desconhecida'}`}
          >
            {iosAntigo &&
              'O iPhone precisa do iOS 16.4 ou mais novo. Atualize em Ajustes → Geral → Atualização de Software.'}
          </Item>
        )}
        {situacao.ios && (
          <Item
            estado={situacao.instalado ? 'ok' : 'erro'}
            titulo={
              situacao.instalado
                ? 'Aberto pelo ícone da tela de início'
                : 'Aberto pelo Safari (não instalado)'
            }
          >
            {!situacao.instalado && (
              <>
                No Safari, toque em <strong>Compartilhar</strong> →{' '}
                <strong>Adicionar à Tela de Início</strong>. Depois abra o sistema pelo ícone e
                volte nesta tela.
              </>
            )}
          </Item>
        )}
        <Item
          estado={situacao.suportaPush ? 'ok' : 'erro'}
          titulo="Navegador com notificações push"
        >
          {!situacao.suportaPush &&
            (situacao.ios
              ? 'Só existe no app instalado na tela de início (iOS 16.4 ou mais novo).'
              : 'Use um navegador atualizado (Chrome, Edge, Safari ou Firefox).')}
        </Item>
        <Item
          estado={d.serviceWorker ? 'ok' : 'alerta'}
          titulo="Sistema instalado neste aparelho (Service Worker)"
        >
          {!d.serviceWorker &&
            (import.meta.env.DEV
              ? 'Em desenvolvimento o Service Worker não é usado: teste no site publicado.'
              : 'Feche e abra o sistema de novo para terminar a instalação.')}
        </Item>
        <Item
          estado={
            situacao.permissao === 'granted'
              ? 'ok'
              : situacao.permissao === 'denied'
                ? 'erro'
                : 'alerta'
          }
          titulo={
            situacao.permissao === 'granted'
              ? 'Permissão concedida'
              : situacao.permissao === 'denied'
                ? 'Permissão negada'
                : 'Permissão ainda não pedida'
          }
        >
          {situacao.permissao === 'denied' &&
            (situacao.ios
              ? 'No iPhone: Ajustes → Notificações → Eco Gestão → Permitir Notificações. Depois volte aqui e toque em “Ativar”.'
              : 'Libere as notificações deste site nas configurações do navegador (cadeado ao lado do endereço).')}
        </Item>
        <Item estado={d.salvoNoServidor ? 'ok' : 'alerta'} titulo="Aparelho cadastrado no servidor">
          {!d.salvoNoServidor && 'Toque em “Ativar notificações neste aparelho”.'}
        </Item>
        <Item estado={d.chave ? 'ok' : 'erro'} titulo="Servidor de notificações configurado">
          {d.erroChave}
        </Item>
      </ul>

      <div className="mt-4 space-y-3">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {ok && <Aviso tipo="sucesso">{ok}</Aviso>}
        {teste && (
          <ul className="space-y-1 text-sm">
            {teste.map((t, i) => (
              <li key={i} className={t.ok ? 'text-verde-escuro' : 'text-perigo'}>
                {t.dispositivo ?? 'Aparelho'}: {t.ok ? 'aceito pelo serviço de push' : t.erro}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {!ativo && (
            <Button
              disabled={!podeAtivar || ocupado}
              onClick={() =>
                d.chave &&
                void executar(
                  () => ativarNotificacoes(d.chave!),
                  'Notificações ativadas neste aparelho.',
                )
              }
            >
              <BellRing className="size-5" aria-hidden />
              Ativar notificações neste aparelho
            </Button>
          )}
          {ativo && (
            <Button variante="secundario" disabled={ocupado} onClick={() => void testar()}>
              <BellRing className="size-5" aria-hidden />
              Enviar notificação de teste
            </Button>
          )}
          {d.endpoint && (
            <Button
              variante="fantasma"
              disabled={ocupado}
              onClick={() =>
                void executar(desativarNotificacoes, 'Notificações desligadas neste aparelho.')
              }
            >
              Desativar neste aparelho
            </Button>
          )}
        </div>
        {ativo && situacao.ios && (
          <p className="text-xs text-texto-suave">
            Para testar com o iPhone bloqueado: toque em “Enviar notificação de teste” e bloqueie a
            tela logo em seguida.
          </p>
        )}
      </div>
    </Card>
  )
}

function PreferenciasCard() {
  const perfil = usePerfil()
  const queryClient = useQueryClient()
  const prefs = useQuery({
    queryKey: [...CHAVE, 'preferencias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preferencias_notificacao')
        .select('ativo, mostrar_previa, apenas_minhas')
        .eq('usuario_id', perfil.id)
        .maybeSingle()
      if (error) throw error
      return data ?? PADRAO
    },
  })
  const salvar = useMutation({
    mutationFn: async (novas: Preferencias) => {
      const { error } = await supabase
        .from('preferencias_notificacao')
        .upsert({ usuario_id: perfil.id, ...novas, atualizado_em: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...CHAVE, 'preferencias'] }),
  })
  const atual = prefs.data ?? PADRAO

  const opcao = (campo: keyof Preferencias, titulo: string, dica: string) => (
    <label className="flex cursor-pointer gap-3 py-2">
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-verde"
        checked={atual[campo]}
        disabled={prefs.isPending || salvar.isPending || (campo !== 'ativo' && !atual.ativo)}
        onChange={(e) => salvar.mutate({ ...atual, [campo]: e.target.checked })}
      />
      <span>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-sm text-texto-suave">{dica}</span>
      </span>
    </label>
  )

  return (
    <Card>
      <h2 className="mb-2 text-lg font-bold">Preferências</h2>
      {salvar.isError && <Aviso tipo="erro">{mensagemDeErro(salvar.error)}</Aviso>}
      <div className="divide-y divide-borda">
        {opcao('ativo', 'Receber notificações', 'Vale para todos os seus aparelhos.')}
        {opcao(
          'mostrar_previa',
          'Mostrar o nome do cliente e a mensagem',
          'Desligado, a notificação diz só “Nova mensagem de cliente”, sem nome nem texto (útil com a tela bloqueada).',
        )}
        {opcao(
          'apenas_minhas',
          'Só das conversas em que sou o responsável',
          'Desligado, você recebe de todas as conversas que pode ver (inclusive o primeiro contato, se for o caso).',
        )}
      </div>
    </Card>
  )
}

function MeusAparelhos() {
  const queryClient = useQueryClient()
  const aparelhos = useQuery({
    queryKey: [...CHAVE, 'aparelhos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_inscricoes')
        .select('id, dispositivo, criado_em, ultimo_acesso_em, ultimo_envio_em, ultimo_erro')
        .order('ultimo_acesso_em', { ascending: false })
      if (error) throw error
      return data
    },
  })
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('push_inscricoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CHAVE }),
  })
  const lista = aparelhos.data ?? []

  return (
    <Card>
      <h2 className="mb-2 text-lg font-bold">Meus aparelhos</h2>
      {remover.isError && <Aviso tipo="erro">{mensagemDeErro(remover.error)}</Aviso>}
      {lista.length === 0 ? (
        <p className="text-sm text-texto-suave">Nenhum aparelho com notificações ativas.</p>
      ) : (
        <ul className="divide-y divide-borda">
          {lista.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{a.dispositivo ?? 'Aparelho'}</p>
                <p className="text-texto-suave">
                  Ativado em {formatarDataHora(a.criado_em)}
                  {a.ultimo_envio_em &&
                    ` · última notificação ${formatarDataHora(a.ultimo_envio_em)}`}
                </p>
                {a.ultimo_erro && <p className="text-perigo">Último erro: {a.ultimo_erro}</p>}
              </div>
              <button
                type="button"
                onClick={() => remover.mutate(a.id)}
                className="grid size-10 place-items-center rounded-lg text-texto-suave hover:bg-lima-claro"
                aria-label={`Tirar ${a.dispositivo ?? 'aparelho'}`}
                title="Parar de notificar este aparelho"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
