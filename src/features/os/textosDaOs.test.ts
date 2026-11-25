import { describe, expect, it } from 'vitest'

import { textosDaOs } from './textosDaOs'

describe('textosDaOs', () => {
  it('junta os textos livres da execução, do checklist e dos pontos', () => {
    const textos = textosDaOs(
      {
        resultado: 'Trocado o bloco deteriorado pela humildade',
        observacoes: '  ',
        checklist: {
          comentarios_roedores: 'Area externa com mato',
          nivel_infestacao: 'baixo',
          instaladas: { sim: false, texto: 'Fritadeira em uso' },
          autorizado: { sim: true },
        },
      },
      [
        { id: 'p2', numero: 2, area: 'Cozinha', observacao: 'Sem acesso' },
        { id: 'p1', numero: 1, area: 'Portaria', observacao: null },
      ],
    )
    expect(textos.map((t) => [t.rotulo, t.onde])).toEqual([
      ['Resultado do serviço', { tipo: 'execucao', campo: 'resultado' }],
      ['Comentários (roedores)', { tipo: 'checklist', caminho: ['comentarios_roedores'] }],
      ['Instaladas (comentário)', { tipo: 'checklist', caminho: ['instaladas', 'texto'] }],
      ['Obs. do ponto 02 · Cozinha', { tipo: 'ponto', id: 'p2' }],
    ])
  })

  it('sem execução, nada', () => {
    expect(textosDaOs(null, [])).toEqual([])
  })
})
