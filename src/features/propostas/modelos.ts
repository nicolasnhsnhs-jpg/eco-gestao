import { reaisPorExtenso } from '@/lib/extenso'
import { formatarReais } from '@/lib/dinheiro'
import { UNIDADE } from '@/lib/unidade'

/*
 * Modelos de serviço da proposta, tirados das propostas em Word usadas hoje.
 *
 * Cada serviço da proposta escolhe um modelo, que preenche o título da seção, o
 * escopo, a metodologia e os recursos. Tudo pode ser editado na proposta; o que
 * vale é o que ficou gravado no item. O PDF junta tudo assim:
 *
 *   1. SERVIÇO DE … / SEMESTRAL     (uma seção por serviço, com o escopo)
 *   2. SERVIÇO DE … / AVULSO
 *   3. METODOLOGIA                   (as metodologias dos serviços, sem repetir)
 *   4. RECURSOS                      (os recursos dos serviços, sem repetir linha)
 *   5. CUSTOS                        (valores, pagamento, acréscimo, validade)
 *
 * Nos textos, "**assim**" sai em negrito e linha começando com "- " vira marcador.
 */

type DadosUnidade = (typeof UNIDADE)['proposta']

export type ModeloServico = {
  nome: string
  /** Nome no catálogo de tipos de serviço (liga o item ao serviço/certificado). */
  tipo: string | null
  /** Como aparece na apresentação: "prestação de serviços {assunto}". */
  assunto: string
  titulo: string
  /** Linha do serviço nos custos. */
  descricao: string
  escopo: string
  metodologia: string
  recursos: (u: DadosUnidade) => (string | null | false | undefined)[]
  /** Frequência sugerida (meses); vazio = avulso. */
  periodicidade?: number
}

// -----------------------------------------------------------------------------
// Textos que se repetem
// -----------------------------------------------------------------------------

const ASSUNTO_PRAGAS = 'em Controle de Pragas Urbanas'
const ASSUNTO_AGUA = 'em Controle de Potabilidade de Água'

const MET_INSETOS =
  '**Insetos:** Técnicas gerais de pulverização, além de atomização e termonebulização, tratamento de polvilhamento preventivo da rede cloacal com infestação ativa.\n' +
  '**Gel e iscas:** Poderão ser utilizados estes processos com abrangência total ou parcial dos ambientes, não sendo nestes casos necessário o isolamento dos mesmos, podendo ser realizados nas visitas de monitoramento e inspeções.'
const MET_ROEDORES =
  '**Roedores:** Técnicas com iscas e outros expedientes eficazes. Ênfase em princípio ativo que atua no sistema de coagulação sanguínea do roedor, com resultado letal retardado. Isto evita que os roedores associem o efeito ao consumo. Forma de aplicação e riscos extremamente seguros ao ambiente.'
const MET_CIP =
  '**Sistema CIP:** O sistema CIP (clean in place) é utilizado na limpeza e higienização interna de equipamentos e tubulações. Quando necessário, realizamos a abertura da mesma e, em seguida, a raspagem mecânica interna, eliminando toda a gordura. O processo é realizado em circuito fechado, por meio da circulação da solução de limpeza/sanitizante.'

const NR33 =
  'Mão de obra especializada com técnicos devidamente qualificados e certificados na **NR 33 e NR 35**, trabalhos executados com toda segurança e qualidade; possuímos Equipamentos de Proteção Individual, Coletivos, Resgate, além de Detector de Gases Atmosférico;'
const PRODUTOS =
  'Produtos de menor risco, aprovados pelo Ministério da Saúde e recomendados pela OMS (Organização Mundial da Saúde);'
const CERTIFICADO_180 = 'Emissão do certificado válido por 180 dias;'

const recursosPragas = (execucao: string) => (u: DadosUnidade) => [
  'Mão de obra especializada;',
  'Emissão do certificado;',
  u.responsavel && `Responsável técnica - ${u.responsavel};`,
  u.alvara && `${u.alvara};`,
  PRODUTOS,
  `Execução do serviço: ${execucao}.`,
]

const recursosAgua = (u: DadosUnidade) => [
  NR33,
  CERTIFICADO_180,
  u.responsavel && `Responsável técnica - ${u.responsavel};`,
  ...u.normas,
  u.alvara && `${u.alvara};`,
  u.licencaSaude && `${u.licencaSaude};`,
  'Execução do serviço: 02 operadores técnicos.',
]

