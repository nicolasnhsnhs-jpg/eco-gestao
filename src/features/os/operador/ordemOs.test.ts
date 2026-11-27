import { describe, expect, it } from 'vitest'

import { avisosDasOs, chavesDosAvisos, temAvisoNovo } from './avisosGerais'
import { diasComOs, moverNaOrdem, ordemComODia, ordenarPelaEscolha, osDoDia } from './ordemOs'

const os = (id: string) => ({ id })

describe('ordem das OS do operador', () => {
  it('segue a ordem escolhida e põe as novas no fim, na ordem de antes', () => {
    const lista = [os('a'), os('b'), os('c'), os('d')]
    expect(ordenarPelaEscolha(lista, ['c', 'x', 'a']).map((o) => o.id)).toEqual([
      'c',
      'a',
      'b',
      'd',
    ])
  })

  it('sem ordem guardada fica como veio', () => {
    expect(ordenarPelaEscolha([os('a'), os('b')], []).map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('sobe e desce trocando com a vizinha, sem passar das pontas', () => {
    expect(moverNaOrdem(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moverNaOrdem(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moverNaOrdem(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moverNaOrdem(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('aviso geral do operador', () => {
  const base = {
    data_agendada: '2026-11-19',
    tipo: { nome: 'Dedetização' },
    ficha_cliente: { nome: 'Mercado Silva LTDA', nome_fantasia: 'Mercado Silva' },
  }
  const ocorr = (texto: string, criado_em: string, sanada_em: string | null = null) => ({
    ocorrencia: { id: texto, texto, criado_em, os_origem_id: null, sanada_em },
  })

  it('junta observação do ADM e ocorrências abertas por OS; ignora concluída e sem aviso', () => {
    const avisos = avisosDasOs([
      {
        ...base,
        id: '1',
        status: 'agendada',
        observacoes_adm: ' Chegar antes das 8h ',
        ocorrencias: [
          ocorr('Ratos no depósito', '2026-11-02'),
          ocorr('Baratas', '2026-11-01'),
          ocorr('Já resolvida', '2026-10-01', '2026-11-01'),
        ],
      },
      { ...base, id: '2', status: 'agendada', observacoes_adm: '  ', ocorrencias: [] },
      { ...base, id: '3', status: 'concluida', observacoes_adm: 'Feita', ocorrencias: [] },
    ] as unknown as Parameters<typeof avisosDasOs>[0])
    expect(avisos).toEqual([
      {
        osId: '1',
        cliente: 'Mercado Silva',
        servico: 'Dedetização',
        data: '2026-11-19',
        observacoes: 'Chegar antes das 8h',
        ocorrencias: ['Baratas', 'Ratos no depósito'],
      },
    ])
  })
})

describe('quando a caixa de avisos abre sozinha', () => {
  const aviso = (osId: string, observacoes: string) => ({
    osId,
    cliente: 'C',
    servico: '',
    data: '2026-11-19',
    observacoes,
    ocorrencias: [],
  })

  it('abre com aviso novo ou texto mudado, e não quando uma OS sai da lista', () => {
    const vistos = chavesDosAvisos([aviso('1', 'a'), aviso('2', 'b')])
    expect(temAvisoNovo([aviso('2', 'b')], vistos)).toBe(false)
    expect(temAvisoNovo([aviso('2', 'b mudou')], vistos)).toBe(true)
    expect(temAvisoNovo([aviso('3', 'c')], vistos)).toBe(true)
  })
})

describe('OS do operador um dia de cada vez', () => {
  const hoje = '2026-11-27'
  const o = (
    id: string,
    data_agendada: string,
    status = 'agendada',
    concluida_em: string | null = null,
  ) => ({
    id,
    data_agendada,
    status,
    concluida_em,
  })
  const lista = [
    o('atrasada', '2026-11-25'),
    o('feita-antes', '2026-11-25', 'concluida', '2026-11-25T15:00:00-03:00'),
    o('feita-hoje', '2026-11-26', 'concluida', '2026-11-27T10:00:00-03:00'),
    o('hoje', hoje),
    o('cancelada', hoje, 'cancelada'),
    o('sabado', '2026-11-28'),
    o('segunda1', '2026-11-30'),
    o('segunda2', '2026-11-30', 'em_execucao'),
  ]

  it('hoje: as de hoje, as atrasadas abertas e as concluídas hoje; nada dos outros dias', () => {
    expect(osDoDia(lista, hoje, hoje).map((x) => x.id)).toEqual(['atrasada', 'feita-hoje', 'hoje'])
  })

  it('outro dia: só as marcadas para ele', () => {
    expect(osDoDia(lista, '2026-11-30', hoje).map((x) => x.id)).toEqual(['segunda1', 'segunda2'])
    expect(osDoDia(lista, '2026-11-29', hoje)).toEqual([])
  })

  it('dias com OS a partir de hoje, com a contagem', () => {
    expect(diasComOs(lista, hoje)).toEqual([
      { dia: hoje, qtd: 3 },
      { dia: '2026-11-28', qtd: 1 },
      { dia: '2026-11-30', qtd: 2 },
    ])
  })

  it('mudar a ordem de um dia não perde a ordem dos outros', () => {
    expect(ordemComODia(['a', 'b', 'x', 'y'], ['y', 'x'])).toEqual(['y', 'x', 'a', 'b'])
  })
})
