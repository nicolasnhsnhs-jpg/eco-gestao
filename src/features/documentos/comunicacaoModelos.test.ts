import { describe, expect, it } from 'vitest'

import {
  conteudoDoModelo,
  dataPorExtenso,
  itensDaSecao,
  lerConteudo,
  limparConteudo,
  MODELOS_COMUNICACAO,
  modeloComunicacao,
  preencher,
} from './comunicacaoModelos'

describe('comunicação de serviço', () => {
  it('data por extenso, com o dia da semana', () => {
    expect(dataPorExtenso('2026-08-06')).toBe('06 de agosto de 2026 (quinta-feira)')
    expect(dataPorExtenso('2026-03-10')).toBe('10 de março de 2026 (terça-feira)')
  })

  it('troca {cliente} e {data} no texto', () => {
    expect(
      preencher('No {cliente}, dia {data}.', { cliente: 'Giardino', data: '2026-11-10' }),
    ).toBe('No Giardino, dia 10 de novembro de 2026 (terça-feira).')
  })

  it('cada linha é um item, sem o marcador colado', () => {
    expect(itensDaSecao('. Guardar utensílios;\n\n- Proteger alimentos\n2. Ventilar')).toEqual([
      'Guardar utensílios;',
      'Proteger alimentos',
      'Ventilar',
    ])
  })

  it('todo modelo gera um conteúdo que volta igual do banco', () => {
    for (const chave of Object.keys(MODELOS_COMUNICACAO)) {
      const c = limparConteudo(conteudoDoModelo(chave))
      expect(lerConteudo(JSON.parse(JSON.stringify(c)))).toEqual(c)
    }
  })

  it('modelo desconhecido cai no em branco; limpar tira vazios', () => {
    expect(modeloComunicacao('xyz')).toBe(MODELOS_COMUNICACAO.outro)
    const c = limparConteudo({
      ...conteudoDoModelo('outro'),
      secoes: [{ titulo: ' ', texto: '', estilo: 'lista' }],
      tecnicos: [
        { nome: ' Wendel ', rg: '', cpf: '023' },
        { nome: '', rg: '1', cpf: '' },
      ],
    })
    expect(c.secoes).toEqual([])
    expect(c.tecnicos).toEqual([{ nome: 'Wendel', rg: '', cpf: '023' }])
  })

  it('conteúdo velho ou quebrado não derruba a tela', () => {
    const c = lerConteudo({ secoes: [{ texto: 'x', estilo: 'xx' }], tecnicos: 'nada' })
    expect(c.secoes).toEqual([{ titulo: '', texto: 'x', estilo: 'lista' }])
    expect(c.tecnicos).toEqual([])
  })
})
