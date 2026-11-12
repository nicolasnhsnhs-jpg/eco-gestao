import { inteiroPorExtenso } from '@/lib/extenso'
import { formatarReais } from '@/lib/dinheiro'
import { UNIDADE } from '@/lib/unidade'

import { modeloDe, nomeFrequencia, type ChaveModelo } from './modelos'

/*
 * Proposta contratual completa (memorial descritivo), no molde das propostas
 * contratuais em Word (Naturovos, Hotel 10, Condomínio Fiergs...):
 *
 *   1. SERVIÇO DE CONTROLE DE PRAGAS URBANAS / QUINZENAL   (texto técnico do serviço)
 *   2. LIMPEZA DE RESERVATÓRIOS / SEMESTRAL                (idem, um por serviço)
 *   3. ATENDIMENTO                                         (fixo, com o nome do cliente)
 *   4. CORPO TÉCNICO                                       (fixo, responsável da unidade)
 *   5. SERVIÇOS ESPECIALIZADOS                             (fixo, quando há água/coifa/sucção)
 *   6. INVESTIMENTO                                        (valor mensal de cada serviço)
 *
 * O texto de cada serviço fica no item (pode ser editado) e aceita marcas que o
 * PDF troca na hora: {cliente}, {escopo} (o "o que será feito" do serviço),
 * {frequencia} e {FREQUENCIA} (a frequência do serviço, em maiúsculas).
 */

type DadosUnidade = (typeof UNIDADE)['proposta']

// -----------------------------------------------------------------------------
// Textos técnicos de cada serviço
// -----------------------------------------------------------------------------

const PRAGAS_INTRODUCAO = [
  '**Introdução**',
  'As exigências de padrão de qualidade de produtos e serviços como diferencial competitivo em tempo de economia e mercados globalizados determinam também, no controle de pragas, a necessidade de mudanças de atitude em relação a procedimentos e processos na busca do **manejo da infestação de animais sinantrópicos e pragas indesejáveis**.',
  'O uso de uma metodologia de controle integrado, dirigida pela avaliação prévia dos ambientes, com atuação por medidas preventivas e de saneamento, atende às exigências de qualidade e aos padrões de segurança de garantia da integridade física, frente a riscos químicos, físicos ou biológicos ao homem e ao meio ambiente.',
  'A implantação da qualidade total e o sistema de gerenciamento ambiental desenvolvem a base do conhecimento para planejar e estruturar a adoção de Boas Práticas (BPFs) na execução de processos. A gestão consciente dessas ações participa diretamente nas medidas de controle empregadas.',
  'O controle integrado de pragas urbanas desenvolvido pela Eco Ambiental atua conforme as recomendações da Resolução RDC 52, de 22/10/2009, da Agência Nacional de Vigilância Sanitária / MS, considerando também a legislação a seguir:',
  '- **Portaria MS 326/97:** as medidas de controle que compreendem o tratamento com agentes químicos, biológicos ou físicos devem ser aplicadas somente sob a supervisão direta de pessoal tecnicamente competente, que saiba identificar, avaliar e intervir nos perigos potenciais que essas substâncias representam para a saúde.',
]

const PRAGAS_ROEDORES = [
  '**Roedores / atendimento {FREQUENCIA}**',
  'A metodologia de controle de roedores prevê o uso de pontos de iscagem permanentes, com iscas variadas, placa de cola, atrativos e dispositivos relacionados com as medidas de controle instituídas. Na avaliação inicial conjunta ficaram definidas as quantidades para todo o complexo, considerando pontos de iscagem com porta-iscas.',
  '- Controle de roedores (ratazanas, camundongos e rato preto), com aplicação específica;',
  '- Pontos de iscagem permanentes: pontos de iscagem (internos e externos), modelo padrão;',
  '- Instalação/identificação: instalação, numeração e fixação pela Eco Ambiental.',
  'O monitoramento para controle de roedores ocorrerá pela inspeção in loco do operador da Eco Ambiental nos pontos críticos de controle e pelas planilhas de registro de ocorrência de pragas, a serem afixadas nas áreas da {cliente}, nas visitas técnicas de **MONITORAMENTO {FREQUENCIA}**. Essas planilhas são controladas pela Eco Ambiental, e nelas serão tomadas as medidas de controle para as infestações identificadas conjuntamente.',
]

