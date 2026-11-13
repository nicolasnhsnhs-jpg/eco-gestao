import { describe, expect, it } from 'vitest'

import {
  densidade,
  escalaDoTecnico,
  lerEscalas,
  lerPlacas,
  lerTecnicos,
  ordenarItens,
  partesDaDescricao,
  comValorNaParte,
  compararVeiculos,
  escalasDoDia,
  marcarAusencia,
  presencaDoMes,
  parteDaLinha,
  textoDaTaxa,
  alternarAvulso,
  coresDasEscalas,
  almocoPadrao,
  estadoR,
  estaFaturado,
  proximoR,
  proximoF,
  resumoConferencia,
  servicosDaLinha,
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
    nota_parte: null,
    chegada_parte: 0,
    horarios: [],
    notas: [],
    taxa: '',
    taxa_motivo: '',
    taxa_parte: null,
    avulso: false,
    avulso_partes: [],
    viagem: null,
    horario_cliente: false,
    chegada: '',
    tecnicos: [],
    veiculo: '',
    almoco: 'fica',
    realizado: false,
    faturado: false,
    realizado_partes: [],
    faturado_partes: [],
    parcial_partes: [],
    motivos_parcial: [],
    criado_em: '2026-11-09T10:00:00Z',
    criado_por: null,
    atualizado_em: '2026-11-09T10:00:00Z',
    atualizado_por: null,
    ...p,
  }
}

describe('coresDasEscalas', () => {
  const e = (n: number) => ({
    inicio: '07:30',
    fim: '17h',
    tecnicos: Array.from({ length: n }, (_, i) => i),
  })
  it('a escala com mais técnicos é a padrão (branca)', () => {
    expect(coresDasEscalas([e(13)])).toEqual(['padrao'])
    expect(coresDasEscalas([e(2), e(11)])).toEqual(['escura', 'padrao'])
    expect(coresDasEscalas([e(9), e(3), e(2)])).toEqual(['padrao', 'escura', 'verde'])
  })
})

describe('alternarAvulso', () => {
  it('marca e desmarca cada cliente da linha', () => {
    expect(alternarAvulso([], 1)).toEqual([1])
    expect(alternarAvulso([1], 0)).toEqual([0, 1])
    expect(alternarAvulso([0, 1], 0)).toEqual([1])
  })
})

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
  it('sem ":", cada barra é um cliente (menos a de data)', () => {
    expect(partesDaDescricao('GHC / IBIS/Unimed')).toEqual([
      ['GHC', ''],
      ['IBIS', ''],
      ['Unimed', ''],
    ])
    expect(partesDaDescricao('Reunião 09/11')).toEqual([['Reunião 09/11', '']])
  })
})

describe('parteDaLinha', () => {
  it('só vale um cliente que existe numa linha com vários', () => {
    expect(parteDaLinha(1, 3)).toBe(1)
    expect(parteDaLinha(0, 1)).toBeNull()
    expect(parteDaLinha(3, 3)).toBeNull()
    expect(parteDaLinha(null, 3)).toBeNull()
  })
})

