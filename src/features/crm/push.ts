import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

/*
 * Notificações push neste aparelho (Web Push).
 *
 * iPhone: só funciona no iOS 16.4 ou mais novo, com o sistema ADICIONADO À TELA DE
 * INÍCIO e aberto pelo ícone (no Safari comum não existe push). A permissão só pode ser
 * pedida com um toque da pessoa num botão. O Service Worker só existe no site publicado
 * (em desenvolvimento ele não é registrado).
 */

export type SituacaoAparelho = {
  ios: boolean
  /** Versão do iOS (ex.: 17.5), quando é iPhone/iPad. */
  versaoIos: number | null
  /** Aberto pelo ícone da tela de início (app instalado). */
  instalado: boolean
  /** O navegador tem as peças do Web Push. */
  suportaPush: boolean
  permissao: NotificationPermission | 'indisponivel'
}

export function ehIos(ua = navigator.userAgent, toques = navigator.maxTouchPoints): boolean {
  // O iPad com iPadOS se apresenta como Mac: dá para reconhecer pela tela de toque.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)
}

export function versaoDoIos(ua = navigator.userAgent): number | null {
  const m = ua.match(/OS (\d+)_(\d+)/) ?? ua.match(/Version\/(\d+)\.(\d+)/)
  return m ? Number(`${m[1]}.${m[2]}`) : null
}

export function situacaoDoAparelho(): SituacaoAparelho {
  const instalado =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const suportaPush =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const ios = ehIos()
  return {
    ios,
    versaoIos: ios ? versaoDoIos() : null,
    instalado,
    suportaPush,
    permissao: 'Notification' in window ? Notification.permission : 'indisponivel',
  }
}

/** Nome do aparelho para a lista "Meus aparelhos". */
export function descricaoDoAparelho(
  ua = navigator.userAgent,
  instalado = situacaoDoAparelho().instalado,
) {
  const app = instalado ? 'app na tela de início' : 'navegador'
  if (/iPhone/.test(ua)) return `iPhone · ${app}`
  if (ehIos(ua)) return `iPad · ${app}`
  if (/Android/.test(ua)) return `Android · ${app}`
  const navegador = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'navegador'
  const sistema = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : 'Computador'
  return `${sistema} · ${navegador}`
}

/** O Service Worker deste site, se estiver registrado (no site publicado). */
export async function registroDoServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function erroDaFuncao(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const detalhe = (await error.context.json().catch(() => null)) as { erro?: string } | null
    return new Error(detalhe?.erro ?? 'Não foi possível falar com o servidor.')
  }
  return new Error('Sem conexão com o servidor. Verifique a internet.')
}

let chaveGuardada: string | null = null

/**
 * Chave pública do servidor (VAPID). Busque ANTES do toque em "Ativar": no iPhone, o
 * pedido de permissão precisa acontecer logo depois do toque, sem esperar a internet.
 */
export async function chavePublicaVapid(): Promise<string> {
  if (chaveGuardada) return chaveGuardada
  const { data, error } = await supabase.functions.invoke('push', { body: { acao: 'chave' } })
  if (error) throw await erroDaFuncao(error)
  chaveGuardada = (data as { chavePublica: string }).chavePublica
  return chaveGuardada
}

async function salvarNoServidor(inscricao: PushSubscription) {
  const json = inscricao.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('O navegador devolveu uma inscrição incompleta.')
  }
  const { error } = await supabase.rpc('crm_registrar_aparelho', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_dispositivo: descricaoDoAparelho(),
  })
  if (error) throw error
}

/** Mesma chave do servidor? (se o servidor trocar de chave, a inscrição precisa ser refeita) */
function mesmaChave(inscricao: PushSubscription, chave: string) {
  const atual = inscricao.options?.applicationServerKey
  if (!atual) return true
  const a = new Uint8Array(atual)
  const b = chaveParaBytes(chave)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

async function inscrever(registro: ServiceWorkerRegistration, chave: string) {
  let inscricao = await registro.pushManager.getSubscription()
  if (inscricao && !mesmaChave(inscricao, chave)) {
    await inscricao.unsubscribe()
    inscricao = null
  }
  inscricao ??= await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: chaveParaBytes(chave),
  })
  await salvarNoServidor(inscricao)
  return inscricao
}

