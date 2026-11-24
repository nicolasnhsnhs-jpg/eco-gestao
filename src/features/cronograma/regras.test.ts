import { describe, expect, it } from 'vitest'

import {
  datasDaUnidade,
  diaCurto,
  diasDoTexto,
  situacaoDoItem,
  textoDosDias,
  unidadesDaRota,
  type ItemSituacao,
} from './regras'

describe('diasDoTexto', () => {
  it('lê os dias como na planilha', () => {
    expect(diasDoTexto('10 e 25', '2026-12').datas).toEqual(['2026-12-10', '2026-12-25'])
    expect(diasDoTexto('3, 9, 16, 23, 30', '2026-12').datas).toHaveLength(5)
    expect(diasDoTexto('25/10;10', '2026-12').datas).toEqual(['2026-12-10', '2026-12-25'])
  })
  it('separa o que o mês não tem', () => {
    expect(diasDoTexto('30 31', '2027-02')).toEqual({ datas: [], invalidos: ['30', '31'] })
    expect(diasDoTexto('5 x', '2026-12').invalidos).toEqual(['x'])
  })
  it('volta para texto', () => {
    expect(textoDosDias(['2026-12-25', '2026-12-03', '2026-12-10'])).toBe('3, 10 e 25')
    expect(textoDosDias(['2026-12-05'])).toBe('5')
  })
  it('mostra o dia da semana', () => {
    expect(diaCurto('2026-12-10')).toBe('10/12 qui')
  })
})

describe('datas da unidade', () => {
  const rota = ['2026-12-16', '2026-12-05']
  it('usa as da rota, só uma visita ou as próprias', () => {
    expect(datasDaUnidade({ datas: null, so_visita: null }, rota)).toEqual([
      '2026-12-05',
      '2026-12-16',
    ])
    expect(datasDaUnidade({ datas: null, so_visita: 2 }, rota)).toEqual(['2026-12-16'])
    expect(datasDaUnidade({ datas: null, so_visita: 3 }, rota)).toEqual([])
    expect(datasDaUnidade({ datas: ['2026-12-27'], so_visita: 1 }, rota)).toEqual(['2026-12-27'])
  })
})

describe('situacaoDoItem', () => {
  const rota = { datas: ['2026-12-10', '2026-12-25'], horario: null }
  const base: ItemSituacao = {
    datas: null,
    so_visita: null,
    incluido: true,
    horario: null,
    enviado_em: null,
    datas_enviadas: null,
    horario_enviado: null,
    aviso_manual_em: null,
  }
  it('a enviar, sem e-mail, fora, sem datas', () => {
    expect(situacaoDoItem(base, rota, true)).toBe('a_enviar')
    expect(situacaoDoItem(base, rota, false)).toBe('sem_email')
    expect(situacaoDoItem({ ...base, incluido: false }, rota, true)).toBe('fora')
    expect(situacaoDoItem(base, { datas: [], horario: null }, true)).toBe('sem_datas')
    expect(situacaoDoItem({ ...base, aviso_manual_em: 'x' }, rota, false)).toBe('manual')
  })
  it('enviado e depois alterado', () => {
    const enviado = { ...base, enviado_em: 'x', datas_enviadas: ['2026-12-25', '2026-12-10'] }
    expect(situacaoDoItem(enviado, rota, true)).toBe('enviado')
    expect(situacaoDoItem({ ...enviado, so_visita: 1 }, rota, true)).toBe('alterado')
    expect(situacaoDoItem(enviado, { ...rota, horario: 'Manhã' }, true)).toBe('alterado')
  })
})

describe('unidadesDaRota', () => {
  it('junta as O.S do mesmo local e pula as inativas', () => {
    const m = (ordem: number, cli: string, end: string | null, tipo: string, ativo = true) => ({
      ordem,
      modelo: {
        ativo,
        descricao: null,
        cliente: { id: cli },
        endereco: end ? { id: end } : null,
        tipo: { nome: tipo },
      },
    })
    const u = unidadesDaRota([
      m(2, 'b', 'e2', 'Pragas'),
      m(0, 'a', 'e1', 'Pragas'),
      m(1, 'a', 'e1', 'Moscas'),
      m(3, 'c', null, 'Pragas', false),
    ])
    expect(u).toEqual([
      { cliente_id: 'a', endereco_id: 'e1', servicos: ['Pragas', 'Moscas'], ordem: 0 },
      { cliente_id: 'b', endereco_id: 'e2', servicos: ['Pragas'], ordem: 1 },
    ])
  })
})
