import { describe, expect, it } from 'vitest'

import { juntarProdutos, lerQuantidade, type ProdutoDoCatalogo } from './produtosDaOs'

const catalogo: ProdutoDoCatalogo[] = [
  {
    id: 'ddvp',
    nome_comercial: 'DDVP',
    principio_ativo: 'Diclorvós',
    registro: 'MS 1',
    lote: 'L1',
    fabricacao: '2026-01-01',
    validade: '2028-01-01',
  },
  {
    id: 'fendona',
    nome_comercial: 'FENDONA',
    principio_ativo: 'Alfa-Cipermetrina',
    registro: 'MS 2',
    lote: 'L2',
    fabricacao: '2026-02-01',
    validade: '2028-02-01',
  },
]

describe('produtos da OS no certificado', () => {
  it('lê a quantidade com a unidade', () => {
    expect(lerQuantidade('100 mL')).toEqual({ ml: 100 })
    expect(lerQuantidade('150ml')).toEqual({ ml: 150 })
    expect(lerQuantidade('2 L')).toEqual({ ml: 2000 })
    expect(lerQuantidade('30g')).toEqual({ g: 30 })
    expect(lerQuantidade('5 pts')).toEqual({ un: 5 })
    expect(lerQuantidade('')).toEqual({})
  })

  it('junta produtos utilizados, controle localizado e programas, somando', () => {
    const produtos = juntarProdutos(
      [
        { produtoId: 'fendona', ml: 50 },
        { principio_ativo: 'FENDONA (Alfa-Cipermetrina)', quantidade: '20 mL' },
        { principio_ativo: 'diclorvos', quantidade: '100 mL' },
        { nome_comercial: 'DDVP', principio_ativo: 'Diclorvós', quantidade: '150ml' },
        { principio_ativo: 'Produto sem cadastro', quantidade: '10 g' },
        { principio_ativo: '' },
      ],
      catalogo,
    )
    expect(
      produtos.map((p) => [p.nome_comercial, p.principio_ativo, p.quantidade, p.lote]),
    ).toEqual([
      ['FENDONA', 'Alfa-Cipermetrina', '70 mL', 'L2'],
      ['DDVP', 'Diclorvós', '250 mL', 'L1'],
      ['', 'Produto sem cadastro', '10g', ''],
    ])
  })
})
