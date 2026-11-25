import { describe, expect, it } from 'vitest'

import { avisosOrtografia } from './ortografia'

describe('avisosOrtografia', () => {
  it('pega palavra certa no lugar errado', () => {
    expect(avisosOrtografia('Trocado o bloco deteriorado pela humildade')).toEqual([
      { escrito: 'humildade', sugestao: 'umidade' },
    ])
  })

  it('avisa a falta de acento, mas não o que já está certo', () => {
    expect(avisosOrtografia('Nao foi possível, tambem sem acesso ao reservatorio')).toEqual([
      { escrito: 'Nao', sugestao: 'não' },
      { escrito: 'tambem', sugestao: 'também' },
      { escrito: 'reservatorio', sugestao: 'reservatório' },
    ])
    expect(avisosOrtografia('Não foi possível, também já limpo o reservatório')).toEqual([])
  })

  it('não repete e ignora texto vazio', () => {
    expect(avisosOrtografia('humildade e Humildade')).toHaveLength(1)
    expect(avisosOrtografia(null)).toEqual([])
  })
})
