import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('idb-keyval', () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
}))

const { ordemDeEnvio } = await import('./fila')

describe('ordemDeEnvio', () => {
  it('a conclusão vai depois das anotações feitas depois dela', () => {
    const fila = [
      { tipo: 'pontos', osId: 'a', n: 1 },
      { tipo: 'concluir', osId: 'a', n: 2 },
      { tipo: 'pontos', osId: 'a', n: 3 },
      { tipo: 'arquivo', osId: 'a', n: 4 },
    ]
    expect(ordemDeEnvio(fila).map((i) => i.n)).toEqual([1, 3, 4, 2])
  })

  it('sem conclusão, mantém a ordem de chegada', () => {
    const fila = [
      { tipo: 'iniciar', osId: 'a', n: 1 },
      { tipo: 'pontos', osId: 'a', n: 2 },
      { tipo: 'pontos', osId: 'b', n: 3 },
    ]
    expect(ordemDeEnvio(fila).map((i) => i.n)).toEqual([1, 2, 3])
  })
})

describe('ehErroDeLogin', () => {
  it('reconhece envio sem login (permission denied / token vencido)', async () => {
    const { ehErroDeLogin } = await import('./fila')
    expect(ehErroDeLogin({ code: '42501', message: 'permission denied for table os_pontos' })).toBe(
      true,
    )
    expect(ehErroDeLogin('permission denied for table os_pontos')).toBe(true)
    expect(ehErroDeLogin({ code: 'PGRST301', message: 'JWT expired' })).toBe(true)
  })

  it('não confunde com recusa das regras do banco', async () => {
    const { ehErroDeLogin } = await import('./fila')
    expect(
      ehErroDeLogin({ code: '42501', message: 'Somente o escritório muda as ocorrências.' }),
    ).toBe(false)
    expect(ehErroDeLogin({ code: '23514', message: 'Faltam: assinatura do cliente' })).toBe(false)
    expect(ehErroDeLogin(null)).toBe(false)
  })
})
