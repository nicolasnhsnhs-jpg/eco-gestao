import {
  buscarCep,
  ehCelular,
  formatarCep,
  formatarTelefone,
  limparDocumento,
  soNumeros,
  telefoneValido,
} from '@/lib/documentos'

import { UFS, type FormCliente, type FormEndereco } from './esquemas'

/*
 * Consulta de CNPJ em serviços públicos e gratuitos com os dados da Receita Federal:
 * BrasilAPI (principal) e CNPJ.ws (reserva, e também para completar e-mail e inscrição
 * estadual, que a BrasilAPI às vezes não traz). Os dois aceitam chamada direto do navegador.
 * A Sefaz não tem consulta aberta.
 */

export type EnderecoCnpj = Omit<FormEndereco, 'apelido' | 'principal'>

export type DadosCnpj = {
  razao_social: string
  nome_fantasia: string
  /** "ATIVA", "BAIXADA", "INAPTA"… */
  situacao: string
  email: string
  /** Telefones válidos (só números, com DDD). */
  telefones: string[]
  inscricao_estadual: string
  endereco: EnderecoCnpj
}

export class ErroConsultaCnpj extends Error {}

/** Junta espaços repetidos e tira os das pontas. */
function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : ''
}

function telefones(...numeros: unknown[]): string[] {
  return numeros.map((n) => soNumeros(texto(n))).filter((n) => telefoneValido(n))
}

/** "RUA" + "GARIBALDI" → "RUA GARIBALDI" (sem repetir quando o tipo já vem no nome). */
function logradouro(tipo: unknown, nome: unknown): string {
  const t = texto(tipo)
  const n = texto(nome)
  if (!t || n.toUpperCase().startsWith(t.toUpperCase() + ' ')) return n
  return `${t} ${n}`.trim()
}

function uf(valor: unknown): string {
  const u = texto(valor).toUpperCase()
  return UFS.includes(u) ? u : ''
}

function ibge(valor: unknown): string {
  const c = String(valor ?? '')
  return /^\d{7}$/.test(c) ? c : ''
}

/** Resposta de https://brasilapi.com.br/api/cnpj/v1/{cnpj} */
export function deBrasilApi(r: Record<string, unknown>): DadosCnpj {
  return {
    razao_social: texto(r.razao_social),
    nome_fantasia: texto(r.nome_fantasia),
    situacao: texto(r.descricao_situacao_cadastral).toUpperCase(),
    email: texto(r.email).toLowerCase(),
    telefones: telefones(r.ddd_telefone_1, r.ddd_telefone_2),
    inscricao_estadual: '',
    endereco: {
      cep: formatarCep(texto(r.cep)),
      logradouro: logradouro(r.descricao_tipo_de_logradouro, r.logradouro),
      numero: texto(r.numero),
      complemento: texto(r.complemento),
      bairro: texto(r.bairro),
      cidade: texto(r.municipio),
      uf: uf(r.uf),
      codigo_ibge: ibge(r.codigo_municipio_ibge),
    },
  }
}

type RespostaCnpjWs = {
  razao_social?: string
  estabelecimento?: {
    nome_fantasia?: string | null
    situacao_cadastral?: string
    tipo_logradouro?: string | null
    logradouro?: string
    numero?: string
    complemento?: string | null
    bairro?: string
    cep?: string
    ddd1?: string | null
    telefone1?: string | null
    ddd2?: string | null
    telefone2?: string | null
    email?: string | null
    estado?: { sigla?: string }
    cidade?: { nome?: string; ibge_id?: number }
    inscricoes_estaduais?: {
      inscricao_estadual?: string
      ativo?: boolean
      estado?: { sigla?: string }
    }[]
  }
}

