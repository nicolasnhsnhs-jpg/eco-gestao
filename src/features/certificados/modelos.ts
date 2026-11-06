import type { Tables } from '@/lib/database.types'
import { formatarData, somarMeses } from '@/lib/datas'

/*
 * Modelos de certificado, tirados dos certificados em PowerPoint que a empresa usa hoje.
 * Cada tipo de serviço tem o seu: cor de destaque, título, frase e quais blocos aparecem.
 * O desenho do PDF fica em pdf/gerarPdfCertificado.ts.
 */

export const MODELOS = ['pragas', 'reservatorio', 'coifa', 'succao', 'geral'] as const
export type ModeloCertificado = (typeof MODELOS)[number]

/** Como os blocos do meio da página são arrumados. */
export type Arranjo =
  | 'areas_produtos' // áreas à esquerda, produtos à direita (pragas)
  | 'produtos_areas' // produtos à esquerda, áreas à direita (coifa)
  | 'reservatorios' // tabela quantidade · local · m³ · produto (reservatório)
  | 'descricao' // descrição no centro, com MTR e volume (sucção)

export type Modelo = {
  /** Nome do modelo na tela. */
  nome: string
  /** Cor de destaque do serviço no PDF (os demais tons são os da marca). */
  destaque: { forte: string; claro: string }
  arranjo: Arranjo
  /** Mostra a linha "Pragas Alvo (...)". */
  temPragas: boolean
  /** A sucção tem outra responsável técnica e outro rodapé. */
  responsavelSuccao: boolean
  /** Sugestões que já vêm preenchidas (dá para mudar em cada certificado). */
  padrao: {
    titulo: string
    servicoDescrito: string
    pragasAlvo?: string
    complemento?: string
  }
}

const VERDE = { forte: '#3E7B1F', claro: '#EEF7DF' }
const AZUL = { forte: '#1D6FA5', claro: '#E7F1F8' }
const GRAFITE = { forte: '#46555F', claro: '#EEF1F3' }

export const MODELO: Record<ModeloCertificado, Modelo> = {
  pragas: {
    nome: 'Controle de pragas',
    destaque: VERDE,
    arranjo: 'areas_produtos',
    temPragas: true,
    responsavelSuccao: false,
    padrao: {
      titulo: 'CERTIFICADO DE CONTROLE DE INSETOS',
      servicoDescrito: 'CONTROLE de INSETOS',
      pragasAlvo: 'baratas, formigas, traças e aranhas',
    },
  },
  reservatorio: {
    nome: 'Limpeza de reservatório',
    destaque: AZUL,
    arranjo: 'reservatorios',
    temPragas: false,
    responsavelSuccao: false,
    padrao: {
      titulo: 'LIMPEZA E DESINFECÇÃO DE RESERVATÓRIO DE ÁGUA POTÁVEL',
      servicoDescrito: 'LIMPEZA E DESINFECÇÃO nos Reservatórios de Água Potável',
      complemento: 'O Processo de Desinfecção foi através de limpeza mecânica.',
    },
  },
  coifa: {
    nome: 'Limpeza de coifa',
    destaque: GRAFITE,
    arranjo: 'produtos_areas',
    temPragas: false,
    responsavelSuccao: false,
    padrao: {
      titulo: 'LIMPEZA E HIGIENIZAÇÃO DE COIFA DE COZINHA INDUSTRIAL',
      servicoDescrito: 'Limpeza e Higienização de COIFA',
    },
  },
  succao: {
    nome: 'Sucção e hidrojateamento',
    destaque: VERDE,
    arranjo: 'descricao',
    temPragas: false,
    responsavelSuccao: true,
    padrao: {
      titulo: 'SERVIÇO DE SUCÇÃO E HIDROJATEAMENTO',
      servicoDescrito: 'SUCÇÃO DE RESÍDUOS E HIDROJATEAMENTO',
    },
  },
  geral: {
    nome: 'Outros serviços',
    destaque: VERDE,
    arranjo: 'areas_produtos',
    temPragas: false,
    responsavelSuccao: false,
    padrao: { titulo: '', servicoDescrito: '' },
  },
}

