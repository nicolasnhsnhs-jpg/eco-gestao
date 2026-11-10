// Peças do WhatsApp (Cloud API da Meta) que não dependem do servidor: conferir a
// assinatura do webhook, ler o que a Meta mandou e decidir como enviar cada arquivo.
// Sem nada do Deno aqui, para os testes (Vitest) rodarem no Node.

export type TipoMensagem =
  | 'texto'
  | 'imagem'
  | 'audio'
  | 'video'
  | 'documento'
  | 'figurinha'
  | 'localizacao'
  | 'contato'
  | 'reacao'
  | 'botao'
  | 'template'
  | 'outro'

export type MensagemRecebida = {
  phoneNumberId: string
  waId: string
  nomePerfil: string | null
  wamid: string
  tipo: TipoMensagem
  texto: string | null
  midiaId: string | null
  midiaMime: string | null
  midiaNome: string | null
  respondeWamid: string | null
  enviadaEm: string
}

export type StatusMensagem = 'enviada' | 'entregue' | 'lida' | 'falhou'

export type StatusRecebido = {
  wamid: string
  status: StatusMensagem
  em: string
  erro: string | null
}

const STATUS_DA_META: Record<string, StatusMensagem> = {
  sent: 'enviada',
  delivered: 'entregue',
  read: 'lida',
  failed: 'falhou',
}

/** Hex de um ArrayBuffer. */
function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** SHA-256 do texto, em hex (identifica um webhook repetido). */
export async function sha256(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
}

/**
 * Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>"): HMAC-SHA256 do corpo
 * exatamente como chegou, com a chave secreta do app (App Secret). Sem isso,
 * qualquer um poderia mandar mensagens falsas para o webhook.
 */
export async function assinaturaValida(
  corpo: string,
  cabecalho: string | null,
  segredo: string,
): Promise<boolean> {
  if (!cabecalho?.startsWith('sha256=') || !segredo) return false
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const esperado = hex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)))
  const recebido = cabecalho.slice('sha256='.length).toLowerCase()
  // Comparação em tempo constante: não entrega pelo tempo de resposta onde errou.
  if (recebido.length !== esperado.length) return false
  let diferenca = 0
  for (let i = 0; i < esperado.length; i++)
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i)
  return diferenca === 0
}

// Formato do webhook (só o que usamos). Documentação: "Webhooks > messages" da Cloud API.
type Bruto = Record<string, unknown>
const obj = (v: unknown): Bruto => (v && typeof v === 'object' ? (v as Bruto) : {})
const lista = (v: unknown): Bruto[] => (Array.isArray(v) ? v.map(obj) : [])
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** Segundos desde 1970 (como a Meta manda) → ISO. */
function data(segundos: unknown): string {
  const n = Number(segundos)
  return new Date(Number.isFinite(n) && n > 0 ? n * 1000 : Date.now()).toISOString()
}

function lerMensagem(m: Bruto): Omit<MensagemRecebida, 'phoneNumberId' | 'waId' | 'nomePerfil'> {
  const tipoMeta = String(m.type ?? '')
  const base = {
    wamid: String(m.id),
    texto: null as string | null,
    midiaId: null as string | null,
    midiaMime: null as string | null,
    midiaNome: null as string | null,
    respondeWamid: texto(obj(m.context).id),
    enviadaEm: data(m.timestamp),
  }
  const midia = (chave: string, tipo: TipoMensagem) => {
    const md = obj(m[chave])
    return {
      ...base,
      tipo,
      texto: texto(md.caption),
      midiaId: texto(md.id),
      midiaMime: texto(md.mime_type),
      midiaNome: texto(md.filename),
    }
  }
  switch (tipoMeta) {
    case 'text':
      return { ...base, tipo: 'texto', texto: texto(obj(m.text).body) }
    case 'image':
      return midia('image', 'imagem')
    case 'audio':
      return midia('audio', 'audio')
    case 'video':
      return midia('video', 'video')
    case 'document':
      return midia('document', 'documento')
    case 'sticker':
      return midia('sticker', 'figurinha')
    case 'location': {
      const l = obj(m.location)
      const partes = [texto(l.name), texto(l.address), `${l.latitude},${l.longitude}`]
      return { ...base, tipo: 'localizacao', texto: partes.filter(Boolean).join('\n') }
    }
    case 'contacts': {
      const linhas = lista(m.contacts).map((c) => {
        const nome = texto(obj(c.name).formatted_name) ?? 'Contato'
        const fones = lista(c.phones)
          .map((f) => texto(f.phone))
          .filter(Boolean)
        return [nome, ...fones].join(': ')
      })
      return { ...base, tipo: 'contato', texto: linhas.join('\n') || 'Contato' }
    }
    case 'reaction': {
      const r = obj(m.reaction)
      return {
        ...base,
        tipo: 'reacao',
        texto: texto(r.emoji),
        respondeWamid: texto(r.message_id),
      }
    }
    case 'button':
      return { ...base, tipo: 'botao', texto: texto(obj(m.button).text) }
    case 'interactive': {
      const i = obj(m.interactive)
      const escolha = obj(i.button_reply ?? i.list_reply)
      return { ...base, tipo: 'botao', texto: texto(escolha.title) }
    }
    default:
      // "unsupported", "order", "system"…: guarda para não perder, com o tipo no texto.
      return {
        ...base,
        tipo: 'outro',
        texto: `[Mensagem do tipo "${tipoMeta || 'desconhecido'}" que o sistema ainda não mostra]`,
      }
  }
}

