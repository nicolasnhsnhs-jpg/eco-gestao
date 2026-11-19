import { describe, expect, it } from 'vitest'

import { avisosDasOs } from './avisosGerais'
import { moverNaOrdem, ordenarPelaEscolha } from './ordemOs'

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