const PRAGAS_LOCAIS = (insetos: boolean) => [
  '**Locais e objetivos de controle**',
  '{escopo}',
  '- O plano prevê em média ... pontos de iscagem com porta-isca.',
  ...(insetos
    ? [
        'O programa de controle abrange os ambientes citados acima, através de medidas preventivas e corretivas conjuntas, de forma a evitar as infestações, contemplando aplicação para controle de insetos, monitoramentos ({frequencia}), bem como aplicações localizadas. A aplicação geral será realizada na frequência semestral, para as seguintes infestações:',
        '- Insetos gerais (baratas, formigas domésticas/doceiras, formigas cortadeiras, moscas, traças e tesourinhas) nas áreas internas dos prédios, galerias, ralos, equipamentos e contornos externos;',
        '- Aracnídeos (aranhas) nas áreas internas e contornos externos dos prédios;',
        '- Controle de insetos e pragas ocasionais (carrapatos, mosquitos da dengue, pulgas, escorpiões, abelhas, marimbondos, pombos e morcegos), sob avaliação técnica mediante orçamento.',
      ]
    : []),
]

const PRAGAS_METODOS = [
  '**Métodos de controle**',
  'Técnicas gerais de pulverização, atomização, termonebulização e polvilhamento preventivo da rede cloacal, além de iscas em gel. Esses processos poderão ser utilizados com abrangência total ou parcial dos ambientes, não sendo necessário, nestes casos, o seu isolamento, e poderão ser realizados nas visitas de monitoramento e inspeções, conforme a disponibilidade dos ambientes.',
]

const RESIDUOS = [
  'Transporte conforme Resolução da Agência Nacional de Transportes Terrestres - ANTT e **resíduos classe II A**, conforme NBR 10004 e NBR 13221 da ABNT.',
  '{escopo}',
  '**Obs.:** serviço executado em horário comercial, considerando a solicitação de atendimento após o terceiro mês de parcela do contrato.',
]

const linhas = (l: (string | null | false | undefined)[]) =>
  l.filter((x): x is string => !!x).join('\n')

const TEXTOS: Partial<Record<ChaveModelo, (u: DadosUnidade) => string>> = {
  pragas: () =>
    linhas([...PRAGAS_INTRODUCAO, ...PRAGAS_ROEDORES, ...PRAGAS_LOCAIS(true), ...PRAGAS_METODOS]),
  insetos: () =>
    linhas([
      ...PRAGAS_INTRODUCAO,
      ...PRAGAS_LOCAIS(true).filter((l) => !l.includes('iscagem')),
      ...PRAGAS_METODOS,
    ]),
  roedores: () => linhas([...PRAGAS_INTRODUCAO, ...PRAGAS_ROEDORES, ...PRAGAS_LOCAIS(false)]),
  reservatorio: (u) =>
    linhas([
      '{escopo}',
      '**Metodologia de limpeza dos reservatórios**',
      '- Procedimento editado pela Secretaria Municipal de Saúde: colocação de anéis de vedação nas tampas e tela milimétrica nas saídas de limpeza e ladrões;',
      '- Responsabilidade da execução: técnicos devidamente identificados (crachá) e uniformizados para limpeza de reservatórios (macacões e botas brancas), conforme as boas práticas de fabricação;',
      u.responsavel && `- Anotação de responsabilidade técnica: ${u.responsavel};`,
      ...u.normas.map((n) => `- ${n}`),
      '- Emissão do certificado de tratamento;',
      u.licencaSaude && `- ${u.licencaSaude}.`,
    ]),
  analise_agua: () =>
    linhas(['{escopo}', '**Obs.:** coleta a ser realizada após a limpeza da caixa d’água.']),
  bebedouro: () =>
    linhas([
      '{escopo}',
      '**Obs.:** o plano prevê a limpeza e a troca de filtro, na frequência {frequencia}, em cada aparelho.',
    ]),
  coifa: () =>
    linhas([
      '{escopo}',
      'O plano prevê a emissão de certificado após a realização do serviço, de acordo com as recomendações da **NBR 14518** (sistemas de ventilação e exaustão para cozinhas profissionais).',
    ]),
  succao: () => linhas(RESIDUOS),
  caixa_gordura: () => linhas(RESIDUOS),
  hidrojato: () => linhas(RESIDUOS),
}