const recursosCoifa = (tempo: string) => (u: DadosUnidade) => [
  NR33,
  `Execução do serviço: 02 técnicos, tempo previsto de ${tempo};`,
  CERTIFICADO_180,
  u.responsavel && `Responsável técnica - ${u.responsavel};`,
  'Portaria 3523 MS, RDC 175 de 08/07/03, NBR 14679 ABNT;',
  'Procedimento com utilização dos EPIs necessários para execução (macacão, luvas, máscara e óculos).',
]

const recursosSuccao = (execucao: string) => (u: DadosUnidade) => [
  'Emissão do certificado de destinação dos resíduos;',
  u.succao && `Responsável técnica: ${u.succao.responsavel};`,
  'Transporte conforme Resolução nº 5998, de 03/11/2022, da Agência Nacional de Transportes Terrestres - ANTT, e resíduos classificados conforme NBR 10004 e NBR 13221 da ABNT;',
  u.succao && `${u.succao.licenca};`,
  `Execução do serviço: ${execucao}.`,
]

// -----------------------------------------------------------------------------
// Modelos
// -----------------------------------------------------------------------------

export const MODELOS = {
  pragas: {
    nome: 'Controle de insetos e roedores',
    tipo: 'Controle de pragas',
    assunto: ASSUNTO_PRAGAS,
    titulo: 'Serviço de controle de pragas urbanas',
    descricao: 'Desinsetização e desratização',
    escopo:
      'Controle de insetos e roedores (baratas, formigas, traças, aranhas e roedores).\n' +
      'Nas dependências de ...',
    metodologia: `${MET_INSETOS}\n${MET_ROEDORES}`,
    recursos: recursosPragas('02 horas / 02 operadores técnicos'),
  },
  insetos: {
    nome: 'Controle de insetos (desinsetização)',
    tipo: 'Controle de pragas',
    assunto: ASSUNTO_PRAGAS,
    titulo: 'Serviço de controle de pragas urbanas',
    descricao: 'Controle de insetos',
    escopo: 'Controle de insetos em geral.\nDesinsetização de ...\n- Prédio ... m²',
    metodologia: MET_INSETOS,
    recursos: recursosPragas('02 horas / 01 operador técnico'),
  },
  roedores: {
    nome: 'Controle de roedores (desratização)',
    tipo: 'Controle de pragas',
    assunto: ASSUNTO_PRAGAS,
    titulo: 'Serviço de controle de pragas urbanas',
    descricao: 'Desratização',
    escopo: 'Desratização: ...\nMonitoramento dos porta-iscas em todas as dependências.',
    metodologia: MET_ROEDORES,
    recursos: recursosPragas('01h30 / 02 operadores técnicos'),
  },
  alados: {
    nome: 'Insetos alados (marimbondos, abelhas)',
    tipo: 'Controle de pragas',
    assunto: ASSUNTO_PRAGAS,
    titulo: 'Serviço de controle de pragas urbanas',
    descricao: 'Controle de insetos alados',
    escopo:
      'Controle de insetos alados (marimbondos, caçotinhos e abelhas).\n' +
      '- 01 ponto de marimbondos ...\nTrabalho em altura entre 3 e 4 metros.',
    metodologia:
      '**Insetos:** Técnicas gerais de pulverização, além de atomização e termonebulização, em ambientes com infestação ativa.',
    recursos: recursosPragas('01 hora / 02 operadores técnicos'),
  },
  cupins: {
    nome: 'Cupins (descupinização)',
    tipo: 'Controle de pragas',
    assunto: ASSUNTO_PRAGAS,
    titulo: 'Serviço de controle de pragas urbanas / descupinização',
    descricao: 'Controle de cupins',
    escopo:
      '**Escopo dos serviços:** tratamento corretivo em ... de madeira, compreendendo uma área de aproximadamente ... m².\n' +
      '- Aplicação de inseticida cupinicida por meio de pulverização em toda a superfície do madeiramento onde houver evidências de atividade de cupins;\n' +
      '- Aplicação injetável nos pontos em que forem identificados focos de infestação ou galerias, visando maior penetração do produto na madeira.',
    metodologia: '',
    recursos: recursosPragas('02 técnicos especializados, entre 2 e 3 horas, podendo variar'),
  },
  reservatorio: {
    nome: "Limpeza de reservatórios (caixa d'água)",
    tipo: 'Limpeza de reservatórios',
    assunto: ASSUNTO_AGUA,
    titulo: 'Serviço de controle de potabilidade da água',
    descricao: 'Limpeza e desinfecção de reservatórios',
    escopo:
      'Limpeza e desinfecção de reservatórios:\n- 02 reservatórios de fibra, capacidade de 500 litros.',
    metodologia: '',
    recursos: recursosAgua,
    periodicidade: 6,
  },
  analise_agua: {
    nome: 'Coleta de água para análise',
    tipo: null,
    assunto: ASSUNTO_AGUA,
    titulo: 'Coleta de água para análise',
    descricao: 'Coleta de água para análise',
    escopo: '01 ponto de coleta.',
    metodologia: '',
    recursos: recursosAgua,
  },
  bebedouro: {
    nome: 'Limpeza de bebedouros',
    tipo: 'Limpeza de bebedouros',
    assunto: ASSUNTO_AGUA,
    titulo: 'Serviço de sanitização de bebedouros',
    descricao: 'Limpeza e desinfecção de bebedouros',
    escopo: 'Limpeza e desinfecção de bebedouros:\n- 01 bebedouro ...',
    metodologia: '',
    recursos: (u: DadosUnidade) => [
      'Mão de obra especializada com técnicos devidamente uniformizados e identificados;',
      ...recursosAgua(u).slice(1, -1),
      'Execução do serviço: 01 operador técnico.',
    ],
    periodicidade: 6,
  },
  coifa: {
    nome: 'Limpeza de coifa',
    tipo: 'Limpeza de coifa',
    assunto: 'de limpeza de coifa',
    titulo: 'Serviço de limpeza de coifa',
    descricao: 'Limpeza e higienização técnica de coifa',
    escopo:
      '**Limpeza, higienização e descontaminação das coifas industriais, de acordo com a NBR 14518 da ABNT e a Portaria 326 ANVISA.**\n' +
      '- 01 coifa ..., com tubulação interna até o alcance das ferramentas de limpeza.\n' +
      '**Obs.:** o plano de serviços prevê a interrupção total da cozinha, ou seja, sem a permanência de pessoas no local.',
    metodologia: MET_CIP,
    recursos: recursosCoifa('1 etapa entre 1h30 e 3 horas'),
    periodicidade: 6,
  },
  forro: {
    nome: 'Limpeza de forro',
    tipo: null,
    assunto: 'de higienização técnica',
    titulo: 'Serviço de limpeza de forros',
    descricao: 'Limpeza do forro',
    escopo:
      '**Higienização técnica desengordurante estrutural:** limpeza completa do forro em PVC, aproximadamente ... metros quadrados.',
    metodologia:
      '**Limpeza técnica do ambiente:** demanda realizada com utilização de detergente específico desengordurante, efetuando raspagem manual com esponjas, escovas, jato de baixa pressão e a repetição do processo até que o objetivo seja atingido.',
    recursos: recursosCoifa('1 etapa entre 2 e 3 horas'),
  },
  ralos: {
    nome: 'Limpeza de ralos',
    tipo: null,
    assunto: '',
    titulo: 'Serviço de limpeza de ralos',
    descricao: 'Limpeza de ralos',
    escopo:
      'Limpeza mecânica de ... ralos lineares e desinsetização após a limpeza.\n**Obs.:** não contempla hidrojateamento da tubulação.',
    metodologia: '',
    recursos: recursosPragas('02 horas / 01 operador técnico'),
  },
  succao: {
    nome: 'Sucção de fossa / ETE',
    tipo: 'Sucção de fossa',
    assunto: '',
    titulo: 'Serviço de limpeza e sucção de resíduos',
    descricao: 'Sucção de resíduos, transporte e descarte',
    escopo:
      '- Serviço de sucção da fossa séptica / ETE até ... m³, com transporte e destinação dos resíduos.',
    metodologia: '',
    recursos: recursosSuccao('02 horas / 02 operadores técnicos'),
  },
  caixa_gordura: {
    nome: 'Limpeza de caixa de gordura',
    tipo: 'Limpeza de caixa de gordura',
    assunto: '',
    titulo: 'Serviço de limpeza de caixa de gordura',
    descricao: 'Limpeza e sucção da caixa de gordura',
    escopo:
      '- Limpeza e sucção de ... caixa(s) de gordura, com transporte e destinação dos resíduos.',
    metodologia: '',
    recursos: recursosSuccao('02 horas / 02 operadores técnicos'),
  },
  hidrojato: {
    nome: 'Diária de caminhão / hidrojato',
    tipo: 'Hidrojateamento',
    assunto: '',
    titulo: 'Serviços de saneamento e manutenção preventiva / transporte e descarte',
    descricao: 'Diária do caminhão',
    escopo: 'Serviço de diária do caminhão realizando hidrojateamento na unidade.',
    metodologia: '',
    recursos: recursosSuccao('02 operadores / caminhão de auto vácuo e hidrojato'),
  },
  desentupimento: {
    nome: 'Desentupimento',
    tipo: 'Desentupimento',
    assunto: '',
    titulo: 'Serviço de desentupimento',
    descricao: 'Desentupimento',
    escopo: 'Desentupimento de ...',
    metodologia: '',
    recursos: () => [
      'Mão de obra especializada, com equipamentos próprios para o serviço;',
      'Execução do serviço: 02 operadores técnicos.',
    ],
  },
  outro: {
    nome: 'Outro serviço',
    tipo: null,
    assunto: '',
    titulo: 'Serviço de ...',
    descricao: '',
    escopo: '',
    metodologia: '',
    recursos: () => [],
  },
} satisfies Record<string, ModeloServico>

