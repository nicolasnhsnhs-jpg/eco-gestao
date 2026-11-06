import { describe, expect, it } from 'vitest'

import { UNIDADES } from '@/lib/unidade'

import {
  arquivoHtm,
  comDDI,
  gerarAssinatura,
  nomeArquivoHtm,
  PADRAO_ASSINATURA,
  padraoDaUnidade,
  urlInstagram,
} from './gerarAssinatura'

const dados = {
  ...PADRAO_ASSINATURA,
  nome: 'Maria Silva',
  cargo: 'Comercial',
  telefone: '48 3333-4444',
  whatsapp: '(48) 99999-8888',
}

describe('gerarAssinatura', () => {
  it('cria os links de telefone, WhatsApp, e-mail, site e Instagram', () => {
    const html = gerarAssinatura(dados)
    expect(html).toContain('href="tel:+554833334444"')
    expect(html).toContain('href="https://wa.me/5548999998888"')
    expect(html).toContain('href="mailto:adm@ecoambientalsc.com.br"')
    expect(html).toContain('href="https://ecoambientalsc.com.br"')
    expect(html).toContain('href="https://www.instagram.com/ecoambientalsc/"')
  })

  it('esconde telefone e WhatsApp quando estão em branco', () => {
    const html = gerarAssinatura({ ...dados, telefone: '', whatsapp: ' ' })
    expect(html).not.toContain('ic-telefone.png')
    expect(html).not.toContain('ic-whatsapp.png')
  })

  it('usa as imagens públicas do site, com endereço completo', () => {
    const srcs = [...gerarAssinatura(dados).matchAll(/src="([^"]+)"/g)].map((m) => m[1])
    expect(srcs.length).toBeGreaterThan(0)
    for (const src of srcs)
      expect(src).toMatch(/^https:\/\/ecoambientalsc\.com\.br\/assinatura\/img\//)
  })

  it('não deixa o texto digitado virar HTML', () => {
    const html = gerarAssinatura({ ...dados, nome: '<script>x</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('pula serviços vazios e destaca os anos no rodapé', () => {
    const html = gerarAssinatura({
      ...dados,
      servicos: [
        { icone: 'rato', texto: 'Desratização' },
        { icone: 'check', texto: '  ' },
      ],
    })
    expect(html.match(/sv-/g)).toHaveLength(1)
    expect(html).toContain('<b style="color:#8fd13f;">22 anos</b>')
  })

  it('só usa tabelas e CSS inline', () => {
    const html = gerarAssinatura(dados)
    expect(html).not.toMatch(/<style|<div|display:\s*(flex|grid)/i)
  })
})

describe('padraoDaUnidade', () => {
  it('SC e RS vêm com o site, o Instagram e o e-mail de cada unidade', () => {
    const sc = padraoDaUnidade(UNIDADES.sc)
    const rs = padraoDaUnidade(UNIDADES.rs)
    expect([sc.site, sc.instagram, sc.email]).toEqual([
      'ecoambientalsc.com.br',
      '@ecoambientalsc',
      'adm@ecoambientalsc.com.br',
    ])
    expect([rs.site, rs.instagram, rs.email]).toEqual([
      'ecoambientalrs.com.br',
      '@ecoambientalrs',
      'atendimento@ecoambientalrs.com.br',
    ])
    expect(JSON.stringify(rs)).not.toMatch(/ecoambientalsc/)
  })

  it('cada chamada devolve uma lista nova (editar não muda o padrão)', () => {
    const a = padraoDaUnidade(UNIDADES.rs)
    a.servicos[0].texto = 'x'
    expect(padraoDaUnidade(UNIDADES.rs).servicos[0].texto).toBe('Desinsetização')
  })
})

describe('utilidades', () => {
  it('põe o DDI 55 só quando falta', () => {
    expect(comDDI('48 99999-8888')).toBe('5548999998888')
    expect(comDDI('+55 48 99999-8888')).toBe('5548999998888')
  })

  it('aceita Instagram com @, sem @ ou com o link inteiro', () => {
    expect(urlInstagram('@eco')).toBe('https://www.instagram.com/eco/')
    expect(urlInstagram('eco')).toBe('https://www.instagram.com/eco/')
    expect(urlInstagram('https://instagram.com/eco')).toBe('https://instagram.com/eco')
  })

  it('arquivo .htm tem BOM e charset UTF-8; nome sem caracteres proibidos', () => {
    expect(arquivoHtm(dados).startsWith('﻿<!DOCTYPE html>')).toBe(true)
    expect(arquivoHtm(dados)).toContain('charset=utf-8')
    expect(nomeArquivoHtm('Ana/Paula: "Vendas"')).toBe('Eco Ambiental SC - AnaPaula Vendas.htm')
  })
})
