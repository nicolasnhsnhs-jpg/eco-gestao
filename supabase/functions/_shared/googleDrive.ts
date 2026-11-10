// Google Drive (API v3) entrando com a conta Gmail da unidade ("Meu Drive").
// Alguém da empresa autoriza uma vez (scripts/autorizar-drive.mjs) e o sistema guarda a
// "chave de renovação" (refresh token): daí em diante entra sozinho, sem senha.
//
// Segredos da função:
//   GOOGLE_DRIVE_CONTA  JSON com client_id, client_secret e refresh_token (o que o script gera)
//   GOOGLE_DRIVE_RAIZ   opcional: id da pasta onde estão ADM, GERAL, FINANCEIRO e VENDAS.
//                       Sem ele, as quatro pastas ficam direto no "Meu Drive".

const PASTA = 'application/vnd.google-apps.folder'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
/** Funciona também se um dia as pastas forem para um Drive compartilhado. */
const TODOS = 'supportsAllDrives=true'
const BUSCA = `${TODOS}&includeItemsFromAllDrives=true&fields=files(id,name)&pageSize=10&orderBy=createdTime`

type Conta = { client_id: string; client_secret: string; refresh_token: string }

export function configuracaoDrive(): { conta: Conta; raiz: string } | null {
  const json = Deno.env.get('GOOGLE_DRIVE_CONTA')
  if (!json) return null
  const conta = JSON.parse(json) as Conta
  if (!conta.client_id || !conta.client_secret || !conta.refresh_token) {
    throw new Error('GOOGLE_DRIVE_CONTA precisa de client_id, client_secret e refresh_token.')
  }
  return { conta, raiz: Deno.env.get('GOOGLE_DRIVE_RAIZ')?.trim() || 'root' }
}

let token: { valor: string; ate: number } | null = null

async function pegarToken(conta: Conta): Promise<string> {
  if (token && token.ate > Date.now() + 60_000) return token.valor
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: conta.client_id,
      client_secret: conta.client_secret,
      refresh_token: conta.refresh_token,
    }),
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) {
    // invalid_grant: a autorização foi revogada (ou a senha da conta mudou). Autorizar de novo.
    throw new Error(
      `O Google recusou a autorização do Drive (${corpo.error ?? r.status}). Rode de novo o scripts/autorizar-drive.mjs.`,
    )
  }
  token = { valor: corpo.access_token, ate: Date.now() + corpo.expires_in * 1000 }
  return token.valor
}

/** Texto entre aspas simples numa busca do Drive. */
const aspas = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** Tira o que o Drive para computador (Windows) não aceita em nome de pasta/arquivo. */
export function nomeSeguro(s: string) {
  return s
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

export class Drive {
  constructor(private conta: Conta) {}

  private async chamar(url: string, init: RequestInit = {}) {
    const r = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await pegarToken(this.conta)}` },
    })
    const corpo = await r.json().catch(() => ({}))
    if (!r.ok) {
      const motivo = corpo?.error?.message ?? `HTTP ${r.status}`
      throw new Error(`Google Drive: ${motivo}`)
    }
    return corpo
  }

  /** E-mail da conta conectada (para conferir que é a do SC). */
  async emailDaConta(): Promise<string> {
    const corpo = await this.chamar(`${API}/about?fields=user(emailAddress)`)
    return corpo.user?.emailAddress ?? ''
  }

  async buscar(q: string): Promise<{ id: string; name: string }[]> {
    const corpo = await this.chamar(`${API}/files?${BUSCA}&q=${encodeURIComponent(q)}`)
    return corpo.files ?? []
  }

  /** Pasta com este nome dentro de `pai` (ou null). */
  async acharPasta(nome: string, pai: string) {
    const achadas = await this.buscar(
      `name = ${aspas(nome)} and ${aspas(pai)} in parents and mimeType = '${PASTA}' and trashed = false`,
    )
    return achadas[0]?.id ?? null
  }

  /** Pasta marcada com esta etiqueta dentro de `pai` (sobrevive à troca de nome). */
  async acharPastaEtiquetada(chave: string, valor: string, pai: string) {
    const achadas = await this.buscar(
      `${aspas(pai)} in parents and mimeType = '${PASTA}' and trashed = false and appProperties has { key=${aspas(chave)} and value=${aspas(valor)} }`,
    )
    return achadas[0]?.id ?? null
  }

  async criarPasta(nome: string, pai: string, etiquetas?: Record<string, string>) {
    const corpo = await this.chamar(`${API}/files?${TODOS}&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nome,
        mimeType: PASTA,
        parents: [pai],
        appProperties: etiquetas,
      }),
    })
    return corpo.id as string
  }

  /** Manda para a lixeira do Drive (dá para recuperar por 30 dias). */
  async lixeira(id: string) {
    await this.chamar(`${API}/files/${id}?${TODOS}&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }

  async etiquetar(id: string, etiquetas: Record<string, string>) {
    await this.chamar(`${API}/files/${id}?${TODOS}&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties: etiquetas }),
    })
  }

  /**
   * Manda o arquivo para a pasta. Se já houver um com o mesmo nome (ex.: o PDF da OS
   * gerado de novo), troca o conteúdo dele: o Drive guarda a versão anterior.
   */
  async enviar(pasta: string, nome: string, tipo: string, conteudo: Uint8Array): Promise<string> {
    const existente = (
      await this.buscar(`name = ${aspas(nome)} and ${aspas(pasta)} in parents and trashed = false`)
    )[0]
    const limite = `eco${crypto.randomUUID().replace(/-/g, '')}`
    const metadados = existente ? {} : { name: nome, parents: [pasta], mimeType: tipo }
    const inicio = new TextEncoder().encode(
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadados)}\r\n` +
        `--${limite}\r\nContent-Type: ${tipo}\r\n\r\n`,
    )
    const fim = new TextEncoder().encode(`\r\n--${limite}--`)
    const corpo = new Uint8Array(inicio.length + conteudo.length + fim.length)
    corpo.set(inicio, 0)
    corpo.set(conteudo, inicio.length)
    corpo.set(fim, inicio.length + conteudo.length)
    const url = existente
      ? `${UPLOAD}/files/${existente.id}?uploadType=multipart&${TODOS}&fields=id`
      : `${UPLOAD}/files?uploadType=multipart&${TODOS}&fields=id`
    const r = await this.chamar(url, {
      method: existente ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
      body: corpo,
    })
    if (existente) return r.id as string
    // Dois envios ao mesmo tempo criam dois arquivos com o mesmo nome: fica o mais antigo
    // (com o conteúdo novo) e o outro vai para a lixeira.
    const iguais = await this.buscar(
      `name = ${aspas(nome)} and ${aspas(pasta)} in parents and trashed = false`,
    )
    if (iguais.length > 1 && iguais[0].id !== r.id) {
      await this.lixeira(r.id).catch(() => {})
      return iguais[0].id
    }
    return r.id as string
  }
}
