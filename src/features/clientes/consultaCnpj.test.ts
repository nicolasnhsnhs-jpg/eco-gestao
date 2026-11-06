import { describe, expect, it } from 'vitest'

import { completar, deBrasilApi, deCnpjWs, planejarPreenchimento } from './consultaCnpj'
import { CLIENTE_VAZIO, type FormEndereco } from './esquemas'

// Trechos reais das respostas para o CNPJ 91.362.590/0004-09.
const BRASIL_API = {
  cnpj: '91362590000409',
  razao_social: 'SOLAR COMERCIO E AGROINDUSTRIA LTDA',
  nome_fantasia: '',
  descricao_situacao_cadastral: 'ATIVA',
  email: null,
  ddd_telefone_1: '5136385000',
  ddd_telefone_2: '',
  descricao_tipo_de_logradouro: 'RODOVIA',
  logradouro: 'BR 470',
  numero: 'S/N',
  complemento: 'KM 260.3',
  bairro: 'SAO FRANCISCO',
  cep: '95750000',
  municipio: 'SALVADOR DO SUL',
  uf: 'RS',
  codigo_municipio_ibge: 4316501,
}

const CNPJ_WS = {
  razao_social: 'SOLAR COMERCIO E AGROINDUSTRIA LTDA',
  estabelecimento: {
    nome_fantasia: null,
    situacao_cadastral: 'Ativa',
    tipo_logradouro: 'RODOVIA',
    logradouro: 'BR 470',
    numero: 'S/N',
    complemento: 'KM    260.3',
    bairro: 'SAO FRANCISCO',
    cep: '95750000',
    ddd1: '51',
    telefone1: '36385000',
    ddd2: null,
    telefone2: null,
    email: 'Fiscal@GrupoSolar.com.br',
    estado: { sigla: 'RS' },
    cidade: { nome: 'Salvador do Sul', ibge_id: 4316501 },
    inscricoes_estaduais: [
      { inscricao_estadual: '9999999999', ativo: false, estado: { sigla: 'RS' } },
      { inscricao_estadual: '2210006656', ativo: true, estado: { sigla: 'RS' } },
    ],
  },
}

const ENDERECO_VAZIO: FormEndereco = {
  apelido: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: 'Florianópolis',
  uf: 'SC',
  principal: false,
  codigo_ibge: '',
}

describe('deBrasilApi', () => {
  it('converte a resposta da BrasilAPI', () => {
    expect(deBrasilApi(BRASIL_API)).toEqual({
      razao_social: 'SOLAR COMERCIO E AGROINDUSTRIA LTDA',
      nome_fantasia: '',
      situacao: 'ATIVA',
      email: '',
      telefones: ['5136385000'],
      inscricao_estadual: '',
      endereco: {
        cep: '95750-000',
        logradouro: 'RODOVIA BR 470',
        numero: 'S/N',
        complemento: 'KM 260.3',
        bairro: 'SAO FRANCISCO',
        cidade: 'SALVADOR DO SUL',
        uf: 'RS',
        codigo_ibge: '4316501',
      },
    })
  })

  it('não repete o tipo de logradouro e descarta telefone e UF inválidos', () => {
    const d = deBrasilApi({
      ...BRASIL_API,
      descricao_tipo_de_logradouro: 'RUA',
      logradouro: 'RUA GARIBALDI',
      ddd_telefone_1: '123',
      uf: 'EX',
    })
    expect(d.endereco.logradouro).toBe('RUA GARIBALDI')
    expect(d.telefones).toEqual([])
    expect(d.endereco.uf).toBe('')
  })
})

describe('deCnpjWs', () => {
  it('converte a resposta da CNPJ.ws, com e-mail e inscrição estadual ativa', () => {
    const d = deCnpjWs(CNPJ_WS)
    expect(d.email).toBe('fiscal@gruposolar.com.br')
    expect(d.inscricao_estadual).toBe('2210006656')
    expect(d.telefones).toEqual(['5136385000'])
    expect(d.situacao).toBe('ATIVA')
    expect(d.endereco).toMatchObject({
      complemento: 'KM 260.3',
      cidade: 'Salvador do Sul',
      codigo_ibge: '4316501',
    })
  })

  it('completa o que faltou na BrasilAPI', () => {
    const d = completar(deBrasilApi(BRASIL_API), deCnpjWs(CNPJ_WS))
    expect(d.email).toBe('fiscal@gruposolar.com.br')
    expect(d.inscricao_estadual).toBe('2210006656')
    expect(d.endereco.cidade).toBe('Salvador do Sul')
  })
})

describe('planejarPreenchimento', () => {
  const dados = completar(deBrasilApi(BRASIL_API), deCnpjWs(CNPJ_WS))

  it('preenche os campos vazios do cliente e do endereço', () => {
    const plano = planejarPreenchimento(dados, CLIENTE_VAZIO, ENDERECO_VAZIO, ENDERECO_VAZIO)
    expect(plano.cliente).toEqual({
      nome: 'SOLAR COMERCIO E AGROINDUSTRIA LTDA',
      inscricao_estadual: '2210006656',
      email: 'fiscal@gruposolar.com.br',
      telefone: '(51) 3638-5000',
    })
    // A cidade padrão da unidade não conta como digitada.
    expect(plano.endereco).toEqual({
      cep: '95750-000',
      logradouro: 'RODOVIA BR 470',
      numero: 'S/N',
      complemento: 'KM 260.3',
      bairro: 'SAO FRANCISCO',
      cidade: 'Salvador do Sul',
      uf: 'RS',
      codigo_ibge: '4316501',
    })
    expect(plano.conflitos).toEqual([])
  })

  it('celular vai para o WhatsApp', () => {
    const plano = planejarPreenchimento(
      { ...dados, telefones: ['5136385000', '51999998888'] },
      CLIENTE_VAZIO,
    )
    expect(plano.cliente.whatsapp).toBe('(51) 99999-8888')
    expect(plano.cliente.telefone).toBe('(51) 3638-5000')
  })

  it('não troca o que a pessoa digitou: vira conflito', () => {
    const plano = planejarPreenchimento(
      dados,
      { ...CLIENTE_VAZIO, nome: 'Solar Agroindústria', email: 'FISCAL@gruposolar.com.br' },
      { ...ENDERECO_VAZIO, cidade: 'Montenegro', uf: 'RS', numero: '' },
      ENDERECO_VAZIO,
    )
    expect(plano.cliente.nome).toBeUndefined()
    // O e-mail é o mesmo (só muda maiúscula): não é conflito nem precisa trocar.
    expect(plano.cliente.email).toBeUndefined()
    expect(plano.endereco.cidade).toBeUndefined()
    expect(plano.endereco.uf).toBeUndefined()
    expect(plano.endereco.numero).toBe('S/N')
    expect(plano.conflitos.map((c) => [c.campo, c.atual, c.novo])).toEqual([
      ['nome', 'Solar Agroindústria', 'SOLAR COMERCIO E AGROINDUSTRIA LTDA'],
      ['cidade', 'Montenegro', 'Salvador do Sul'],
    ])
  })

  it('sem formulário de endereço (edição), só mexe nos dados do cliente', () => {
    const plano = planejarPreenchimento(dados, CLIENTE_VAZIO)
    expect(plano.endereco).toEqual({})
    expect(plano.cliente.nome).toBe('SOLAR COMERCIO E AGROINDUSTRIA LTDA')
  })
})
