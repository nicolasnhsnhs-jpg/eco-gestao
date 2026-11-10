import { describe, expect, it } from 'vitest'

import {
  densidade,
  escalaDoTecnico,
  lerEscalas,
  lerPlacas,
  lerTecnicos,
  ordenarItens,
  partesDaDescricao,
  almocoPadrao,
  conferirComCadastro,
  veiculosSemSemParar,
  type Tecnico,
  type Veiculo,
  proximoAlmoco,
  resumoDoDia,
  textoHorarioCliente,
  trechosComHorario,
  horarioForaDoTexto,
  turnoDe,
  type AgendaItem,
} from './regras'

function item(p: Partial<AgendaItem>): AgendaItem {
  return {
    id: crypto.randomUUID(),
    data: '2026-11-09',
    ordem: 0,
    hora: '07:30',
    descricao: 'Cliente: Rota',
    periodo: '',
    nota: '',
    avulso: false,
    horario_cliente: false,
    chegada: '',
    tecnicos: [],
    veiculo: '',
    almoco: 'fica',
    realizado: false,
    faturado: false,
    criado_em: '2026-11-09T10:00:00Z',
    criado_por: null,
    atualizado_em: '2026-11-09T10:00:00Z',
    atualizado_por: null,
    ...p,
  }
}

describe('partesDaDescricao', () => {
  it('separa empresa e serviço no primeiro ":"', () => {
    expect(partesDaDescricao('SUSEPE 14 e 20: Rota / Santa Maria')).toEqual([
      ['SUSEPE 14 e 20', 'Rota / Santa Maria'],
    ])
  })
  it('várias empresas na mesma linha', () => {
    expect(partesDaDescricao('GHC: LR / IBIS Aeroporto: CI aptos e áreas comuns')).toEqual([
      ['GHC', 'LR'],
      ['IBIS Aeroporto', 'CI aptos e áreas comuns'],
    ])
  })
  it('sem ":" fica tudo como empresa', () => {
    expect(partesDaDescricao('Reunião interna')).toEqual([['Reunião interna', '']])
  })
})

describe('leitura dos campos', () => {
  it('técnicos em qualquer formato', () => {
    expect(lerTecnicos('3, 4 e 13')).toEqual([3, 4, 13])
    expect(lerTecnicos('10 16 10')).toEqual([10, 16])
    expect(lerTecnicos('')).toEqual([])
  })
  it('placas em maiúsculas', () => {
    expect(lerPlacas('s3, ON14 g16;CM10')).toEqual(['S3', 'ON14', 'G16', 'CM10'])
  })
  it('escalas do banco, ignorando lixo', () => {
    expect(lerEscalas([{ inicio: '06:30', fim: '16h', tecnicos: [5, 'x', 7] }, 3, null])).toEqual([
      { inicio: '06:30', fim: '16h', tecnicos: [5, 7] },
    ])
    expect(lerEscalas(null)).toEqual([])
  })
  it('acha a escala do técnico', () => {
    const escalas = [
      { inicio: '06:30', fim: '16h', tecnicos: [5, 7] },
      { inicio: '07:30', fim: '17h', tecnicos: [2] },
    ]
    expect(escalaDoTecnico(7, escalas)).toBe(0)
    expect(escalaDoTecnico(2, escalas)).toBe(1)
    expect(escalaDoTecnico(99, escalas)).toBe(-1)
  })
})

