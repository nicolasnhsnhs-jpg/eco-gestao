import { describe, expect, it } from 'vitest'

import { nomesDosAnexos } from '../../../supabase/functions/_shared/nomesAnexos'

describe('nome dos anexos do e-mail da nota', () => {
  it('usa o nome do arquivo que o financeiro anexou', () => {
    expect(
      nomesDosAnexos([
        { nomeOriginal: 'NFSe 4477.pdf', padrao: 'NF 4477.pdf' },
        { nomeOriginal: 'BL4477.pdf', padrao: 'Boleto NF 4477.pdf' },
        { nomeOriginal: 'BL4477-2', padrao: 'Boleto 2 NF 4477.pdf' },
      ]),
    ).toEqual(['NFSe 4477.pdf', 'BL4477.pdf', 'BL4477-2.pdf'])
  })

  it('sem nome salvo usa o padrão; nome repetido ganha número', () => {
    expect(
      nomesDosAnexos([
        { nomeOriginal: null, padrao: 'NF 10.pdf' },
        { nomeOriginal: 'C:\\Boletos\\boleto.pdf', padrao: 'Boleto 1 NF 10.pdf' },
        { nomeOriginal: 'BOLETO.PDF', padrao: 'Boleto 2 NF 10.pdf' },
      ]),
    ).toEqual(['NF 10.pdf', 'boleto.pdf', 'BOLETO (2).PDF'])
  })
})