/** Resposta de https://publica.cnpj.ws/cnpj/{cnpj} */
export function deCnpjWs(r: RespostaCnpjWs): DadosCnpj {
  const e = r.estabelecimento ?? {}
  const estado = uf(e.estado?.sigla)
  const ie = (e.inscricoes_estaduais ?? []).find(
    (i) => i.ativo && (!estado || i.estado?.sigla === estado),
  )
  return {
    razao_social: texto(r.razao_social),
    nome_fantasia: texto(e.nome_fantasia),
    situacao: texto(e.situacao_cadastral).toUpperCase(),
    email: texto(e.email).toLowerCase(),
    telefones: telefones(
      `${e.ddd1 ?? ''}${e.telefone1 ?? ''}`,
      `${e.ddd2 ?? ''}${e.telefone2 ?? ''}`,
    ),
    inscricao_estadual: texto(ie?.inscricao_estadual),
    endereco: {
      cep: formatarCep(texto(e.cep)),
      logradouro: logradouro(e.tipo_logradouro, e.logradouro),
      numero: texto(e.numero),
      complemento: texto(e.complemento),
      bairro: texto(e.bairro),
      cidade: texto(e.cidade?.nome),
      uf: estado,
      codigo_ibge: ibge(e.cidade?.ibge_id),
    },
  }
}

const NAO_ENCONTRADO = 'CNPJ não encontrado na Receita Federal. Confira os números.'
const FALHOU =
  'Não foi possível consultar o CNPJ agora. Tente de novo em instantes ou preencha à mão.'

type Resultado = { ok: true; dados: DadosCnpj } | { ok: false; naoEncontrado: boolean }

async function buscar<T>(url: string, mapear: (r: T) => DadosCnpj): Promise<Resultado> {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    // 400 (inválido) e 404 (não existe) são respostas definitivas; o resto é falha do serviço.
    if (resposta.status === 404 || resposta.status === 400)
      return { ok: false, naoEncontrado: true }
    if (!resposta.ok) return { ok: false, naoEncontrado: false }
    const dados = mapear((await resposta.json()) as T)
    return dados.razao_social ? { ok: true, dados } : { ok: false, naoEncontrado: false }
  } catch {
    return { ok: false, naoEncontrado: false }
  }
}

const brasilApi = (cnpj: string) =>
  buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, deBrasilApi)
const cnpjWs = (cnpj: string) => buscar(`https://publica.cnpj.ws/cnpj/${cnpj}`, deCnpjWs)

/** Usa o que a principal trouxe e completa o que faltou com a reserva. */
export function completar(principal: DadosCnpj, reserva: DadosCnpj): DadosCnpj {
  return {
    ...principal,
    nome_fantasia: principal.nome_fantasia || reserva.nome_fantasia,
    email: principal.email || reserva.email,
    telefones: principal.telefones.length ? principal.telefones : reserva.telefones,
    inscricao_estadual: principal.inscricao_estadual || reserva.inscricao_estadual,
    endereco: {
      ...principal.endereco,
      // A CNPJ.ws traz o nome da cidade com acento ("Salvador do Sul").
      cidade: reserva.endereco.cidade || principal.endereco.cidade,
      codigo_ibge: principal.endereco.codigo_ibge || reserva.endereco.codigo_ibge,
    },
  }
}

async function consultarFontes(cnpj: string): Promise<DadosCnpj> {
  const principal = await brasilApi(cnpj)

  if (principal.ok) {
    if (principal.dados.email && principal.dados.inscricao_estadual) return principal.dados
    // Tenta completar e-mail e inscrição estadual; se a reserva falhar, fica o que veio.
    const reserva = await cnpjWs(cnpj)
    return reserva.ok ? completar(principal.dados, reserva.dados) : principal.dados
  }

  const reserva = await cnpjWs(cnpj)
  if (reserva.ok) return reserva.dados
  throw new ErroConsultaCnpj(
    principal.naoEncontrado || reserva.naoEncontrado ? NAO_ENCONTRADO : FALHOU,
  )
}

/** Consulta o CNPJ. Lança ErroConsultaCnpj com a mensagem para mostrar na tela. */
export async function consultarCnpj(valor: string): Promise<DadosCnpj> {
  const dados = await consultarFontes(limparDocumento(valor))
  // O ViaCEP dá o nome da cidade com acento e o código IBGE que a nota fiscal usa.
  const cep = dados.endereco.cep ? await buscarCep(dados.endereco.cep) : null
  if (!cep?.cidade || !UFS.includes(cep.uf)) return dados
  return {
    ...dados,
    endereco: {
      ...dados.endereco,
      cidade: cep.cidade,
      uf: cep.uf,
      codigo_ibge: ibge(cep.ibge) || dados.endereco.codigo_ibge,
    },
  }
}

