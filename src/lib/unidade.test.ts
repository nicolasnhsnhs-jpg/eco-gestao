import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { textoSeguro } from '@/features/os/pdf/gerarPdfOs'
import { cnpjValido } from '@/lib/documentos'

import { UNIDADES, unidadeDaSigla } from './unidade'

describe('unidadeDaSigla', () => {
  it('usa SC quando a variável não foi definida', () => {
    expect(unidadeDaSigla(undefined)).toBe(UNIDADES.sc)
  })

  it('aceita a sigla em maiúsculas ou minúsculas', () => {
    expect(unidadeDaSigla('RS')).toBe(UNIDADES.rs)
    expect(unidadeDaSigla('rs').cidade).toBe('Esteio')
  })

  it('recusa uma unidade que não existe', () => {
    expect(() => unidadeDaSigla('pr')).toThrow('VITE_UNIDADE inválida')
  })

  it('cada unidade tem o seu domínio de login dos operadores', () => {
    expect(UNIDADES.sc.dominioOperador).not.toBe(UNIDADES.rs.dominioOperador)
  })

  it('o rodapé do PDF de cada unidade cabe na largura da página', async () => {
    const pdf = await PDFDocument.create()
    const normal = await pdf.embedFont(StandardFonts.Helvetica)
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
    for (const unidade of Object.values(UNIDADES)) {
      for (const [i, linha] of unidade.rodape.entries()) {
        const fonte = i === 0 ? negrito : normal
        expect(fonte.widthOfTextAtSize(textoSeguro(linha), 7.5)).toBeLessThan(515)
      }
      expect(cnpjValido(unidade.rodape[0].split('CNPJ ')[1])).toBe(true)
    }
  })
})