export type ChaveModelo = keyof typeof MODELOS

export function modeloDe(chave: string | null | undefined): ModeloServico | null {
  return chave && chave in MODELOS ? MODELOS[chave as ChaveModelo] : null
}

/** Recursos do modelo nesta unidade, uma linha por recurso. */
export function recursosDoModelo(m: ModeloServico, u: DadosUnidade = UNIDADE.proposta) {
  return m
    .recursos(u)
    .filter((l): l is string => !!l)
    .join('\n')
}

// -----------------------------------------------------------------------------
// Frequência e cobrança
// -----------------------------------------------------------------------------

/**
 * Opções de frequência da tela. O valor é o número de meses, ou "semanal" /
 * "quinzenal" (que não cabem em meses e vão para a coluna "frequencia").
 */
export const FREQUENCIAS: { valor: string; nome: string }[] = [
  { valor: '', nome: 'Avulso' },
  { valor: 'semanal', nome: 'Semanal' },
  { valor: 'quinzenal', nome: 'Quinzenal' },
  { valor: '1', nome: 'Mensal' },
  { valor: '2', nome: 'Bimestral' },
  { valor: '3', nome: 'Trimestral' },
  { valor: '4', nome: 'Quadrimestral' },
  { valor: '6', nome: 'Semestral' },
  { valor: '12', nome: 'Anual' },
]

