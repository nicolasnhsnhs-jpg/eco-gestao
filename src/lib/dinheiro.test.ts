import { describe, expect, it } from 'vitest'

import { formatarReais, lerValor, mascaraValor, valorParaCampo } from './dinheiro'
import { formatarData, formatarMes, hojeISO, somarMeses } from './datas'

describe('dinheiro', () => {
  it('formata em reais', () => {
    expect(formatarReais(1234.5)).toBe('R$ 1.234,50')
    expect(formatarReais('80')).toBe('R$ 80,00')
    expect(formatarReais(null)).toBe('R$ 0,00')
  })

  it('lê o que foi digitado', () => {
    expect(lerValor('1.234,56')).toBe(1234.56)
    expect(lerValor('R$ 80')).toBe(80)
    expect(lerValor('12,5')).toBe(12.5)
    expect(lerValor('abc')).toBeNull()
    expect(lerValor('')).toBeNull()
  })

  it('formata enquanto digita, com centavos', () => {
    expect(mascaraValor('5')).toBe('0,05')
    expect(mascaraValor('123456')).toBe('1.234,56')
    expect(mascaraValor('R$ 0012,00')).toBe('12,00')
    expect(valorParaCampo(1500)).toBe('1.500,00')
  })
})

describe('datas sem hora', () => {
  it('não muda o dia por causa do fuso horário', () => {
    expect(formatarData('2026-10-01')).toBe('01/10/2026')
  })

  it('usa a data de Brasília (23h em Brasília ainda é o mesmo dia)', () => {
    // 29/10 às 01:30 UTC = 28/10 às 22:30 em Brasília
    expect(hojeISO(new Date('2026-10-29T01:30:00Z'))).toBe('2026-10-28')
  })

  it('mostra o mês como na planilha', () => {
    expect(formatarMes('2026-05-01')).toBe('mai/2026')
    expect(formatarMes('2026-10-01')).toBe('out/2026')
  })

  it('soma meses virando o ano', () => {
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15')
  })
})
