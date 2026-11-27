import type { Json } from '@/lib/database.types'
import { UNIDADE } from '@/lib/unidade'

/*
 * Comunicação de serviço (Documentos > Comunicação de serviço): o aviso que vai ao
 * cliente antes do serviço. Os modelos vieram das comunicações em Word usadas hoje
 * (ASUN, Giardino, Risotolândia, FM, Du Lac, Villa Inglesa) e só preenchem o
 * formulário: tudo continua editável.
 *
 * Nos textos, {cliente} vira o nome do cliente e {data} a data por extenso
 * ("06 de agosto de 2026 (quinta-feira)"), na hora de gerar o PDF.
 */

/** Como a seção aparece no PDF. */
export type EstiloSecao = 'lista' | 'numerada' | 'paragrafo' | 'destaque'

export const NOMES_ESTILO: Record<EstiloSecao, string> = {
  lista: 'Lista com marcadores',
  numerada: 'Lista numerada',
  paragrafo: 'Texto corrido',
  destaque: 'Quadro de destaque',
}

export type SecaoComunicacao = { titulo: string; texto: string; estilo: EstiloSecao }
export type TecnicoComunicacao = { nome: string; rg: string; cpf: string }

export type ConteudoComunicacao = {
  /** Segunda linha do título (ex.: "Desinsetização"). */
  subtitulo: string
  /** "às 21h", "a partir das 6h". */
  horario: string
  local: string
  /** Pessoa de contato no cliente ("Sr. Paulo (51) 98593-1175"). */
  contato: string
  /** Texto de abertura ("Prezados, …"). */
  abertura: string
  secoes: SecaoComunicacao[]
  tecnicos: TecnicoComunicacao[]
  veiculo: string
  /** Texto do fim ("Agradecemos a compreensão…"). */
  fechamento: string
  /** Telefones do SAC no rodapé do aviso. */
  contatos: string
}

export type ModeloComunicacao = {
  nome: string
  titulo: string
  conteudo: Omit<ConteudoComunicacao, 'contatos' | 'tecnicos' | 'veiculo' | 'local' | 'contato'> &
    Partial<Pick<ConteudoComunicacao, 'local'>>
  /** O modelo pede técnicos autorizados (com RG e CPF) e o veículo. */
  pedeTecnicos?: boolean
  pedeVeiculo?: boolean
  /** Mostra a pessoa de contato do cliente. */
  pedeContato?: boolean
}

const POS_SERVICO = [
  'Ao retornar, manter o ambiente ventilado por pelo menos 30 minutos.',
  'Realizar limpeza apenas com pano úmido nas superfícies de contato direto (mesas, pias, balcões e fogão).',
  'Não lavar paredes, rodapés ou áreas tratadas por no mínimo 10 dias, para não comprometer o efeito residual do produto.',
  'Evitar uso excessivo de produtos de limpeza nos primeiros dias.',
  'Manter alimentos armazenados adequadamente e reforçar práticas de higiene para potencializar o resultado do controle.',
]

const LEMBRETE_AUTORIZACAO =
  'Solicitamos que deixe autorização em todos os setores pertinentes para que nossos técnicos possam executar os serviços acima descritos.'

const CANCELAMENTO =
  'O cancelamento do serviço deverá ser comunicado com até 2 dias de antecedência da data agendada. Caso haja deslocamento sem êxito da equipe técnica até o cliente, será cobrado adicional conforme contrato.'

const BOMBEIROS =
  'Caso seja necessária a utilização de termonebulização (fumaça), é indispensável que o responsável pelo local realize contato prévio com o Corpo de Bombeiros da cidade, informando que o estabelecimento passará por processo de desinsetização com fumaça.'

const AGRADECIMENTO =
  'Agradecemos a compreensão e a colaboração de todos.\nDúvidas ou informações, entre em contato conosco.'

const linhas = (itens: string[]) => itens.join('\n')