/**
 * Liga as notificações neste aparelho. Chamar direto no toque do botão, com a chave
 * já buscada (chavePublicaVapid).
 */
export async function ativarNotificacoes(chave: string): Promise<void> {
  const situacao = situacaoDoAparelho()
  if (situacao.ios && !situacao.instalado) {
    throw new Error(
      'No iPhone, as notificações só funcionam com o sistema adicionado à tela de início e aberto pelo ícone.',
    )
  }
  if (!situacao.suportaPush) throw new Error('Este navegador não aceita notificações push.')

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    throw new Error(
      permissao === 'denied'
        ? 'As notificações estão bloqueadas para o sistema. Libere nas configurações do aparelho (veja as instruções abaixo).'
        : 'Você não permitiu as notificações.',
    )
  }
  const registro = await registroDoServiceWorker()
  if (!registro) {
    throw new Error(
      'O sistema ainda não terminou de se instalar neste aparelho. Feche e abra de novo e tente outra vez.',
    )
  }
  await inscrever(registro, chave)
}

/** Desliga neste aparelho (e tira do servidor). */
export async function desativarNotificacoes(): Promise<void> {
  const registro = await registroDoServiceWorker()
  const inscricao = await registro?.pushManager.getSubscription()
  if (!inscricao) return
  await supabase.rpc('crm_remover_aparelho', { p_endpoint: inscricao.endpoint })
  await inscricao.unsubscribe()
}

/** Endereço da inscrição deste aparelho, se houver. */
export async function inscricaoDesteAparelho(): Promise<string | null> {
  const registro = await registroDoServiceWorker()
  return (await registro?.pushManager.getSubscription())?.endpoint ?? null
}

/**
 * Ao abrir o app: se a pessoa já deu permissão, confere a inscrição e avisa o servidor
 * (o aparelho pode ter trocado de endereço, ou o celular pode ter trocado de login).
 * Não pede permissão nenhuma: isso só com o toque no botão.
 */
export async function sincronizarNotificacoes(): Promise<void> {
  if (!situacaoDoAparelho().suportaPush || Notification.permission !== 'granted') return
  const registro = await registroDoServiceWorker()
  if (!registro) return
  await inscrever(registro, await chavePublicaVapid())
}

/** Ao sair do sistema: este aparelho para de receber as conversas de quem saiu. */
export async function removerAoSair(): Promise<void> {
  try {
    const registro = await registroDoServiceWorker()
    const inscricao = await registro?.pushManager.getSubscription()
    if (!inscricao) return
    await supabase.rpc('crm_remover_aparelho', { p_endpoint: inscricao.endpoint })
    await inscricao.unsubscribe()
  } catch {
    // Sem internet ao sair: o próximo login neste aparelho assume a inscrição.
  }
}

/** Fecha as notificações de uma conversa (ao abri-la no app). */
export async function limparNotificacoesDaConversa(conversaId: string): Promise<void> {
  try {
    const registro = await registroDoServiceWorker()
    const notificacoes = (await registro?.getNotifications()) ?? []
    for (const n of notificacoes) {
      if ((n.data as { conversaId?: string } | null)?.conversaId === conversaId) n.close()
    }
  } catch {
    // Navegador sem suporte: nada a fazer.
  }
}

/** Número no ícone do app (iPhone instalado, Android, computador). */
export function atualizarNumeroDoIcone(total: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  try {
    if (total > 0) void nav.setAppBadge?.(total)?.catch(() => {})
    else void nav.clearAppBadge?.()?.catch(() => {})
  } catch {
    // Sem suporte: o número continua aparecendo no menu.
  }
}
