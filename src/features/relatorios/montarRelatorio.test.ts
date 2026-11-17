import { describe, expect, it } from 'vitest'

import type { PontoOs } from '../os/pragasApi'

import {
  descreverInsumo,
  graficoRoedores,
  lerTextoVisita,
  localizacaoDosPontos,
  montarRelatorio,
  nomearPontos,
  relacaoProdutos,
  textoDaVisita,
  type OsParaRelatorio,
} from './montarRelatorio'

const ponto = (numero: number, situacao: string | null, extra: Partial<PontoOs> = {}) =>
  ({
    tipo: 'porta_isca',
    numero,
    area: 'Indústria',
    tipo_isca: 'IP',
    forma_iscagem: 'PIE',
    situacao,
    capturas: {},
    ...extra,
  }) as PontoOs

const os = (extra: Partial<OsParaRelatorio>): OsParaRelatorio => ({
  id: 'os1',
  numero: '08246/2026',
  data: '2026-09-18',
  tipoNome: 'Controle de pragas',
  formulario: 'pragas',
  escopo: {},
  checklist: {},
  resultado: null,
  observacoes: null,
  equipe: ['Lantierre Rios', 'Deivid Lemos'],
  ficha: {
    nome: 'Naturovos',
    unidade: {
      apelido: 'Salvador do Sul - FL 48',
      cep: null,
      logradouro: 'Rod. BR 470',
      numero: null,
      complemento: 'km 260,5',
      bairro: 'São Francisco',
      cidade: 'Salvador do Sul',
      uf: 'RS',
    },
  },
  pontos: [],
  produtos: [],
  insetos: [],
  ...extra,
})

describe('nomes e quantidades', () => {
  it('nomeia pontos no singular e com faixas', () => {
    expect(nomearPontos([13])).toBe('Ponto 13')
    expect(nomearPontos([1, 2, 3, 7])).toBe('Pontos 1 ao 3, 7')
  })

  it('descreve o insumo como no modelo', () => {
    expect(
      descreverInsumo({
        principio_ativo: 'Brodifacoum',
        forma: 'bloco',
        gramas: 600,
        ml: null,
        unidades: null,
      }),
    ).toBe('600 g de Brodifacoum (Blocos)')
    expect(
      descreverInsumo({
        principio_ativo: 'Cola Atóxica',
        forma: 'outro',
        gramas: null,
        ml: null,
        unidades: 3,
      }),
    ).toBe('03 unidades de Cola Atóxica')
  })

  it('agrupa a localização dos pontos por área', () => {
    expect(
      localizacaoDosPontos([
        { numero: 1, area: 'Pesquisa' },
        { numero: 2, area: 'Pesquisa' },
        { numero: 3, area: 'Pesquisa' },
        { numero: 4, area: 'Guarita' },
        { numero: 5, area: 'Lateral' },
        { numero: 6, area: 'Lateral' },
      ]),
    ).toBe('01 ao 03 - Pesquisa, 04 - Guarita, 05 e 06 - Lateral')
  })
})

