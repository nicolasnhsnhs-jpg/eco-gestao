import { describe, expect, it } from 'vitest'

import { quantasEtapasPragas } from './pragas'
import {
  chaveDose,
  dosesMarcadas,
  escreverDoses,
  lerDose,
  type ProgramaAplicacao,
} from './programas'

describe('produtos programados', () => {
  it('lê a dosagem com calda e alvo', () => {
    expect(lerDose('100ml = 10lts')).toEqual({ qnt: '100ml', calda: '10lts' })
    expect(lerDose(' 33ml = 10lts (mosquitos) ')).toEqual({
      qnt: '33ml',
      calda: '10lts',
      alvo: 'mosquitos',
    })
    expect(lerDose('5ml')).toEqual({ qnt: '5ml' })
    expect(lerDose('   ')).toBeNull()
  })

  it('escreve as doses de volta, uma por linha', () => {
    const texto = '100ml = 10lts\n33ml = 10lts (mosquitos)'
    expect(escreverDoses(texto.split('\n').map((l) => lerDose(l)!))).toBe(texto)
  })

  it('lista só as dosagens marcadas', () => {
    const programa: ProgramaAplicacao = {
      id: 'g',
      titulo: 'Profilaxia',
      produtos: [
        {
          id: 'ddvp',
          nome_comercial: 'DDVP',
          principio_ativo: 'Diclorvós',
          diluente: 'H²O',
          procedimento: '(Atom.)',
          doses: [
            { qnt: '100ml', calda: '10lts' },
            { qnt: '150ml', calda: '15lts' },
          ],
        },
      ],
    }
    const marcadas = dosesMarcadas(programa, { doses: [chaveDose('ddvp', 1)] })
    expect(marcadas.map((m) => m.texto)).toEqual(['DDVP (Diclorvós): 150ml em 15lts H²O · (Atom.)'])
    expect(dosesMarcadas(programa, undefined)).toEqual([])
  })
})

describe('etapas do controle de pragas', () => {
  it('conta a etapa de feromônio e moscas quando há esses pontos', () => {
    const os = { escopo: { subtipo: 'insetos_roedores' } }
    expect(quantasEtapasPragas(os, [{ tipo: 'porta_isca' }])).toBe(4)
    expect(
      quantasEtapasPragas(os, [
        { tipo: 'armadilha_luminosa' },
        { tipo: 'feromonio' },
        { tipo: 'armadilha_moscas' },
      ]),
    ).toBe(6)
  })
})