describe('quadro', () => {
  it('ordena por hora e depois pela ordem', () => {
    const a = item({ hora: '13:30', descricao: 'a' })
    const b = item({ hora: '06:30', ordem: 2, descricao: 'b' })
    const c = item({ hora: '06:30', ordem: 1, descricao: 'c' })
    expect(ordenarItens([a, b, c]).map((i) => i.descricao)).toEqual(['c', 'b', 'a'])
  })
  it('manhã e tarde', () => {
    expect(turnoDe('07:30')).toBe('Manhã')
    expect(turnoDe('13:30')).toBe('Tarde')
  })
  it('resumo ignora linhas vazias e repete técnico/veículo uma vez', () => {
    const r = resumoDoDia([
      item({ tecnicos: [2], veiculo: 'G22' }),
      item({ tecnicos: [2, 6], veiculo: 'g22' }),
      item({ descricao: '  ', tecnicos: [9], veiculo: 'ON9' }),
    ])
    expect(r).toEqual({ servicos: 2, tecnicos: 2, veiculos: 1 })
  })
  it('horário do cliente', () => {
    expect(textoHorarioCliente('')).toBe('')
    expect(textoHorarioCliente('9h')).toBe('às 9h')
    expect(textoHorarioCliente('às 12h')).toBe('às 12h')
    expect(horarioForaDoTexto('Vitlog: Rota e LC às 14h', '14h')).toBe('')
    expect(horarioForaDoTexto('Vitlog: Rota', '14h')).toBe('às 14h')
    expect(horarioForaDoTexto('Vitlog: Rota', '')).toBe('')
  })
  it('acha os horários escritos no texto', () => {
    expect(trechosComHorario('Implantação CI CR e LR às 6h')).toEqual([
      { texto: 'Implantação CI CR e LR ', horario: false },
      { texto: 'às 6h', horario: true },
    ])
    expect(trechosComHorario('Rota 9h30 e 14:00, depois')).toEqual([
      { texto: 'Rota ', horario: false },
      { texto: '9h30', horario: true },
      { texto: ' e ', horario: false },
      { texto: '14:00', horario: true },
      { texto: ', depois', horario: false },
    ])
    for (const t of ['SUSEPE 14 e 20', 'Sucção 200lt Fossa', '6CRLR', 'Hotel 5h2o']) {
      expect(trechosComHorario(t).some((x) => x.horario)).toBe(false)
    }
  })
  it('almoço gira pelos três estados', () => {
    expect(proximoAlmoco('fica')).toBe('volta')
    expect(proximoAlmoco('volta')).toBe('nao_se_aplica')
    expect(proximoAlmoco('nao_se_aplica')).toBe('fica')
  })
  it('almoço da linha nova depende da hora', () => {
    expect(almocoPadrao('06:30')).toBe('fica')
    expect(almocoPadrao('13:30')).toBe('nao_se_aplica')
  })
  it('aperta o quadro quando tem muita linha', () => {
    expect(densidade(13)).toBe('normal')
    expect(densidade(16)).toBe('compacta')
    expect(densidade(22)).toBe('apertada')
  })
})

describe('cadastro de técnicos e veículos', () => {
  const base = { criado_em: '', criado_por: null, atualizado_em: '', atualizado_por: null }
  const tecnicos: Tecnico[] = [
    { ...base, numero: 2, nome: 'Wendel', cnh: 'AB', ativo: true },
    { ...base, numero: 11, nome: 'Robson', cnh: 'AB', ativo: false },
  ]
  const veiculos: Veiculo[] = [
    { ...base, codigo: 'S3', placa: 'IWP 1170', tem_sem_parar: false, ativo: true },
    { ...base, codigo: 'CM10', placa: 'IWA 9709', tem_sem_parar: false, ativo: true },
    { ...base, codigo: 'GO6', placa: 'IZE 6A39', tem_sem_parar: true, ativo: true },
    { ...base, codigo: 'ON14', placa: '', tem_sem_parar: false, ativo: false },
  ]
  it('lista os ativos sem Sem Parar, em ordem', () => {
    expect(veiculosSemSemParar(veiculos)).toEqual(['CM10', 'S3'])
  })
  it('avisa técnico e veículo que não estão no cadastro', () => {
    expect(
      conferirComCadastro({ tecnicos: [2, 11, 99], veiculo: 'go6' }, tecnicos, veiculos),
    ).toEqual({
      tecnicosDesconhecidos: [11, 99],
      veiculoDesconhecido: false,
    })
    expect(
      conferirComCadastro({ tecnicos: [], veiculo: 'ON14' }, tecnicos, veiculos)
        .veiculoDesconhecido,
    ).toBe(true)
  })
  it('com o cadastro vazio não reclama', () => {
    expect(conferirComCadastro({ tecnicos: [5], veiculo: 'X1' }, [], [])).toEqual({
      tecnicosDesconhecidos: [],
      veiculoDesconhecido: false,
    })
  })
})
