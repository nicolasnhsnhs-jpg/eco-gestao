import { describe, expect, it } from 'vitest'

import { fechamentoDaFatura, vencimentoDaFatura } from './fatura'

describe('vencimentoDaFatura', () => {
  const fecha5vence12 = { dia_fechamento: 5, dia_vencimento: 12 }
  const fecha25vence5 = { dia_fechamento: 25, dia_vencimento: 5 }

  it('compra antes do fechamento entra na fatura do mês', () => {
    expect(vencimentoDaFatura('2026-11-03', fecha5vence12)).toBe('2026-11-12')
  })

  it('compra no dia do fechamento ou depois vai para a fatura seguinte', () => {
    expect(vencimentoDaFatura('2026-11-05', fecha5vence12)).toBe('2026-12-12')
    expect(vencimentoDaFatura('2026-11-30', fecha5vence12)).toBe('2026-12-12')
  })

  it('vencimento antes do dia do fechamento cai no mês seguinte ao fechamento', () => {
    expect(vencimentoDaFatura('2026-11-10', fecha25vence5)).toBe('2026-12-05')
    expect(vencimentoDaFatura('2026-11-26', fecha25vence5)).toBe('2027-01-05')
  })

  it('vira o ano', () => {
    expect(vencimentoDaFatura('2026-12-20', fecha5vence12)).toBe('2027-01-12')
  })

  it('dia 31 em mês curto usa o último dia', () => {
    const fecha31vence10 = { dia_fechamento: 31, dia_vencimento: 10 }
    // Fevereiro fecha no dia 28: compra no dia 28 já vai para a fatura seguinte.
    expect(vencimentoDaFatura('2027-02-27', fecha31vence10)).toBe('2027-03-10')
    expect(vencimentoDaFatura('2027-02-28', fecha31vence10)).toBe('2027-04-10')
    const fecha20vence31 = { dia_fechamento: 20, dia_vencimento: 31 }
    expect(vencimentoDaFatura('2027-02-10', fecha20vence31)).toBe('2027-02-28')
  })

  it('parcelas vão para as faturas seguintes, mantendo o dia do vencimento', () => {
    const fecha20vence31 = { dia_fechamento: 20, dia_vencimento: 31 }
    expect(vencimentoDaFatura('2027-01-10', fecha20vence31, 0)).toBe('2027-01-31')
    expect(vencimentoDaFatura('2027-01-10', fecha20vence31, 1)).toBe('2027-02-28')
    expect(vencimentoDaFatura('2027-01-10', fecha20vence31, 2)).toBe('2027-03-31')
  })
})

describe('fechamentoDaFatura', () => {
  it('fecha no mesmo mês quando o vencimento é depois do fechamento', () => {
    expect(fechamentoDaFatura('2026-11-12', { dia_fechamento: 5, dia_vencimento: 12 })).toBe(
      '2026-11-05',
    )
  })

  it('fecha no mês anterior quando o vencimento é antes do fechamento', () => {
    expect(fechamentoDaFatura('2027-01-05', { dia_fechamento: 25, dia_vencimento: 5 })).toBe(
      '2026-12-25',
    )
  })
})