/** Título e frase padrão de um modelo; no "geral" vêm do nome do serviço. */
export function padraoDoModelo(modelo: ModeloCertificado, nomeServico: string) {
  const p = MODELO[modelo].padrao
  return {
    titulo: p.titulo || nomeServico.toUpperCase(),
    servicoDescrito: p.servicoDescrito || nomeServico.toUpperCase(),
    pragasAlvo: p.pragasAlvo ?? '',
    complemento: p.complemento ?? '',
  }
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type Tipo = Pick<Tables<'tipos_servico'>, 'nome' | 'formulario_os'>

/** Qual modelo usar para um tipo de serviço. */
export function modeloDoTipo(tipo: Tipo | null | undefined): ModeloCertificado {
  if (!tipo) return 'geral'
  if (tipo.formulario_os === 'pragas') return 'pragas'
  if (tipo.formulario_os === 'coifa') return 'coifa'
  const nome = semAcento(tipo.nome)
  if (nome.includes('reservat') || nome.includes('caixa d')) return 'reservatorio'
  if (nome.includes('succao') || nome.includes('fossa') || nome.includes('hidrojat'))
    return 'succao'
  if (nome.includes('praga') || nome.includes('dedetiz') || nome.includes('desratiz'))
    return 'pragas'
  if (nome.includes('coifa')) return 'coifa'
  return 'geral'
}

// -----------------------------------------------------------------------------
// Validade
//   contrato → vale até o último dia do mês ("Certificado válido até o dia 30/04/2027.")
//   avulso   → vale até a data exata; a data vai embaixo e a validade em meses ao lado.
// A renovação muda de cliente para cliente.
// -----------------------------------------------------------------------------

export type TipoValidade = 'contrato' | 'avulso'

export const PERIODICIDADES = [
  { meses: 1, nome: 'Mensal' },
  { meses: 2, nome: 'Bimestral' },
  { meses: 3, nome: 'Trimestral' },
  { meses: 4, nome: 'Quadrimestral' },
  { meses: 6, nome: 'Semestral' },
  { meses: 12, nome: 'Anual' },
] as const

/** "2026-04-10" → "2026-04-30" */
export function fimDoMes(iso: string): string {
  const [ano, mes] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10)
}

export function calcularValidade(
  dataExecucao: string,
  meses: number | null | undefined,
  tipo: TipoValidade,
): string {
  if (!dataExecucao || !meses) return ''
  const alvo = somarMeses(dataExecucao, meses)
  return tipo === 'contrato' ? fimDoMes(alvo) : alvo
}

/** "Validade: 06 meses" (avulso) */
export const textoValidadeMeses = (meses: number) =>
  `Validade: ${String(meses).padStart(2, '0')} ${meses === 1 ? 'mês' : 'meses'}`

/** "Certificado válido até o dia 30/04/2027." (contrato) */
export const textoValidoAte = (validade: string) =>
  `Certificado válido até o dia ${formatarData(validade)}.`

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/** "Esteio, 18 de Outubro de 2026." */
export function localEData(cidade: string, iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return `${cidade}, ${dia} de ${MESES[mes - 1]} de ${ano}.`
}

// -----------------------------------------------------------------------------
// Frase de abertura
// -----------------------------------------------------------------------------

/** "no dia 27/10/2026" ou "nos dias 21/10 e 27/10/2026" */
export function textoDias(datas: string[]): string {
  const lista = [...new Set(datas.filter(Boolean))].sort()
  if (lista.length === 0) return ''
  if (lista.length === 1) return `no dia ${formatarData(lista[0])}`
  const mesmoAno = lista.every((d) => d.slice(0, 4) === lista[0].slice(0, 4))
  const curtas = lista.map((d, i) =>
    mesmoAno && i < lista.length - 1 ? formatarData(d).slice(0, 5) : formatarData(d),
  )
  return `nos dias ${curtas.slice(0, -1).join(', ')} e ${curtas[curtas.length - 1]}`
}