describe('textoDaTaxa', () => {
  it('monta o nome e o motivo', () => {
    expect(textoDaTaxa('Deslocamento', 'serviço não realizado')).toBe(
      'Taxa de deslocamento: serviço não realizado',
    )
    expect(textoDaTaxa('Taxa noturna', '')).toBe('Taxa noturna')
    expect(textoDaTaxa('Sábado', '')).toBe('Taxa de sábado')
    expect(textoDaTaxa('Após o horário', 'saída às 19h')).toBe('Taxa após o horário: saída às 19h')
    expect(textoDaTaxa('', 'cliente ausente')).toBe('Taxa: cliente ausente')
    expect(textoDaTaxa(' ', '')).toBe('')
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
    expect(textoHorarioCliente('ás 14h')).toBe('às 14h')
    expect(horarioForaDoTexto('Atlântica: LC ás 23h', 'às 23h')).toBe('')
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
    expect(veiculosSemSemParar(veiculos)).toEqual(['S3', 'CM10'])
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

describe('horário de cada cliente', () => {
  it('cada cliente com o seu horário', () => {
    expect(comValorNaParte([], 2, '19h')).toEqual(['', '', '19h'])
    expect(comValorNaParte(['8h', '', '19h'], 2, '')).toEqual(['8h'])
    expect(comValorNaParte(['8h'], 1, ' 14h ')).toEqual(['8h', '14h'])
  })
})

describe('compararVeiculos', () => {
  it('pela numeração do código', () => {
    expect(['ON14', 'CM10', 'ON7', 'CM8', 'GO6', 'ON4', 'X'].sort(compararVeiculos)).toEqual([
      'ON4',
      'GO6',
      'ON7',
      'CM8',
      'CM10',
      'ON14',
      'X',
    ])
    expect(['KA21', 'GM22', 'S24'].sort(compararVeiculos)).toEqual(['KA21', 'GM22', 'S24'])
  })
})

describe('falta e folga', () => {
  const dia = { faltas: [7], folgas_simples: [4], folgas: [9], folgas_horas: [3] }
  it('quem faltou ou folgou sai da escala do dia', () => {
    expect(escalasDoDia([{ inicio: '07:30', fim: '17h', tecnicos: [3, 4, 5, 7, 9] }], dia)).toEqual(
      [{ inicio: '07:30', fim: '17h', tecnicos: [5] }],
    )
  })
  it('passar para um tipo tira dos outros', () => {
    expect(marcarAusencia(dia, 'falta', [7, 9])).toEqual({
      faltas: [7, 9],
      folgas_simples: [4],
      folgas: [],
      folgas_horas: [3],
    })
    expect(marcarAusencia(dia, 'folga_horas', [3, 7])).toEqual({
      faltas: [],
      folgas_simples: [4],
      folgas: [9],
      folgas_horas: [3, 7],
    })
  })
  it('conta presença, falta e os tipos de folga no mês', () => {
    const escalas = [{ inicio: '07:30', fim: '17h', tecnicos: [5, 7] }]
    const r = presencaDoMes(
      [
        { data: '2026-11-02', escalas, faltas: [], folgas: [] },
        { data: '2026-11-08', escalas, folgas_simples: [5, 7] },
        { data: '2026-11-03', escalas, faltas: [7], folgas: [] },
        { data: '2026-11-07', escalas, faltas: [], folgas: [5], folgas_horas: [7] },
      ],
      [
        { numero: 5, nome: 'Ana', ativo: true },
        { numero: 7, nome: 'Bia', ativo: true },
        { numero: 9, nome: 'Caio', ativo: true },
      ],
    )
    expect(
      r.map((p) => [
        p.numero,
        p.presencas,
        p.faltas,
        p.folgasSimples,
        p.folgas,
        p.folgasHoras,
        p.semRegistro,
      ]),
    ).toEqual([
      [5, 2, 0, 1, 1, 0, 0],
      [7, 1, 1, 1, 0, 1, 0],
      [9, 0, 0, 0, 0, 0, 4],
    ])
    expect(r[1].dias.falta).toEqual(['2026-11-03'])
    expect(r[1].dias.folga_horas).toEqual(['2026-11-07'])
    expect(r[2].dias.sem_registro).toEqual(['2026-11-02', '2026-11-03', '2026-11-07', '2026-11-08'])
  })
})

describe('conferência por serviço', () => {
  it('cada serviço da linha (separados por "/")', () => {
    expect(servicosDaLinha('GHC: LR / IBIS Caxias: LR e CI geral')).toEqual([
      'GHC: LR',
      'IBIS Caxias: LR e CI geral',
    ])
    expect(servicosDaLinha('Unimed')).toEqual(['Unimed'])
  })
  it('R: vazio → feito → parcial → vazio; a linha só fica realizada com todos feitos', () => {
    let x = item({})
    const aplicar = (i: number) => (x = { ...x, ...proximoR(x, i, 2) })
    aplicar(0)
    expect(estadoR(x, 0, 2)).toBe('feito')
    expect(x.realizado).toBe(false)
    aplicar(1)
    expect(x.realizado).toBe(true)
    aplicar(1)
    expect(estadoR(x, 1, 2)).toBe('parcial')
    expect(x.realizado).toBe(false)
    expect(resumoConferencia(x, 2, 'R')).toBe('parte')
    aplicar(1)
    expect(estadoR(x, 1, 2)).toBe('vazio')
  })
  it('linha antiga marcada inteira vale para todos os serviços', () => {
    const x = item({ realizado: true, faturado: true })
    expect(estadoR(x, 1, 3)).toBe('feito')
    expect(estaFaturado(x, 2, 3)).toBe(true)
    expect(proximoF(x, 1, 3)).toEqual({ faturado_partes: [0, 2], faturado: false })
    expect(resumoConferencia(x, 3, 'F')).toBe('tudo')
  })
})
