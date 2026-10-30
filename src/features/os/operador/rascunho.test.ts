import { describe, expect, it } from 'vitest'

import { mesclarComRascunho } from './rascunho'

describe('mesclarComRascunho', () => {
  const doBanco = { resultado: 'do banco', km_chegada: 100 }

  it('sem rascunho, vale o que está no banco', () => {
    expect(mesclarComRascunho(doBanco, null)).toEqual(doBanco)
  })

  it('alterações não enviadas valem mais que o banco', () => {
    const rascunho = { campos: { resultado: 'digitado sem sinal' }, pendente: true }
    expect(mesclarComRascunho(doBanco, rascunho)).toEqual({
      resultado: 'digitado sem sinal',
      km_chegada: 100,
    })
  })

  it('rascunho já enviado é ignorado', () => {
    const rascunho = { campos: { resultado: 'antigo' }, pendente: false }
    expect(mesclarComRascunho(doBanco, rascunho)).toEqual(doBanco)
  })
})
