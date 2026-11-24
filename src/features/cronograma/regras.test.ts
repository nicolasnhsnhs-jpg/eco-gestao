import { describe, expect, it } from 'vitest'

import {
  assuntoCronograma,
  gruposDeEmail,
  htmlCronograma,
  type ItemParaEmail,
} from '../../../supabase/functions/_shared/emailCronograma'

import {
  datasDaUnidade,
  diaCurto,
  diasDoTexto,
  precisaEnviar,
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
  it('precisa conferir: não entra no envio até conferir', () => {
    const s = situacaoDoItem({ ...base, conferir: 'Nome repetido na rota' }, rota, true)
    expect(s).toBe('conferir')
    expect(precisaEnviar(s)).toBe(false)
    expect(situacaoDoItem({ ...base, incluido: false, conferir: 'x' }, rota, true)).toBe('fora')
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

describe('e-mails do cronograma', () => {
  const end = {
    apelido: null,
    logradouro: 'Av. A',
    numero: '1',
    bairro: 'Centro',
    cidade: 'Esteio',
    uf: 'RS',
  }
  const item = (
    id: string,
    cliente: string,
    extra: Partial<ItemParaEmail> = {},
  ): ItemParaEmail => ({
    id,
    cliente_id: cliente,
    ordem: Number(id),
    datas: null,
    so_visita: null,
    incluido: true,
    horario: null,
    observacoes: null,
    servicos: ['Controle de pragas'],
    pede_confirmacao: false,
    cliente: { nome: `Cliente ${cliente}`, nome_fantasia: null, cpf_cnpj: '11222333000181' },
    endereco: end,
    ...extra,
  })
  const crono = { datas: ['2026-12-10', '2026-12-25'], horario: null }

  it('um e-mail por cliente; aviso e pergunta separados; sem datas fica de fora', () => {
    const g = gruposDeEmail(
      [
        item('1', 'a'),
        item('2', 'a', { endereco: { ...end, logradouro: 'Rua B' } }),
        item('3', 'b', { so_visita: 3 }),
        item('4', 'a', {
          pede_confirmacao: true,
          servicos: ['Limpeza de coifa'],
          datas: ['2026-12-15'],
        }),
      ],
      crono,
    )
    expect(g.map((x) => [x.clienteId, x.confirmar, x.unidades.length])).toEqual([
      ['a', false, 2],
      ['a', true, 1],
    ])
    expect(g[0].unidades[0].cnpj).toBe('11.222.333/0001-81')
    expect(g[1].unidades[0].servico).toBe('Limpeza de coifa')
  })

  it('o texto avisa (pragas) ou pergunta (contrato)', () => {
    const base = {
      site: '',
      empresa: 'Eco Ambiental RS',
      cliente: 'X',
      mes: 'dezembro de 2026',
      emailSac: 's@x.com',
    }
    const [aviso] = gruposDeEmail([item('1', 'a')], crono)
    const [pergunta] = gruposDeEmail(
      [
        item('1', 'a', {
          pede_confirmacao: true,
          servicos: ['Limpeza de coifa'],
          datas: ['2026-12-15'],
        }),
      ],
      crono,
    )
    const html1 = htmlCronograma({ ...base, unidades: aviso.unidades, confirmar: false })
    const html2 = htmlCronograma({ ...base, unidades: pergunta.unidades, confirmar: true })
    expect(html1).toContain('Não é preciso confirmar')
    expect(html2).toContain('Pode ser nesta data?')
    expect(assuntoCronograma({ ...base, unidades: pergunta.unidades, confirmar: true })).toContain(
      'Agendamento de limpeza de coifa',
    )
  })
})