export const FREQUENCIAS_CURTAS = ['semanal', 'quinzenal'] as const
export type FrequenciaCurta = (typeof FREQUENCIAS_CURTAS)[number]

export const ehFrequenciaCurta = (v: string | null | undefined): v is FrequenciaCurta =>
  FREQUENCIAS_CURTAS.includes(v as FrequenciaCurta)

/** Valor da tela → como vai para o banco (meses ou semanal/quinzenal, nunca os dois). */
export function separarFrequencia(valor: string | null | undefined) {
  const v = (valor ?? '').trim()
  if (ehFrequenciaCurta(v)) return { periodicidade_meses: null, frequencia: v }
  return { periodicidade_meses: v ? Number(v) : null, frequencia: null }
}

/** Do banco para a tela. */
export function valorFrequencia(
  meses: number | null | undefined,
  frequencia: string | null | undefined,
) {
  if (ehFrequenciaCurta(frequencia)) return frequencia
  return meses?.toString() ?? ''
}

/** Nome da frequência: aceita o valor da tela (meses ou semanal/quinzenal). */
export function nomeFrequencia(valor: number | string | null | undefined): string {
  const v = valor == null ? '' : String(valor)
  return FREQUENCIAS.find((f) => f.valor === v)?.nome ?? `A cada ${v} meses`
}

export type Cobranca = 'unica' | 'mensal' | 'por_visita'

export const COBRANCAS: { valor: Cobranca; nome: string; sufixo: string }[] = [
  { valor: 'unica', nome: 'Valor do serviço', sufixo: '' },
  { valor: 'mensal', nome: 'Por mês', sufixo: ' mensais' },
  { valor: 'por_visita', nome: 'Por visita', sufixo: ' por visita' },
]

export const sufixoCobranca = (c: string | null | undefined) =>
  COBRANCAS.find((x) => x.valor === c)?.sufixo ?? ''