describe('textoDaVisita', () => {
  it('inspeção: só as exceções e os insumos', () => {
    const texto = textoDaVisita(
      os({
        pontos: [ponto(12, 'MS'), ponto(13, 'DT'), ponto(52, 'NE')],
        produtos: [
          {
            principio_ativo: 'Brodifacoum',
            forma: 'bloco',
            gramas: 20,
            ml: null,
            unidades: null,
            produto: null,
          } as OsParaRelatorio['produtos'][number],
        ],
        escopo: { subtipo: 'insetos_roedores' },
        checklist: { monitoramento_insetos: true },
      }),
    )
    expect(texto).toBe(
      [
        'Controle de Roedores: Realizada a inspeção dos 3 pontos de monitoramento.',
        '- Pontos degradados (deterioração natural, sem consumo): Ponto 13. Foi realizada a substituição da isca.',
        '- Pontos não encontrados: Ponto 52.',
        '- Demais dispositivos: Não apresentavam vestígios de roedores ou degradação das iscas.',
        '- Insumos Utilizados: 20 g de Brodifacoum (Blocos).',
        'Controle de Insetos:',
        '- Não foram identificados focos ou atividades de pragas no momento da vistoria.',
      ].join('\n'),
    )
  })

  it('implantação: todos os pontos novos, com a localização', () => {
    const texto = textoDaVisita(
      os({ pontos: [ponto(1, 'IN', { area: 'Guarita' }), ponto(2, 'IN', { area: 'Guarita' })] }),
    )
    expect(texto).toBe(
      'Controle de Roedores: Realizada a implantação de 2 pontos de monitoramento, localizados conforme segue: 01 e 02 - Guarita.',
    )
  })

  it('armadilhas luminosas: refis trocados e funcionando', () => {
    const al = (n: number) =>
      ponto(n, null, {
        tipo: 'armadilha_luminosa',
        tipo_isca: null,
        refil: 'T',
        situacao_armadilha: 'F',
      })
    expect(textoDaVisita(os({ pontos: [al(1), al(2)] }))).toBe(
      [
        'Armadilhas Luminosas (AL):',
        '- Realizada a substituição de todos os refis.',
        '- Armadilhas em funcionamento.',
      ].join('\n'),
    )
  })

  it('desinsetização mensal: usa o resultado escrito pelo técnico', () => {
    expect(
      textoDaVisita(
        os({
          formulario: 'pragas_simples',
          tipoNome: 'Controle de Insetos – Desinsetização mensal',
          resultado: 'Realizada a desinsetização mensal nas áreas da ETE.',
        }),
      ),
    ).toBe(
      'Controle de Insetos – Desinsetização mensal: Realizada a desinsetização mensal nas áreas da ETE.',
    )
  })
})

describe('relatório do mês', () => {
  it('ordena as visitas, soma o gráfico e lista os produtos sem repetir', () => {
    const catalogo = {
      id: 'p1',
      nome_comercial: null,
      principio_ativo: 'Brodifacoum',
      registro: '3.2699.0001.002-5',
      lote: '863/11',
      fabricacao: '2025-04-01',
      validade: '2027-04-01',
    }
    const produto = {
      principio_ativo: 'Brodifacoum',
      forma: 'bloco',
      gramas: 20,
      ml: null,
      unidades: null,
      produto: catalogo,
    }
    const lista = [
      os({
        id: 'b',
        numero: '2',
        data: '2026-09-18',
        pontos: [ponto(1, 'CT'), ponto(2, 'DT')],
        produtos: [produto as never],
      }),
      os({
        id: 'a',
        numero: '1',
        data: '2026-09-04',
        pontos: [ponto(1, 'MC'), ponto(2, 'MS'), ponto(3, 'CAP')],
        produtos: [produto as never],
      }),
    ]
    const r = montarRelatorio(lista, { dataEmissao: '2026-10-30' })
    expect(r.visitas.map((v) => v.numero)).toEqual(['1', '2'])
    expect(r.visitas[0].data).toBe('04/09/2026')
    expect(r.visitas[0].equipe).toBe('Lantierre Rios e Deivid Lemos')
    expect(r.cliente).toBe('NATUROVOS – SALVADOR DO SUL - FL 48')
    expect(r.endereco).toBe('Rod. BR 470, S/N – km 260,5 – São Francisco – Salvador do Sul/RS')
    expect(graficoRoedores(lista)).toEqual({
      instalados: 3,
      capturados: 1,
      consumidas: 2,
      degradadas: 1,
    })
    expect(relacaoProdutos(lista)).toHaveLength(1)
    expect(relacaoProdutos(lista)[0]).toMatch(
      /^Brodifacoum - MS 3\.2699\.0001\.002-5 - Lote 863\/11 - Fab\. /,
    )
  })
})

describe('lerTextoVisita', () => {
  it('separa título, texto e itens', () => {
    expect(
      lerTextoVisita(
        'Controle de Roedores: Feito.\n- Pontos não encontrados: Ponto 52.\n\nTexto solto',
      ),
    ).toEqual([
      { tipo: 'paragrafo', titulo: 'Controle de Roedores:', texto: 'Feito.' },
      { tipo: 'item', titulo: 'Pontos não encontrados:', texto: 'Ponto 52.' },
      { tipo: 'paragrafo', titulo: '', texto: 'Texto solto' },
    ])
  })
})
