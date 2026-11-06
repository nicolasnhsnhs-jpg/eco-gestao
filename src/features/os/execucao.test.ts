import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { somenteEditaveis } = await import('./api')

describe('somenteEditaveis', () => {
  it('tira da gravação os campos que o operador não pode mudar', () => {
    // Rascunho "sujo": a linha inteira do banco junto com o que o operador digitou.
    const rascunho = {
      id: 'x',
      os_id: 'os',
      criado_em: '2026-11-06T12:00:00Z',
      criado_por: 'p',
      atualizado_em: '2026-11-06T12:37:00Z',
      atualizado_por: 'p',
      hora_chegada: '2026-11-06T09:40:00-03:00',
      operador_nome: 'Fulano',
      checklist: { nivel_infestacao: 'B' },
    }
    expect(somenteEditaveis(rascunho as never)).toEqual({
      hora_chegada: '2026-11-06T09:40:00-03:00',
      operador_nome: 'Fulano',
      checklist: { nivel_infestacao: 'B' },
    })
  })

  it('mantém o valor vazio (o operador apagou o campo)', () => {
    expect(somenteEditaveis({ hora_saida: null })).toEqual({ hora_saida: null })
  })
})