export const MODELOS_COMUNICACAO = {
  desinsetizacao_comercio: {
    nome: 'Desinsetização (loja, restaurante, comércio)',
    titulo: 'Comunicação importante',
    conteudo: {
      subtitulo: 'Aviso - Desinsetização',
      horario: 'às 21h',
      abertura:
        'Prezados(as),\nPara a realização dos serviços de desinsetização, o local deverá preparar previamente os setores, garantindo melhores condições para a execução do trabalho e maior segurança alimentar.',
      secoes: [
        {
          titulo: 'Isolamento',
          texto:
            'Durante o processo de desinsetização e após a conclusão, os locais deverão permanecer isolados entre 3 e 4 horas, sem a presença de pessoas.',
          estilo: 'destaque',
        },
        {
          titulo: 'Orientações para preparação dos ambientes',
          texto: linhas([
            'Guardar utensílios de uso diário;',
            'Proteger ou retirar alimentos expostos;',
            'Preparar os setores (cozinha, padaria, hortifrúti...): retirar os alimentos e materiais expostos (frutas, legumes, verduras), deixando o ambiente com livre acesso para a aplicação.',
          ]),
          estilo: 'lista',
        },
        {
          titulo: 'Após a realização do serviço',
          texto:
            'Efetuar limpeza superficial de balcões, mesas e demais superfícies de contato, utilizando pano com álcool ou detergente neutro.',
          estilo: 'paragrafo',
        },
        { titulo: 'Orientações pós-serviço', texto: linhas(POS_SERVICO), estilo: 'lista' },
        { titulo: 'Informação importante', texto: BOMBEIROS, estilo: 'destaque' },
      ],
      fechamento: AGRADECIMENTO,
    },
  },
  desinsetizacao_condominio: {
    nome: 'Desinsetização em condomínio (áreas comuns)',
    titulo: 'Comunicado importante',
    pedeContato: true,
    conteudo: {
      subtitulo: 'Desinsetização',
      horario: '',
      abertura:
        'Comunicamos que no dia {data} será realizada a desinsetização nas áreas comuns do condomínio.',
      secoes: [
        {
          titulo: 'Recomendamos',
          texto: linhas([
            'NÃO transitar com animais, crianças e demais pessoas;',
            'NÃO permanecer nas áreas do condomínio durante a aplicação;',
            'MANTER as portas e janelas FECHADAS durante a desinsetização.',
          ]),
          estilo: 'lista',
        },
        {
          titulo: '',
          texto:
            'Além das aplicações preventivas e curativas, recomendamos observar as áreas tratadas, mantendo uma higienização constante e com especial atenção às medidas preventivas e corretivas a serem providenciadas quando relatadas, para que assim possamos ter um melhor resultado e controle.',
          estilo: 'paragrafo',
        },
      ],
      fechamento:
        'Desde já, agradecemos a compreensão e a colaboração de todos.\nDúvidas ou informações, entre em contato conosco.',
    },
  },
  residencias: {
    nome: 'Desinsetização e desratização (residências)',
    titulo: 'Comunicado importante',
    conteudo: {
      subtitulo: 'Desinsetização, desratização',
      horario: 'início às 9h',
      abertura: 'Recomendações para cada residência:',
      secoes: [
        {
          titulo: 'Orientações pré-serviço',
          texto: linhas([
            'Organizar o ambiente, mantendo pisos livres e afastando móveis aproximadamente 10 cm das paredes, quando possível.',
            'Guardar utensílios domésticos, alimentos, talheres, copos e objetos de uso pessoal em armários fechados ou devidamente protegidos.',
            'Retirar animais domésticos do local, bem como remover comedouros, bebedouros e caixas de areia.',
            'Suspender temporariamente aquários ou mantê-los hermeticamente fechados, com desligamento do sistema de aeração.',
            'Informar previamente sobre pessoas alérgicas, crianças de colo, gestantes ou pessoas com sensibilidade.',
          ]),
          estilo: 'numerada',
        },
        {
          titulo: 'Orientações pós-serviço',
          texto: linhas([
            'Respeitar o período de reentrada no imóvel de 4 a 6 horas, ou conforme orientação técnica no momento da aplicação.',
            ...POS_SERVICO,
            'A desratização não requer isolamento dos ambientes e poderá ser realizada com pessoas em casa.',
          ]),
          estilo: 'numerada',
        },
        {
          titulo: 'Importante',
          texto:
            'O controle químico é uma etapa do processo. A manutenção da limpeza, a vedação de frestas, a organização de resíduos e a eliminação de fontes de alimento são fundamentais para garantir maior eficácia e durabilidade do serviço.',
          estilo: 'destaque',
        },
      ],
      fechamento: AGRADECIMENTO,
    },
  },
  controle_insetos: {
    nome: 'Controle de insetos / aranhas (empresa)',
    titulo: 'Comunicação para execução de serviços',
    pedeTecnicos: true,
    pedeVeiculo: true,
    conteudo: {
      subtitulo: 'Controle de insetos / aranhas',
      horario: 'às 22h30',
      local: '',
      abertura: '',
      secoes: [
        { titulo: 'Lembrete importante', texto: LEMBRETE_AUTORIZACAO, estilo: 'destaque' },
        {
          titulo: 'Observação',
          texto:
            'Favor entrar em contato com o Corpo de Bombeiros da cidade e avisar que o local passará pelo processo de desinsetização com fumaça.',
          estilo: 'paragrafo',
        },
      ],
      fechamento: '',
    },
  },
  reservatorio: {
    nome: 'Limpeza de reservatórios',
    titulo: 'Comunicado de execução de serviços',
    pedeTecnicos: true,
    conteudo: {
      subtitulo: 'Limpeza e desinfecção de reservatórios de água',
      horario: 'a partir das 6h',
      abertura:
        'Prezados,\nInformamos que será realizado o serviço de limpeza e desinfecção dos reservatórios de água no {cliente}, conforme programação abaixo.',
      secoes: [
        {
          titulo: 'Durante a execução dos serviços, solicitamos a colaboração de todos para evitar',
          texto: linhas([
            'Utilizar máquinas de lavar roupa e louça;',
            'Acionar descargas com válvula hidra.',
          ]),
          estilo: 'lista',
        },
        {
          titulo: '',
          texto:
            'Estas medidas são necessárias para garantir a eficiência do serviço e o abastecimento adequado durante o período de manutenção.',
          estilo: 'paragrafo',
        },
      ],
      fechamento: 'Contamos com a compreensão de todos.\nAtenciosamente,',
    },
  },
  coifa: {
    nome: 'Limpeza de coifa',
    titulo: 'Comunicação para',
    pedeTecnicos: true,
    conteudo: {
      subtitulo: 'Limpeza de coifa de cocção',
      horario: 'às 14h',
      local: 'Cozinha',
      abertura: '',
      secoes: [
        { titulo: 'Lembrete importante', texto: LEMBRETE_AUTORIZACAO, estilo: 'destaque' },
        { titulo: 'Importante', texto: CANCELAMENTO, estilo: 'paragrafo' },
      ],
      fechamento: '',
    },
  },
  outro: {
    nome: 'Outro (em branco)',
    titulo: 'Comunicado importante',
    pedeTecnicos: true,
    conteudo: { subtitulo: '', horario: '', abertura: '', secoes: [], fechamento: '' },
  },
} satisfies Record<string, ModeloComunicacao>