/** Modelos que usam a equipe com NR 33/35 (entra a seção "Serviços especializados"). */
const ESPECIALIZADOS: ChaveModelo[] = [
  'reservatorio',
  'analise_agua',
  'bebedouro',
  'coifa',
  'forro',
  'succao',
  'caixa_gordura',
  'hidrojato',
  'desentupimento',
]
const PRAGAS: ChaveModelo[] = ['pragas', 'insetos', 'roedores', 'alados', 'cupins']
const RESIDUOS_MODELOS: ChaveModelo[] = ['succao', 'caixa_gordura', 'hidrojato']

const ehDe = (lista: ChaveModelo[], modelo: string | null | undefined) =>
  !!modelo && (lista as string[]).includes(modelo)

/**
 * Texto padrão do serviço no contrato completo. Modelo sem texto próprio: o
 * "o que será feito" e, se houver, a metodologia do serviço.
 */
export function textoContratoPadrao(
  modelo: string | null | undefined,
  metodologia?: string | null,
  u: DadosUnidade = UNIDADE.proposta,
) {
  const texto = modelo && modeloDe(modelo) ? TEXTOS[modelo as ChaveModelo]?.(u) : undefined
  if (texto) return texto
  return linhas(['{escopo}', metodologia?.trim() && `**Metodologia**\n${metodologia.trim()}`])
}

/** Troca as marcas ({cliente}, {escopo}, {frequencia}) pelo que está na proposta. */
export function preencherMarcas(
  texto: string,
  v: { cliente: string; escopo: string; frequencia: number | string | null | undefined },
) {
  const freq = v.frequencia ? nomeFrequencia(v.frequencia) : ''
  return texto
    .replaceAll('{cliente}', v.cliente)
    .replaceAll('{escopo}', v.escopo.trim())
    .replaceAll('{FREQUENCIA}', freq.toUpperCase())
    .replaceAll('{frequencia}', freq.toLowerCase())
    .split('\n')
    .filter((l, i, todas) => l.trim() || (i > 0 && todas[i - 1].trim()))
    .join('\n')
}

// -----------------------------------------------------------------------------
// Seções fixas
// -----------------------------------------------------------------------------

type ItemContrato = {
  modelo: string | null
  periodicidade_meses: number | null
  frequencia: string | null
}

