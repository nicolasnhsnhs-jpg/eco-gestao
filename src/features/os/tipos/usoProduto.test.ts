import { describe, expect, it } from 'vitest'

import { lerUso, produtoServePara, produtosPara } from './usoProduto'

describe('uso do produto na OS', () => {
  it('"ambos" aparece em roedores, insetos e todos', () => {
    for (const f of ['roedores', 'insetos', 'pragas'] as const)
      expect(produtoServePara('ambos', f)).toBe(true)
  })

  it('só roedores não aparece na lista de insetos e vice-versa', () => {
    expect(produtoServePara('roedores', 'roedores')).toBe(true)
    expect(produtoServePara('roedores', 'insetos')).toBe(false)
    expect(produtoServePara('insetos', 'insetos')).toBe(true)
    expect(produtoServePara('insetos', 'roedores')).toBe(false)
  })

  it('outro serviço (Clorin, DET) nunca aparece nas OS de pragas', () => {
    for (const f of ['roedores', 'insetos', 'pragas'] as const)
      expect(produtoServePara('outros', f)).toBe(false)
  })

  it('lista antiga guardada no celular, sem o campo, conta como "ambos"', () => {
    expect(lerUso(undefined)).toBe('ambos')
    expect(lerUso('xyz')).toBe('ambos')
    expect(produtosPara([{ id: 1 }, { id: 2, uso: 'insetos' }], 'roedores')).toEqual([{ id: 1 }])
  })
})
