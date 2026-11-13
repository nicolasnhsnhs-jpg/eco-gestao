import { describe, expect, it } from 'vitest'

import { juntarEmails } from './emails'

describe('juntarEmails', () => {
  it('separa com ponto e vírgula e espaço, como o Outlook pede', () => {
    expect(juntarEmails(['a@x.com', 'b@y.com', 'c@z.com'])).toBe('a@x.com; b@y.com; c@z.com')
  })

  it('ignora vazios e tira espaços', () => {
    expect(juntarEmails([null, ' a@x.com ', '', undefined, 'b@y.com'])).toBe('a@x.com; b@y.com')
  })
})
