import { describe, expect, it } from 'vitest'

import { juntarEmails, separarEmails } from './emails'

describe('juntarEmails', () => {
  it('separa com ponto e vírgula e espaço, como o Outlook pede', () => {
    expect(juntarEmails(['a@x.com', 'b@y.com', 'c@z.com'])).toBe('a@x.com; b@y.com; c@z.com')
  })

  it('ignora vazios e tira espaços', () => {
    expect(juntarEmails([null, ' a@x.com ', '', undefined, 'b@y.com'])).toBe('a@x.com; b@y.com')
  })
})

describe('separarEmails', () => {
  it('aceita ; vírgula e espaço, minúsculo e sem repetir', () => {
    expect(separarEmails('A@x.com; b@y.com, a@x.com  c@z.com.br')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com.br',
    ])
    expect(separarEmails(null)).toEqual([])
    expect(separarEmails('sem email')).toEqual([])
  })
  it('volta no padrão do Outlook', () => {
    expect(juntarEmails(separarEmails('a@x.com,b@y.com'))).toBe('a@x.com; b@y.com')
  })
})