export type ChaveModeloComunicacao = keyof typeof MODELOS_COMUNICACAO

export const modeloComunicacao = (chave: string): ModeloComunicacao =>
  (MODELOS_COMUNICACAO as Record<string, ModeloComunicacao>)[chave] ?? MODELOS_COMUNICACAO.outro

/** Conteúdo novo a partir do modelo (com os contatos do SAC da unidade). */
export function conteudoDoModelo(chave: string): ConteudoComunicacao {
  const m = modeloComunicacao(chave)
  return {
    local: '',
    contato: '',
    tecnicos: [],
    veiculo: '',
    contatos: UNIDADE.comunicacao.contatos,
    ...m.conteudo,
    secoes: m.conteudo.secoes.map((s) => ({ ...s })),
  }
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '')
const ESTILOS = Object.keys(NOMES_ESTILO) as EstiloSecao[]

/** Lê o conteúdo gravado no banco, sem quebrar com dados faltando. */
export function lerConteudo(valor: Json | null | undefined): ConteudoComunicacao {
  const o = (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}) as Record<
    string,
    unknown
  >
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
  return {
    subtitulo: texto(o.subtitulo),
    horario: texto(o.horario),
    local: texto(o.local),
    contato: texto(o.contato),
    abertura: texto(o.abertura),
    secoes: lista(o.secoes).map((s) => ({
      titulo: texto(s?.titulo),
      texto: texto(s?.texto),
      estilo: ESTILOS.includes(s?.estilo as EstiloSecao) ? (s.estilo as EstiloSecao) : 'lista',
    })),
    tecnicos: lista(o.tecnicos).map((t) => ({
      nome: texto(t?.nome),
      rg: texto(t?.rg),
      cpf: texto(t?.cpf),
    })),
    veiculo: texto(o.veiculo),
    fechamento: texto(o.fechamento),
    contatos: texto(o.contatos),
  }
}

/** Tira espaços sobrando, seções e técnicos vazios (o que vai para o banco). */
export function limparConteudo(c: ConteudoComunicacao): ConteudoComunicacao {
  const t = (s: string) => s.trim()
  return {
    subtitulo: t(c.subtitulo),
    horario: t(c.horario),
    local: t(c.local),
    contato: t(c.contato),
    abertura: t(c.abertura),
    secoes: c.secoes
      .map((s) => ({ titulo: t(s.titulo), texto: t(s.texto), estilo: s.estilo }))
      .filter((s) => s.titulo || s.texto),
    tecnicos: c.tecnicos
      .map((x) => ({ nome: t(x.nome), rg: t(x.rg), cpf: t(x.cpf) }))
      .filter((x) => x.nome),
    veiculo: t(c.veiculo),
    fechamento: t(c.fechamento),
    contatos: t(c.contatos),
  }
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

/** "2026-08-06" → "06 de agosto de 2026 (quinta-feira)" */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return iso
  const semana = SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${String(d).padStart(2, '0')} de ${MESES[m - 1]} de ${a} (${semana})`
}

/** Troca {cliente} e {data} pelo nome do cliente e a data por extenso. */
export function preencher(texto: string, dados: { cliente: string; data: string }): string {
  return texto
    .replace(/\{cliente\}/gi, dados.cliente)
    .replace(/\{data\}/gi, dataPorExtenso(dados.data))
}

/** Itens de uma seção em lista: uma linha = um item (sem o marcador que vier colado). */
export function itensDaSecao(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-•.*>]|\d+[.)-])\s*/, '').trim())
    .filter(Boolean)
}