function lerErro(erros: unknown): string | null {
  const e = lista(erros)[0]
  if (!e) return null
  const detalhe = texto(obj(e.error_data).details) ?? texto(e.message) ?? texto(e.title)
  return [e.code, detalhe].filter((x) => x !== undefined && x !== null).join(': ') || null
}

/** Lê um webhook da Meta: mensagens recebidas e mudanças de status das enviadas. */
export function lerWebhook(corpo: unknown): {
  mensagens: MensagemRecebida[]
  status: StatusRecebido[]
} {
  const mensagens: MensagemRecebida[] = []
  const status: StatusRecebido[] = []
  const raiz = obj(corpo)
  if (raiz.object !== 'whatsapp_business_account') return { mensagens, status }

  for (const entrada of lista(raiz.entry)) {
    for (const mudanca of lista(entrada.changes)) {
      if (mudanca.field !== 'messages') continue
      const valor = obj(mudanca.value)
      const phoneNumberId = String(obj(valor.metadata).phone_number_id ?? '')
      const nomes = new Map(
        lista(valor.contacts).map((c) => [String(c.wa_id), texto(obj(c.profile).name)]),
      )
      for (const m of lista(valor.messages)) {
        if (!m.id || !m.from) continue
        const waId = String(m.from)
        mensagens.push({
          phoneNumberId,
          waId,
          nomePerfil: nomes.get(waId) ?? null,
          ...lerMensagem(m),
        })
      }
      for (const s of lista(valor.statuses)) {
        const st = STATUS_DA_META[String(s.status)]
        if (!s.id || !st) continue
        status.push({
          wamid: String(s.id),
          status: st,
          em: data(s.timestamp),
          erro: lerErro(s.errors),
        })
      }
    }
  }
  return { mensagens, status }
}

// -----------------------------------------------------------------------------
// Envio de arquivos: tipos e tamanhos aceitos pela Meta (Cloud API, "Supported media types").
// -----------------------------------------------------------------------------

type TipoEnvio = 'image' | 'video' | 'audio' | 'document'

const MB = 1024 * 1024
const LIMITES: Record<TipoEnvio, number> = {
  image: 5 * MB,
  video: 16 * MB,
  audio: 16 * MB,
  document: 100 * MB,
}

const IMAGENS = ['image/jpeg', 'image/png']
const VIDEOS = ['video/mp4', 'video/3gpp']
const AUDIOS = ['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg']

export const TIPO_DO_ENVIO: Record<TipoEnvio, TipoMensagem> = {
  image: 'imagem',
  video: 'video',
  audio: 'audio',
  document: 'documento',
}

/**
 * Como mandar um arquivo: como foto, vídeo, áudio ou documento. Foto e vídeo em
 * formato que a Meta não aceita (ou grandes demais) vão como documento, que aceita
 * qualquer arquivo até 100 MB. Devolve null quando nem como documento cabe.
 */
export function comoEnviar(mime: string, tamanho: number): TipoEnvio | null {
  const tipo = mime.split(';')[0].trim().toLowerCase()
  let escolhido: TipoEnvio = 'document'
  if (IMAGENS.includes(tipo)) escolhido = 'image'
  else if (VIDEOS.includes(tipo)) escolhido = 'video'
  else if (AUDIOS.includes(tipo)) escolhido = 'audio'
  if (tamanho > LIMITES[escolhido]) escolhido = 'document'
  return tamanho > LIMITES.document ? null : escolhido
}

/** Extensão para guardar a mídia recebida no Storage. */
export function extensaoDoMime(mime: string | null, nome: string | null): string {
  const doNome = nome?.match(/\.([a-z0-9]{1,8})$/i)?.[1]
  if (doNome) return doNome.toLowerCase()
  const tipo = (mime ?? '').split(';')[0].trim().toLowerCase()
  const conhecidas: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
    'application/pdf': 'pdf',
  }
  return conhecidas[tipo] ?? 'bin'
}

/** A janela de atendimento de 24 horas, contada da última mensagem do cliente. */
export function janelaAberta(ultimaEntradaEm: string | null, agora = Date.now()): boolean {
  if (!ultimaEntradaEm) return false
  return agora - new Date(ultimaEntradaEm).getTime() < 24 * 60 * 60 * 1000
}

/** Mensagem de erro da Graph API em português, para quem está atendendo. */
export function explicarErroMeta(codigo: number | undefined, mensagem: string): string {
  switch (codigo) {
    case 131047:
      return 'Passaram 24 horas da última mensagem do cliente. Agora só dá para mandar um modelo (template) aprovado pela Meta.'
    case 131026:
      return 'A mensagem não pôde ser entregue: o número pode não ter WhatsApp ou estar com uma versão antiga.'
    case 131053:
      return 'A Meta não aceitou o arquivo. Confira o tipo e o tamanho.'
    case 190:
      return 'O token da Meta expirou ou é inválido. Avise o administrador.'
    case 131056:
      return 'Muitas mensagens seguidas para este número. Espere um pouco e tente de novo.'
    case 130429:
    case 80007:
      return 'Limite de envios da Meta atingido. Tente de novo em alguns minutos.'
    default:
      return `A Meta recusou a mensagem${codigo ? ` (código ${codigo})` : ''}: ${mensagem}`
  }
}
