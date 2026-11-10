import { describe, expect, it, vi } from 'vitest'

import {
  calcularValidade,
  declaracao,
  fimDoMes,
  lerProdutos,
  linhasDoProduto,
  localEData,
  modeloDoTipo,
  textoDias,
  textoValidadeMeses,
} from './modelos'

describe('modeloDoTipo', () => {
  it('usa o formulário da OS quando ele existe', () => {
    expect(modeloDoTipo({ nome: 'Qualquer', formulario_os: 'pragas' })).toBe('pragas')
    expect(modeloDoTipo({ nome: 'Qualquer', formulario_os: 'coifa' })).toBe('coifa')
  })

  it('reconhece reservatório e sucção pelo nome, com ou sem acento', () => {
    expect(modeloDoTipo({ nome: 'Limpeza de reservatórios', formulario_os: 'generico' })).toBe(
      'reservatorio',
    )
    expect(modeloDoTipo({ nome: 'Sucção de fossa', formulario_os: 'generico' })).toBe('succao')
    expect(modeloDoTipo({ nome: 'Hidrojateamento', formulario_os: 'generico' })).toBe('succao')
    expect(modeloDoTipo({ nome: 'Limpeza de Bebedouros', formulario_os: 'generico' })).toBe(
      'bebedouro',
    )
  })

  it('cai no modelo geral para os outros serviços', () => {
    expect(modeloDoTipo({ nome: 'Limpeza de placas solares', formulario_os: 'generico' })).toBe(
      'geral',
    )
    expect(modeloDoTipo(null)).toBe('geral')
  })
})

describe('validade', () => {
  it('contrato vale até o último dia do mês', () => {
    // Feito em 27/10/2026, semestral → 30/04/2027 (como no certificado da Dipam)
    expect(calcularValidade('2026-10-27', 6, 'contrato')).toBe('2027-04-30')
    expect(calcularValidade('2026-11-04', 6, 'contrato')).toBe('2027-05-31')
    expect(calcularValidade('2026-01-15', 1, 'contrato')).toBe('2026-02-28')
  })

  it('avulso vale até a data exata', () => {
    expect(calcularValidade('2026-09-12', 6, 'avulso')).toBe('2027-03-12')
    expect(calcularValidade('2026-10-30', 3, 'avulso')).toBe('2027-01-30')
  })

  it('sem periodicidade não tem validade', () => {
    expect(calcularValidade('2026-10-27', null, 'contrato')).toBe('')
  })

  it('escreve como nos certificados', () => {
    expect(fimDoMes('2028-02-10')).toBe('2028-02-29')
    expect(textoValidadeMeses(6)).toBe('Validade: 06 meses')
    expect(localEData('Esteio', '2026-10-18')).toBe('Esteio, 18 de Outubro de 2026.')
  })
})

describe('frase de abertura', () => {
  it('um dia ou vários dias', () => {
    expect(textoDias(['2026-10-27'])).toBe('no dia 27/10/2026')
    expect(textoDias(['2026-10-27', '2026-10-21'])).toBe('nos dias 21/10 e 27/10/2026')
    expect(textoDias([])).toBe('')
  })

  it('monta a declaração com cliente e serviço em negrito', () => {
    const partes = declaracao({
      servicoDescrito: 'CONTROLE de INSETOS',
      cliente: 'DIPAM GAÚCHA DISTRIBUIDORA LTDA',
      dias: 'no dia 27/10/2026',
      endereco: 'Rua Simão Kappel, 362 - Navegantes - Porto Alegre/RS',
      documento: '91.222.133/0001-68',
      ehCpf: false,
    })
    expect(partes.filter((p) => p.negrito).map((p) => p.texto)).toEqual([
      'CONTROLE de INSETOS',
      'DIPAM GAÚCHA DISTRIBUIDORA LTDA',
    ])
    expect(partes.map((p) => p.texto).join('')).toBe(
      'Certificamos para os devidos fins que foram realizados os serviços de CONTROLE de INSETOS nas dependências de DIPAM GAÚCHA DISTRIBUIDORA LTDA no dia 27/10/2026, localizada na Rua Simão Kappel, 362 - Navegantes - Porto Alegre/RS, inscrita sob CNPJ nº 91.222.133/0001-68.',
    )
  })
})

describe('produtos', () => {
  it('escreve as duas linhas como no certificado', () => {
    expect(
      linhasDoProduto({
        nome_comercial: '',
        principio_ativo: 'Alfa-Cipermetrina',
        registro: 'MS 304040031',
        quantidade: '100ml',
        lote: '004-24-15600',
        fabricacao: '2024-07-01',
        validade: '2027-07-01',
      }),
    ).toEqual([
      'Alfa-Cipermetrina (MS 304040031) - 100ml',
      'Lote 004-24-15600 - Fab. Jul24 - Val. Jul27',
    ])
  })

  it('deixa a marca de fora: só o princípio ativo', () => {
    expect(
      linhasDoProduto({
        nome_comercial: 'DEVETION',
        principio_ativo: 'Diclorvós',
        registro: 'MS 3.1606.0050.001-9',
        quantidade: '300ml',
        lote: '',
        fabricacao: '',
        validade: '',
      })[0],
    ).toBe('Diclorvós (MS 3.1606.0050.001-9) - 300ml')
  })

  it('ignora produtos vazios ou mal formados', () => {
    expect(
      lerProdutos([{ principio_ativo: 'Gel', quantidade: '10 g' }, { principio_ativo: ' ' }, null]),
    ).toHaveLength(1)
    expect(lerProdutos({})).toEqual([])
  })
})

describe('responsavelDoModelo', () => {
  it('no RS, a coifa usa o outro CRQ da Andréia e a sucção a outra responsável', async () => {
    vi.stubEnv('VITE_UNIDADE', 'rs')
    vi.resetModules()
    const { responsavelDoModelo } = await import('./modelos')
    expect(responsavelDoModelo('pragas').registro).toBe('AFT - CRQ 251319')
    expect(responsavelDoModelo('coifa')).toEqual({
      nome: 'RESP. TÉCNICA: ANDRÉIA S. H. SEMENSATO',
      registro: 'AFT - CRQ 253325',
    })
    expect(responsavelDoModelo('succao').nome).toBe('BARBARA EHLERS FRANKE DE OLIVEIRA')
    vi.unstubAllEnvs()
  })
})