// -----------------------------------------------------------------------------
// Do resultado para os campos do formulário
// -----------------------------------------------------------------------------

type CampoCliente =
  'nome' | 'nome_fantasia' | 'inscricao_estadual' | 'email' | 'telefone' | 'whatsapp'
type CampoEndereco = 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade'

export type Conflito =
  | { form: 'cliente'; campo: CampoCliente; rotulo: string; atual: string; novo: string }
  | { form: 'endereco'; campo: CampoEndereco; rotulo: string; atual: string; novo: string }

export type Preenchimento = {
  cliente: Partial<Pick<FormCliente, CampoCliente>>
  endereco: Partial<EnderecoCnpj>
  /** Campos que a pessoa já tinha preenchido com outro valor: ficam como estão até ela decidir. */
  conflitos: Conflito[]
}

const ROTULOS: Record<CampoCliente | CampoEndereco, string> = {
  nome: 'Razão social',
  nome_fantasia: 'Nome fantasia',
  inscricao_estadual: 'Inscrição estadual',
  email: 'E-mail',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  cep: 'CEP',
  logradouro: 'Rua',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
}

/** Compara sem ligar para maiúsculas, acentos, pontuação e espaços. */
function mesmoValor(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[^0-9a-z]/gi, '')
      .toLowerCase()
  return n(a) === n(b)
}

/**
 * Decide o que preencher. Campo vazio (ou ainda com o valor padrão do formulário, como a
 * cidade da unidade) recebe o dado da Receita; campo que a pessoa já preencheu com outro
 * valor vira um conflito, para ela escolher se troca.
 * `endereco` e `enderecoVazio` ficam de fora quando o formulário não tem endereço (edição).
 */
export function planejarPreenchimento(
  dados: DadosCnpj,
  cliente: FormCliente,
  endereco?: FormEndereco,
  enderecoVazio?: FormEndereco,
): Preenchimento {
  const resultado: Preenchimento = { cliente: {}, endereco: {}, conflitos: [] }

  const whatsapp = dados.telefones.find((t) => ehCelular(t)) ?? ''
  const telefone = dados.telefones.find((t) => t !== whatsapp) ?? ''
  const novosCliente: Record<CampoCliente, string> = {
    nome: dados.razao_social,
    nome_fantasia: dados.nome_fantasia,
    inscricao_estadual: dados.inscricao_estadual,
    email: dados.email,
    telefone: formatarTelefone(telefone),
    whatsapp: formatarTelefone(whatsapp),
  }
  for (const campo of Object.keys(novosCliente) as CampoCliente[]) {
    const novo = novosCliente[campo]
    const atual = cliente[campo].trim()
    if (!novo || mesmoValor(atual, novo)) continue
    if (atual === '') resultado.cliente[campo] = novo
    else resultado.conflitos.push({ form: 'cliente', campo, rotulo: ROTULOS[campo], atual, novo })
  }

  if (!endereco || !enderecoVazio) return resultado

  const e = dados.endereco
  const campos: CampoEndereco[] = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade']
  for (const campo of campos) {
    const novo = e[campo]
    const atual = endereco[campo].trim()
    if (!novo || mesmoValor(atual, novo)) continue
    const livre = atual === '' || atual === enderecoVazio[campo]
    if (livre) resultado.endereco[campo] = novo
    else resultado.conflitos.push({ form: 'endereco', campo, rotulo: ROTULOS[campo], atual, novo })
  }
  // Estado e código IBGE andam junto com a cidade.
  if (e.uf && e.cidade && (resultado.endereco.cidade || mesmoValor(endereco.cidade, e.cidade))) {
    resultado.endereco.uf = e.uf
    if (e.codigo_ibge) resultado.endereco.codigo_ibge = e.codigo_ibge
  }
  return resultado
}
