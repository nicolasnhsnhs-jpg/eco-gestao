import { describe, expect, it, vi } from 'vitest'

import { esquecerArquivoNoRascunho, lerRascunho, mesclarComRascunho } from './rascunho'

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

describe('esquecerArquivoNoRascunho', () => {
  it('a assinatura descartada sai do rascunho, o resto fica', () => {
    const guardado = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => guardado.set(k, v),
      removeItem: (k: string) => guardado.delete(k),
    })
    localStorage.setItem(
      'eco-os-rascunho-os1',
      JSON.stringify({
        campos: { resultado: 'ok', assinatura_cliente_id: 'a1', assinatura_operador_id: 'a2' },
        pendente: true,
      }),
    )
    esquecerArquivoNoRascunho('os1', 'a2')
    expect(lerRascunho('os1')).toEqual({
      campos: { resultado: 'ok', assinatura_cliente_id: 'a1', assinatura_operador_id: null },
      pendente: true,
    })
    vi.unstubAllGlobals()
  })
})