/** Atendimento, corpo técnico e serviços especializados, conforme os serviços da proposta. */
export function secoesFixas(
  itens: ItemContrato[],
  cliente: string,
  u: DadosUnidade = UNIDADE.proposta,
) {
  const pragas = itens.find((i) => ehDe(PRAGAS, i.modelo))
  const freqPragas = pragas ? (pragas.frequencia ?? pragas.periodicidade_meses) : null
  const visitas = freqPragas ? ` ${nomeFrequencia(freqPragas).toUpperCase()}` : ''
  const residuos = itens.some((i) => ehDe(RESIDUOS_MODELOS, i.modelo))

  const atendimento = linhas([
    `- O planejamento de atendimento dos serviços combinados será por visitas operacionais${visitas}, realizadas pelo operador da Eco Ambiental;`,
    pragas &&
      '- No início das atividades será apresentada uma diagramação dos locais e a identificação do programa de controle, conforme determinam as portarias citadas;',
    `- Os serviços propostos deverão fazer parte do planejamento da gestão de coordenação da ${cliente}, que acompanhará e validará as ações conjuntamente com a Eco Ambiental;`,
    pragas &&
      '- Mensalmente será emitido um relatório das visitas de monitoramento realizadas, referente às medidas de controle a serem adotadas com a coordenação da Eco Ambiental;',
    `- A Eco Ambiental fornecerá, no desenvolvimento dos serviços, a documentação do plano de controle, visando cumprir os procedimentos da qualidade da ${cliente}, bem como a documentação sobre medicina e segurança do trabalho;`,
    `- A Eco Ambiental enviará a relação de seus colaboradores, a documentação pertinente e os veículos autorizados para acesso às dependências da ${cliente};`,
    `- O programa de serviços proposto para a ${cliente} prevê sua estruturação voltada para atender às exigências do cliente, onde a parceria nas ações será fundamental para o seu êxito.`,
  ])

  const corpoTecnico = linhas([
    'A Eco Ambiental coloca à disposição de seus clientes o seu departamento técnico para quaisquer esclarecimentos referentes às suas atividades, através dos seguintes profissionais:',
    u.responsavel && `- ${u.responsavel} - Responsável Técnica;`,
    residuos &&
      u.succao &&
      `- ${u.succao.responsavel} - Responsável Técnica (sucção e transporte de resíduos);`,
    '- Apoio técnico de 01 biólogo;',
    '- Apoio de 01 técnico de segurança do trabalho;',
    '- Equipe operacional para intervir em ações de controle.',
    '**Operacionalização:** nas atividades propostas utilizaremos os seguintes documentos:',
    '- Ordem de serviço;',
    pragas && '- Planilhas de pontos de iscagem para roedores (identificação dos pontos);',
    pragas &&
      '- Layout do ambiente com mapas especificando os pontos críticos e os pontos de iscagem;',
    !pragas && '- Certificado de execução dos serviços;',
    '- Suporte técnico com posicionamento sazonal (relatórios);',
    '- Ações preventivas e corretivas.',
  ])

  const secoes = [
    { titulo: 'Atendimento', escopo: atendimento },
    { titulo: 'Corpo técnico', escopo: corpoTecnico },
  ]
  if (itens.some((i) => ehDe(ESPECIALIZADOS, i.modelo))) {
    secoes.push({
      titulo: 'Serviços especializados',
      escopo:
        'As atividades desenvolvidas pelos funcionários da Eco Ambiental, conforme estabelecido no programa de atendimento, são realizadas por técnicos devidamente qualificados e certificados conforme a **NR 33 e a NR 35**, com trabalhos executados com toda segurança e qualidade, com uso de Equipamentos de Proteção Individual, Coletivos e de Resgate, além de Detector de Gases Atmosféricos, coordenados por um técnico responsável com capacidade técnica e operacional de direcionar e supervisionar o atendimento. Todos os trabalhos serão acompanhados por técnicos que realizarão inspeções e avaliações nas áreas contratadas.',
    })
  }
  return secoes
}

// -----------------------------------------------------------------------------
// Frases do investimento
// -----------------------------------------------------------------------------

/** "Conforme combinado com V.S.ª, apresentamos…" */
export function introducaoContrato(cliente: string) {
  return (
    `Conforme combinado com V.S.ª, apresentamos através desta nossa proposta para prestação de serviços nas dependências da **${cliente.trim() || '...'}**. ` +
    'Para maior entendimento desta, apresentamos a seguir uma síntese das atividades.'
  )
}

/** "… por um período de 12 (doze) meses, estando incluídas todas as despesas…" */
export function textoInvestimento(meses: number) {
  return (
    `Para execução do programa proposto, mediante contrato de prestação de serviços por um período de **${meses} (${inteiroPorExtenso(meses)}) ${meses === 1 ? 'mês' : 'meses'}**, ` +
    'estando incluídas todas as despesas de mão de obra, encargos, produtos, assistência técnica, equipamentos, EPIs e transporte, cobraremos a importância abaixo para cada serviço discriminado:'
  )
}

export function textoTaxaContrato(acrescimo: number) {
  return (
    'Atendimento durante a semana em horário comercial. Para solicitações de atendimento após as 18h, aos sábados, domingos e feriados, será aplicada **taxa adicional ' +
    `no valor de ${formatarReais(acrescimo)} por chamado**. O mesmo valor correspondente ao atendimento será cobrado em caso de cancelamento com a equipe já deslocada ou presente no cliente.`
  )
}
