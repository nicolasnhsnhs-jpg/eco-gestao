import { describe, expect, it } from 'vitest'

import { etapaDaPendencia, horariosForaDeOrdem, pendenciasLocais } from './pendencias'

// Os mesmos casos de supabase/tests/os*.sql, para a regra do celular não se
// afastar da regra do banco.

const comum = {
  data: '2026-11-05',
  hora_chegada: '2026-11-05T08:00:00-03:00',
  hora_inicio: '2026-11-05T08:10:00-03:00',
  hora_termino: '2026-11-05T09:00:00-03:00',
  hora_saida: '2026-11-05T09:05:00-03:00',
  operador_nome: 'Operador',
  responsavel_nome: 'Fulana',
  assinatura_cliente_id: 'a',
  assinatura_operador_id: 'b',
}

describe('pendenciasLocais', () => {
  it('OS vazia: lista os campos comuns, na ordem do banco', () => {
    expect(pendenciasLocais('generico', {}, [])).toEqual([
      'data',
      'horário de chegada',
      'horário de início',
      'horário de término',
      'horário de saída',
      'resultado do serviço',
      'nome do operador',
      'visto do operador',
      'nome de quem acompanhou',
      'assinatura de quem acompanhou',
    ])
  })

  it('genérica completa não tem pendências', () => {
    expect(pendenciasLocais('generico', { ...comum, resultado: 'ok' }, [])).toEqual([])
  })

  it('pragas: exige nível e situação de cada armadilha', () => {
    const pontos = [
      { tipo: 'porta_isca', numero: 1, area: 'A' },
      { tipo: 'armadilha_luminosa', numero: 1, area: 'B', situacao_armadilha: null },
    ]
    expect(pendenciasLocais('pragas', comum, pontos)).toEqual([
      'nível de infestação de roedores',
      'situação das armadilhas 1',
    ])
    expect(
      pendenciasLocais('pragas', { ...comum, checklist: { nivel_infestacao: 'B' } }, [
        { ...pontos[1], situacao_armadilha: 'F' },
      ]),
    ).toEqual([])
  })

  it('coifa: liberação, sujidade, produto e conferência final', () => {
    const coifas = [
      { tipo: 'coifa', numero: 1, area: 'Coifa do fogão', sujidade: null },
      { tipo: 'coifa', numero: 2, area: 'Coifa do forno', sujidade: null },
    ]
    expect(pendenciasLocais('coifa', comum, coifas)).toEqual([
      'liberação para trabalho',
      'condições do ambiente',
      'escoamento do piso',
      'sujidade de: Coifa do fogão, Coifa do forno',
      'quantidade de produto',
      'conferência final com o cliente',
    ])
    const sim = { sim: true }
    const checklist = {
      liberacao: {
        area_isolada: sim,
        producao_livre: sim,
        pintada: { sim: false },
        risco_pintura: { sim: false },
        equipamentos_desligados: sim,
        motor_desligado: sim,
        gas_fechado: sim,
        condicoes: 'LE',
        escoamento: 'eficiente',
      },
      produto_ml: 3000,
      conferencia: { limpeza_eficiente: sim, equipamentos_religados: sim, ambiente_liberado: sim },
    }
    expect(
      pendenciasLocais(
        'coifa',
        { ...comum, checklist },
        coifas.map((c) => ({ ...c, sujidade: 'B' })),
      ),
    ).toEqual([])
  })
})

describe('horariosForaDeOrdem', () => {
  it('em ordem (ou no mesmo minuto) está certo', () => {
    expect(horariosForaDeOrdem(comum)).toBeNull()
    expect(
      horariosForaDeOrdem({
        hora_chegada: '2026-11-05T08:00:00-03:00',
        hora_inicio: '2026-11-05T08:00:00-03:00',
      }),
    ).toBeNull()
  })

  it('aponta o horário que ficou antes do anterior', () => {
    expect(horariosForaDeOrdem({ ...comum, hora_inicio: '2026-11-05T07:50:00-03:00' })).toBe(
      'o início (07:50) está antes da chegada (08:00)',
    )
  })

  it('segundos a mais na chegada também contam (como no banco)', () => {
    expect(
      horariosForaDeOrdem({
        hora_chegada: '2026-11-05T11:00:35Z',
        hora_inicio: '2026-11-05T08:00:00-03:00',
      }),
    ).not.toBeNull()
  })

  it('compara com o último horário preenchido, pulando os vazios', () => {
    expect(
      horariosForaDeOrdem({
        hora_chegada: '2026-11-05T08:00:00-03:00',
        hora_saida: '2026-11-05T07:00:00-03:00',
      }),
    ).toBe('a saída (07:00) está antes da chegada (08:00)')
  })
})

describe('etapaDaPendencia', () => {
  it('toda pendência leva a uma etapa da tela', () => {
    const pontos = [
      { tipo: 'armadilha_luminosa', numero: 1, area: 'Depósito' },
      { tipo: 'coifa', numero: 1, area: 'Cozinha' },
    ]
    const todas = (['generico', 'pragas', 'coifa'] as const).flatMap((f) =>
      pendenciasLocais(f, {}, pontos),
    )
    expect(todas.length).toBeGreaterThan(15)
    for (const p of todas) expect(etapaDaPendencia(p), p).not.toBeNull()
  })

  it('aponta a etapa certa', () => {
    expect(etapaDaPendencia('horário de saída')).toBe('Chegada e horários')
    expect(etapaDaPendencia('assinatura de quem acompanhou')).toBe('Quem acompanhou (cliente)')
    expect(etapaDaPendencia('visto do operador')).toBe('Operador')
    expect(etapaDaPendencia('sujidade de: Cozinha')).toBe('Coifas')
    expect(etapaDaPendencia('situação das armadilhas 1, 2')).toBe('Armadilhas luminosas')
  })
})
