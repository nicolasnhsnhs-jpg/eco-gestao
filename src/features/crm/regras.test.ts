import { describe, expect, it } from 'vitest'

import { barraDoPapel, menuDoPapel } from '@/app/navegacao'

import {
  filtrarConversas,
  filtrosDoPapel,
  iniciais,
  nomeDeArquivoSeguro,
  nomeDoContato,
  podeUsarCrm,
  rotuloDoDia,
  telefoneDoWaId,
  telefoneParaCadastro,
} from './regras'

describe('quem usa o CRM', () => {
  const perfil = (papel: 'admin' | 'vendedor' | 'operador', atende = false, ativo = true) => ({
    papel,
    atende_whatsapp: atende,
    ativo,
  })

  it('admin sempre; outros só com a permissão; operador nunca', () => {
    expect(podeUsarCrm(perfil('admin'), true)).toBe(true)
    expect(podeUsarCrm(perfil('vendedor'), true)).toBe(false)
    expect(podeUsarCrm(perfil('vendedor', true), true)).toBe(true)
    expect(podeUsarCrm(perfil('operador', true), true)).toBe(false)
    expect(podeUsarCrm(perfil('admin', false, false), true)).toBe(false)
  })

  it('unidade sem WhatsApp ligado não mostra o CRM', () => {
    expect(podeUsarCrm(perfil('admin'), false)).toBe(false)
  })

  it('o menu só tem "Atendimento" para quem usa o CRM', () => {
    expect(menuDoPapel('admin').map((i) => i.caminho)).not.toContain('/crm')
    expect(menuDoPapel('admin', { crm: true }).map((i) => i.caminho)).toContain('/crm')
    expect(barraDoPapel('vendedor', { crm: true }).map((i) => i.caminho)).toContain('/crm')
    expect(menuDoPapel('operador', { crm: true }).map((i) => i.caminho)).not.toContain('/crm')
  })

  it('primeiro contato e "minhas" só para admin e ADM', () => {
    expect(filtrosDoPapel('administrativo')).toContain('primeiro_contato')
    expect(filtrosDoPapel('admin')).toContain('primeiro_contato')
    expect(filtrosDoPapel('vendedor')).not.toContain('primeiro_contato')
    expect(filtrosDoPapel('financeiro')).not.toContain('minhas')
  })
})

describe('telefones', () => {
  it('formata o wa_id', () => {
    expect(telefoneDoWaId('5548988608723')).toBe('(48) 98860-8723')
    expect(telefoneDoWaId('554832221234')).toBe('(48) 3222-1234')
    expect(telefoneDoWaId('14155550123')).toBe('+14155550123')
  })

  it('para o cadastro, põe o 9 que a Meta às vezes tira', () => {
    expect(telefoneParaCadastro('554888608723')).toBe('48988608723')
    expect(telefoneParaCadastro('5548988608723')).toBe('48988608723')
    expect(telefoneParaCadastro('554832221234')).toBe('4832221234')
    expect(telefoneParaCadastro('14155550123')).toBe('')
  })
})

describe('nome e iniciais', () => {
  it('prefere o cadastro, depois o perfil do WhatsApp, depois o número', () => {
    const base = { wa_id: '5548988608723', nome_perfil: 'Maria', cliente: null }
    expect(nomeDoContato(base)).toBe('Maria')
    expect(
      nomeDoContato({
        ...base,
        cliente: { nome: 'Restaurante X Ltda', nome_fantasia: 'Restaurante X' },
      }),
    ).toBe('Restaurante X')
    expect(nomeDoContato({ ...base, nome_perfil: null })).toBe('(48) 98860-8723')
  })

  it('iniciais', () => {
    expect(iniciais('Maria da Silva')).toBe('MS')
    expect(iniciais('João')).toBe('JO')
    expect(iniciais('(48) 98860-8723')).toBe('48')
    expect(iniciais('🙂')).toBe('?')
  })
})

describe('filtrarConversas', () => {
  const eu = 'u1'
  const c = (
    id: string,
    status: 'aberta' | 'pendente' | 'finalizada',
    responsavel: string | null,
    naoLidas = 0,
    nome = 'Cliente',
    waId = '5548999990000',
  ) => ({
    id,
    status,
    nao_lidas: naoLidas,
    responsavel_id: responsavel,
    contato: { wa_id: waId, nome_perfil: nome, cliente: null },
  })
  const lista = [
    c('a', 'aberta', null, 2, 'José Antônio'),
    c('b', 'pendente', eu),
    c('c', 'finalizada', eu),
    c('d', 'aberta', 'u2', 0, 'Padaria', '554888601234'),
  ]
  const ids = (f: Parameters<typeof filtrarConversas>[1], busca = '') =>
    filtrarConversas(lista, f, busca, eu).map((x) => x.id)

  it('por situação', () => {
    expect(ids('abertas')).toEqual(['a', 'd'])
    expect(ids('pendentes')).toEqual(['b'])
    expect(ids('finalizadas')).toEqual(['c'])
    expect(ids('nao_lidas')).toEqual(['a'])
    expect(ids('primeiro_contato')).toEqual(['a'])
    expect(ids('minhas')).toEqual(['b'])
    expect(ids('todas')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('busca por nome sem acento e por telefone (com ou sem o 9)', () => {
    expect(ids('todas', 'jose antonio')).toEqual(['a'])
    expect(ids('todas', '988601234')).toEqual(['d'])
    expect(ids('todas', '(48) 8860-1234')).toEqual(['d'])
    expect(ids('todas', 'xyz')).toEqual([])
  })
})

describe('datas e arquivos', () => {
  const agora = new Date(2026, 10, 9, 15, 0)
  it('rótulo do dia', () => {
    expect(rotuloDoDia(new Date(2026, 10, 9, 8, 0).toISOString(), agora)).toBe('Hoje')
    expect(rotuloDoDia(new Date(2026, 10, 8, 23, 0).toISOString(), agora)).toBe('Ontem')
    expect(rotuloDoDia(new Date(2026, 10, 1).toISOString(), agora)).toBe('01 de novembro')
  })

  it('nome de arquivo seguro', () => {
    expect(nomeDeArquivoSeguro('Orçamento final (1).pdf')).toBe('orcamento-final-1-.pdf')
    expect(nomeDeArquivoSeguro('../../etc/passwd')).toBe('..-..-etc-passwd')
    expect(nomeDeArquivoSeguro('###')).toBe('arquivo')
  })
})