export type DadosDeclaracao = {
  servicoDescrito: string
  cliente: string
  /** Vazio no certificado avulso (a data vai embaixo). */
  dias: string
  endereco: string
  documento: string
  /** CPF (11 dígitos) ou CNPJ. */
  ehCpf: boolean
  complemento?: string | null
}

/**
 * A frase em pedaços, para o PDF pôr o serviço e o cliente em negrito:
 * "Certificamos para os devidos fins que foram realizados os serviços de **X** nas
 * dependências de **CLIENTE** no dia 27/10/2026, localizada na …, inscrita sob CNPJ nº …."
 */
export function declaracao(d: DadosDeclaracao): { texto: string; negrito: boolean }[] {
  const depois = [
    d.dias && ` ${d.dias}`,
    d.endereco && `, localizada na ${d.endereco}`,
    d.documento && `, inscrita sob ${d.ehCpf ? 'CPF' : 'CNPJ'} nº ${d.documento}`,
    '.',
    d.complemento?.trim() && ` ${d.complemento.trim()}`,
  ]
    .filter(Boolean)
    .join('')
  return [
    {
      texto: 'Certificamos para os devidos fins que foram realizados os serviços de ',
      negrito: false,
    },
    { texto: d.servicoDescrito, negrito: true },
    { texto: ' nas dependências de ', negrito: false },
    { texto: d.cliente, negrito: true },
    { texto: depois, negrito: false },
  ]
}

// -----------------------------------------------------------------------------
// Produtos e reservatórios (guardados em JSON no certificado)
// -----------------------------------------------------------------------------

/** Um produto aplicado, copiado do catálogo na emissão. */
export type ProdutoCertificado = {
  nome_comercial: string
  principio_ativo: string
  registro: string
  quantidade: string
  lote: string
  /** AAAA-MM-01 */
  fabricacao: string
  validade: string
}

export type ReservatorioCertificado = {
  quantidade: string
  local: string
  metragem: string
  produto: string
}

const MES_CURTO = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

/** "2024-07-01" → "Jul24" (como nos certificados) */
export function mesCurto(iso: string | null | undefined) {
  if (!iso) return ''
  const [ano, mes] = iso.split('-')
  return `${MES_CURTO[Number(mes) - 1]}${ano.slice(2)}`
}

/** As duas linhas de um produto no certificado. */
export function linhasDoProduto(p: ProdutoCertificado): [string, string] {
  const nome = [p.nome_comercial, p.principio_ativo].filter((t) => t?.trim()).join(' ')
  const primeira = [
    nome,
    p.registro?.trim() && ` (${p.registro.trim()})`,
    p.quantidade?.trim() && ` - ${p.quantidade.trim()}`,
  ]
    .filter(Boolean)
    .join('')
  const segunda = [
    p.lote?.trim() && `Lote ${p.lote.trim()}`,
    p.fabricacao && `Fab. ${mesCurto(p.fabricacao)}`,
    p.validade && `Val. ${mesCurto(p.validade)}`,
  ]
    .filter(Boolean)
    .join(' - ')
  return [primeira, segunda]
}

const texto = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

export function lerProdutos(valor: unknown): ProdutoCertificado[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({
      nome_comercial: texto(p.nome_comercial),
      principio_ativo: texto(p.principio_ativo),
      registro: texto(p.registro),
      quantidade: texto(p.quantidade),
      lote: texto(p.lote),
      fabricacao: texto(p.fabricacao),
      validade: texto(p.validade),
    }))
    .filter((p) => p.principio_ativo.trim() !== '' || p.nome_comercial.trim() !== '')
}

export function lerReservatorios(valor: unknown): ReservatorioCertificado[] {
  if (!Array.isArray(valor)) return []
  return valor
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      quantidade: texto(r.quantidade),
      local: texto(r.local),
      metragem: texto(r.metragem),
      produto: texto(r.produto),
    }))
    .filter((r) => Object.values(r).some((v) => v.trim() !== ''))
}