/** "SERVIÇO DE LIMPEZA DE COIFA / SEMESTRAL" (não repete se já estiver no título). */
export function tituloComFrequencia(titulo: string, valor: number | string | null | undefined) {
  const freq = nomeFrequencia(valor)
  const t = titulo.trim()
  if (sem(t).includes(sem(freq))) return t
  return `${t} / ${freq}`
}

const sem = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

// -----------------------------------------------------------------------------
// Frases padrão
// -----------------------------------------------------------------------------

/** "Vimos a V.S. apresentar…", com o nome do cliente em negrito. */
export function introducaoPadrao(cliente: string, assunto: string) {
  const servicos = assunto ? `serviços ${assunto}` : 'serviços'
  return (
    `Vimos a V.S. apresentar a nossa proposta para prestação de ${servicos}, nas instalações da **${cliente.trim() || '...'}**, ` +
    'modalidade de gestão do ambiente adotada por indústrias, instituições de saúde, shoppings, hotéis, supermercados, órgãos públicos e outros segmentos.'
  )
}

/** Assunto da apresentação: o do primeiro serviço que tiver um. */
export function assuntoDosItens(itens: { modelo?: string | null }[]) {
  for (const i of itens) {
    const a = modeloDe(i.modelo)?.assunto
    if (a) return a
  }
  return ''
}

export function textoPagamento(
  prazo: number | null | undefined,
  condicao: string | null | undefined,
) {
  const c = condicao?.trim() || 'boleto bancário'
  return prazo != null ? `**${prazo} dias** ${c}` : c
}

export function textoAtendimento(acrescimo: number | null | undefined) {
  const base = 'Valor considerando atendimento em horário comercial.'
  if (acrescimo == null) return base
  return (
    `${base} Para execução dos serviços após as 18h, aos sábados, domingos e feriados, acréscimo de ` +
    `**${formatarReais(acrescimo)}**, bem como em caso de deslocamento sem êxito da equipe até o local.`
  )
}

export const valorComExtenso = (v: number) => `${formatarReais(v)} (${reaisPorExtenso(v)})`

// -----------------------------------------------------------------------------
// Juntar sem repetir
// -----------------------------------------------------------------------------

const chaveLinha = (l: string) =>
  sem(l)
    .replace(/\*\*/g, '')
    .replace(/^[-•]\s*/, '')
    .replace(/[\s;.,]+$/g, '')
    .replace(/\s+/g, ' ')

/**
 * Junta as linhas dos serviços sem repetir (ignora maiúsculas, negrito e pontuação final).
 * Quando juntam vários serviços, também tira o que já está dito numa linha maior
 * ("Mão de obra especializada;" some se houver "Mão de obra especializada com técnicos…")
 * e deixa uma linha só de "Execução do serviço" (a primeira).
 */
export function juntarLinhas(textos: (string | null | undefined)[]) {
  const vistas = new Set<string>()
  const linhas: { texto: string; chave: string }[] = []
  let execucao = false
  for (const t of textos) {
    for (const bruta of (t ?? '').split('\n')) {
      const l = bruta.trim()
      if (!l) continue
      const chave = chaveLinha(l)
      if (vistas.has(chave)) continue
      if (chave.startsWith('execucao d')) {
        if (execucao) continue
        execucao = true
      }
      vistas.add(chave)
      linhas.push({ texto: l, chave })
    }
  }
  const ficam = linhas.filter(
    (l) =>
      !linhas.some(
        (o) => o !== l && o.chave.length > l.chave.length && o.chave.startsWith(l.chave),
      ),
  )
  // A execução (equipe e tempo) fecha a lista, como nas propostas em Word.
  const ehExecucao = (l: { chave: string }) => l.chave.startsWith('execucao d')
  return [...ficam.filter((l) => !ehExecucao(l)), ...ficam.filter(ehExecucao)].map((l) => l.texto)
}

/** Metodologias dos serviços, sem repetir o mesmo parágrafo. */
export function juntarMetodologias(textos: (string | null | undefined)[]) {
  const vistas = new Set<string>()
  const linhas: string[] = []
  for (const t of textos) {
    for (const bruta of (t ?? '').split('\n')) {
      const l = bruta.trim()
      if (!l || vistas.has(chaveLinha(l))) continue
      vistas.add(chaveLinha(l))
      linhas.push(l)
    }
  }
  return linhas
}
