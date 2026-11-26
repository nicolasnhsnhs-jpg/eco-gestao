import { describe, expect, it } from 'vitest'

import { lerEpis, lerEtapas, limparEtapas, MODELOS_APR, nomeModelo, numeroApr } from './aprModelos'

describe('modelos de APR', () => {
  it('reservatório e coifa têm etapas completas e EPIs', () => {
    for (const m of [MODELOS_APR.reservatorio, MODELOS_APR.coifa]) {
      expect(m.etapas.length).toBeGreaterThan(5)
      for (const e of m.etapas) {
        expect(e.etapa).not.toBe('')
        expect(e.riscos).not.toBe('')
        expect(e.medidas).not.toBe('')
        expect(e.acoes).not.toBe('')
      }
      expect(m.epis.length).toBeGreaterThan(3)
    }
  })

  it('reservatório cobre o espaço confinado (PET, gases, vigia)', () => {
    const tudo = JSON.stringify(MODELOS_APR.reservatorio.etapas)
    expect(tudo).toContain('PET')
    expect(tudo).toContain('O2')
    expect(tudo).toContain('vigia')
  })

  it('coifa cobre o bloqueio de energia e gás', () => {
    const tudo = JSON.stringify(MODELOS_APR.coifa.etapas)
    expect(tudo).toContain('gás')
    expect(tudo).toContain('bloque')
  })
})

describe('lerEtapas', () => {
  it('ignora o que não é etapa e completa campos faltando', () => {
    expect(lerEtapas(null)).toEqual([])
    expect(lerEtapas([null, 3, { etapa: 'Subida', riscos: 1 }])).toEqual([
      { etapa: 'Subida', riscos: '', medidas: '', o_que_pode_dar_errado: '', acoes: '' },
    ])
  })
})

describe('limparEtapas', () => {
  it('tira espaços e etapas vazias', () => {
    const vazia = { etapa: ' ', riscos: '', medidas: '', o_que_pode_dar_errado: '', acoes: '' }
    expect(limparEtapas([vazia, { ...vazia, etapa: ' Descida ' }])).toEqual([
      { ...vazia, etapa: 'Descida' },
    ])
  })
})

describe('outros', () => {
  it('número com dois dígitos e o ano', () => {
    expect(numeroApr({ numero: 7, ano: 2026 })).toBe('07/2026')
    expect(numeroApr({ numero: 128, ano: 2026 })).toBe('128/2026')
  })

  it('EPIs só texto', () => {
    expect(lerEpis(['Capacete', '', 2])).toEqual(['Capacete'])
  })

  it('nome do modelo', () => {
    expect(nomeModelo('coifa')).toBe('Limpeza de coifa')
    expect(nomeModelo('xyz')).toBe('Outro serviço')
  })
})
