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
  responsavel_setor: 'Manutenção',
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
      'setor de quem acompanhou',
      'assinatura de quem acompanhou',
    ])
  })

  it('quem acompanhou: setor obrigatório, ou "não houve acompanhamento"', () => {
    const semSetor = { ...comum, resultado: 'ok', responsavel_setor: ' ' }
    expect(pendenciasLocais('generico', semSetor, [])).toEqual(['setor de quem acompanhou'])
    const ninguem = {
      ...comum,
      resultado: 'ok',
      responsavel_nome: null,
      responsavel_setor: null,
      assinatura_cliente_id: null,
      sem_acompanhamento: true,
    }
    expect(pendenciasLocais('generico', ninguem, [])).toEqual([])
    expect(etapaDaPendencia('setor de quem acompanhou')).toBe('Quem acompanhou (cliente)')
  })

  it('ocorrência do escritório: só conclui depois de o técnico confirmar', () => {
    const completa = { ...comum, resultado: 'ok' }
    const texto = 'Roedores na expedição'
    expect(pendenciasLocais('generico', completa, [], undefined, texto)).toEqual([
      'confirmação da ocorrência',
    ])
    const confirmada = { ...completa, ocorrencia_resolvida: true }
    expect(pendenciasLocais('generico', confirmada, [], undefined, texto)).toEqual([])
    expect(pendenciasLocais('generico', completa, [], undefined, '  ')).toEqual([])
    expect(etapaDaPendencia('confirmação da ocorrência')).toBe('Ocorrência')
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
      'capturas das armadilhas 1',
    ])
    // Faltando uma espécie ainda não conclui; 0 vale como preenchido.
    expect(
      pendenciasLocais('pragas', { ...comum, checklist: { nivel_infestacao: 'B' } }, [
        { ...pontos[1], situacao_armadilha: 'F', capturas: { M: 3, MQ: 0, MA: 0 } },
      ]),
    ).toEqual(['capturas das armadilhas 1'])
    expect(
      pendenciasLocais('pragas', { ...comum, checklist: { nivel_infestacao: 'B' } }, [
        { ...pontos[1], situacao_armadilha: 'F', capturas: { M: 3, MQ: 0, MA: 0, B: 0 } },
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

  it('bebedouro: preventivo/corretivo, limpeza de cada um e conferência', () => {
    const bebedouros = [
      { tipo: 'bebedouro_garrafao', numero: 1, area: 'Recepção', limpo: null },
      { tipo: 'bebedouro', numero: 2, area: 'Solda', limpo: null },
      { tipo: 'bebedouro', numero: 1, area: 'Montagem', limpo: true },
    ]
    expect(pendenciasLocais('bebedouro', comum, bebedouros)).toEqual([
      'preventivo ou corretivo',
      'limpeza de: Solda, Recepção',
      'conferência com o cliente',
    ])
    const checklist = {
      trabalho: 'preventivo',
      conferencia: {
        todos_limpos: { sim: false, texto: 'Recepção fechada' },
        danificados: { sim: false },
      },
    }
    expect(
      pendenciasLocais(
        'bebedouro',
        { ...comum, checklist },
        bebedouros.map((b) => ({ ...b, limpo: b.limpo ?? false })),
      ),
    ).toEqual([])
    expect(etapaDaPendencia('limpeza de: Solda')).toBe('Bebedouros')
    expect(etapaDaPendencia('preventivo ou corretivo')).toBe('Trabalho a ser realizado')
  })

  it('entrega de telas: liberação e conferência (sem nada da limpeza de coifa)', () => {
    const coifas = [{ tipo: 'coifa', numero: 1, area: 'Coifa do fogão', sujidade: null }]
    expect(pendenciasLocais('telas', comum, coifas)).toEqual([
      'liberação para instalação de telas',
      'conferência com o cliente',
    ])
    const checklist = { autorizado: { sim: true }, instaladas: { sim: false, texto: 'Em uso' } }
    expect(pendenciasLocais('telas', { ...comum, checklist }, coifas)).toEqual([])
    expect(etapaDaPendencia('liberação para instalação de telas')).toBe(
      'Liberação para instalação de telas',
    )
  })

  it('água: procedimento, coleta (com hora) de cada ponto e conservação', () => {
    const pontos = [
      { tipo: 'ponto_coleta', numero: 2, area: 'Cozinha', coletado: true, hora_coleta: null },
      { tipo: 'ponto_coleta', numero: 1, area: 'Reservatório', coletado: null },
      { tipo: 'ponto_coleta', numero: 3, area: 'Portaria', coletado: false },
    ]
    expect(pendenciasLocais('agua', comum, pontos)).toEqual([
      'confirmação do procedimento de coleta',
      'coleta de: Reservatório, Cozinha',
      'conservação das amostras',
    ])
    const checklist = { procedimento: true, refrigeradas: { sim: true } }
    expect(
      pendenciasLocais(
        'agua',
        { ...comum, checklist },
        pontos.map((p) => ({ ...p, coletado: p.coletado ?? true, hora_coleta: '09:10' })),
      ),
    ).toEqual([])
    expect(etapaDaPendencia('coleta de: Cozinha')).toBe('Pontos de coleta')
    expect(etapaDaPendencia('conservação das amostras')).toBe('Amostras')
  })

  it('ar-condicionado: limpezas e fotos de cada aparelho e quantidade de produto', () => {
    const completo = {
      limpeza_serpentina: 'sim',
      limpeza_gabinete: 'sim',
      limpeza_dreno: 'na',
      foto_etiqueta: true,
      fotos_limpeza: false,
    }
    const aparelhos = [
      { tipo: 'ar_condicionado', numero: 12, area: 'Adm', ...completo, limpeza_dreno: null },
      { tipo: 'ar_condicionado', numero: 1, area: 'Comercial', ...completo },
      { tipo: 'ar_condicionado', numero: 3, area: 'TST' },
    ]
    expect(pendenciasLocais('ar_condicionado', comum, aparelhos)).toEqual([
      'ar-condicionado: 03, 12',
      'quantidade de produto',
    ])
    expect(
      pendenciasLocais(
        'ar_condicionado',
        { ...comum, checklist: { produto_ml: 500 } },
        aparelhos.map((a) => ({ ...a, ...completo })),
      ),
    ).toEqual([])
    expect(etapaDaPendencia('ar-condicionado: 03')).toBe('Aparelhos de ar-condicionado')
  })
})

describe('reservatórios', () => {
  it('cada reservatório precisa de limpo sim ou não', () => {
    const pontos = [
      { tipo: 'reservatorio', numero: 2, area: 'Terraço', limpo: null },
      { tipo: 'reservatorio', numero: 1, area: 'Subsolo', limpo: true },
    ]
    expect(pendenciasLocais('reservatorio', comum, pontos)).toEqual(['reservatórios: Terraço'])
    expect(pendenciasLocais('reservatorio', comum, [{ ...pontos[0], limpo: false }])).toEqual([])
    expect(etapaDaPendencia('reservatórios: Terraço')).toBe('Reservatórios')
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
    const semFotos = { exigidas: true, antes: 0, depois: 0 }
    const todas = (['generico', 'pragas', 'coifa'] as const).flatMap((f) =>
      pendenciasLocais(f, {}, pontos, semFotos),
    )
    expect(todas.length).toBeGreaterThan(15)
    for (const p of todas) expect(etapaDaPendencia(p), p).not.toBeNull()
  })

  it('aponta a etapa certa', () => {
    expect(etapaDaPendencia('horário de saída')).toBe('Chegada e horários')
    expect(etapaDaPendencia('foto antes do serviço')).toBe('Chegada e horários')
    expect(etapaDaPendencia('foto após o serviço')).toBe('Relatório fotográfico')
    expect(etapaDaPendencia('assinatura de quem acompanhou')).toBe('Quem acompanhou (cliente)')
    expect(etapaDaPendencia('visto do operador')).toBe('Operador')
    expect(etapaDaPendencia('sujidade de: Cozinha')).toBe('Coifas')
    expect(etapaDaPendencia('situação das armadilhas 1, 2')).toBe('Armadilhas luminosas')
  })
})

describe('fotos de antes e depois', () => {
  it('limpeza só conclui com foto de antes e de depois', () => {
    expect(pendenciasLocais('coifa', comum, [], { exigidas: true, antes: 0, depois: 0 })).toEqual(
      expect.arrayContaining(['foto antes do serviço', 'foto após o serviço']),
    )
    expect(
      pendenciasLocais('generico', { ...comum, resultado: 'ok' }, [], {
        exigidas: true,
        antes: 3,
        depois: 0,
      }),
    ).toEqual(['foto após o serviço'])
    expect(
      pendenciasLocais('generico', { ...comum, resultado: 'ok' }, [], {
        exigidas: true,
        antes: 1,
        depois: 2,
      }),
    ).toEqual([])
  })

  it('controle de pragas (sem a opção) não exige foto', () => {
    const falta = pendenciasLocais(
      'pragas',
      { ...comum, checklist: { nivel_infestacao: 'B' } },
      [],
      { exigidas: false, antes: 0, depois: 0 },
    )
    expect(falta).toEqual([])
  })
})
