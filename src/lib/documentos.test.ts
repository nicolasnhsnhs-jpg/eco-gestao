import { describe, expect, it } from 'vitest'

import {
  cnpjValido,
  cpfValido,
  formatarCep,
  formatarCnpj,
  formatarCpf,
  formatarTelefone,
  limparDocumento,
  telefoneValido,
} from './documentos'

describe('cpfValido', () => {
  it('aceita CPFs válidos, com ou sem pontuação', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('52998224725')).toBe(true)
    expect(cpfValido('111.444.777-35')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('529.982.247-24')).toBe(false)
  })

  it('recusa sequências repetidas e tamanho errado', () => {
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido('1234567890')).toBe(false)
  })
})

describe('cnpjValido', () => {
  it('aceita CNPJs numéricos válidos', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11222333000181')).toBe(true)
  })

  it('aceita o CNPJ alfanumérico (exemplo oficial da Receita Federal)', () => {
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true)
    expect(cnpjValido('12abc34501de35')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false)
    expect(cnpjValido('12.ABC.345/01DE-36')).toBe(false)
  })

  it('recusa sequências repetidas e letras nos dígitos verificadores', () => {
    expect(cnpjValido('00.000.000/0000-00')).toBe(false)
    expect(cnpjValido('12ABC34501DEA5')).toBe(false)
  })
})

describe('formatação', () => {
  it('formata CPF e CNPJ', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatarCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35')
  })

  it('formata enquanto a pessoa digita', () => {
    expect(formatarCpf('5299')).toBe('529.9')
    expect(formatarCnpj('112223')).toBe('11.222.3')
  })

  it('formata telefones fixos e celulares', () => {
    expect(formatarTelefone('4833334444')).toBe('(48) 3333-4444')
    expect(formatarTelefone('48999998888')).toBe('(48) 99999-8888')
  })

  it('formata CEP', () => {
    expect(formatarCep('88130000')).toBe('88130-000')
  })

  it('limpa documentos', () => {
    expect(limparDocumento('12.abc.345/01de-35')).toBe('12ABC34501DE35')
  })
})

describe('telefoneValido', () => {
  it('exige DDD + 8 ou 9 dígitos', () => {
    expect(telefoneValido('(48) 99999-8888')).toBe(true)
    expect(telefoneValido('(48) 3333-4444')).toBe(true)
    expect(telefoneValido('99999-8888')).toBe(false)
  })
})
