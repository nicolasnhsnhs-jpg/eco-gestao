/**
 * Dados de cada unidade da Eco Ambiental. O código é o mesmo para todas; cada site na
 * Netlify escolhe a sua com a variável VITE_UNIDADE ("sc" ou "rs") e usa o seu próprio
 * projeto no Supabase, então os dados de uma unidade nunca aparecem na outra.
 */
export const UNIDADES = {
  sc: {
    nome: 'Eco Ambiental SC',
    uf: 'SC',
    cidade: 'Palhoça',
    /** Operadores entram com um login curto (ex.: "joao"), que vira joao@<este domínio>. */
    dominioOperador: 'op.ecoambientalsc.com.br',
    /** Bancos em que o sistema gera boleto (um botão para cada, na nota e em lote). */
    bancosBoleto: ['asaas'],
    /** CRM do WhatsApp (número comercial ligado à Meta). Veja docs/CONFIGURACAO-WHATSAPP.md. */
    crm: true,
    /** Cópia automática dos PDFs no Google Drive (pasta SC). Veja docs/CONFIGURACAO-DRIVE.md. */
    drive: true,
    /**
     * Responsável técnica que assina no final do PDF da OS (a assinatura escaneada é a
     * mesma do certificado, em Administrativo). Sem nome aqui, sai só a assinatura.
     */
    responsavelTecnico: null,
    /** Dados da empresa no rodapé de todas as páginas do PDF da OS. */
    rodape: [
      'Eco Ambiental Serviços Ambientais LTDA · CNPJ 69.636.469/0001-18',
      'Rua Albino Dias, 51 - Caminho Novo, Palhoça/SC - CEP 88132-592 · adm@ecoambientalsc.com.br',
    ],
    /**
     * Certificados de serviço. PROVISÓRIO: ainda não recebemos o modelo de SC;
     * usa o rodapé do PDF da OS e o responsável técnico fica para preencher em cada um.
     */
    certificado: {
      cidade: 'Palhoça',
      email: 'adm@ecoambientalsc.com.br',
      rodape: [
        'Eco Ambiental Serviços Ambientais LTDA',
        'Inscrita sob CNPJ nº 69.636.469/0001-18, com sede na Rua Albino Dias, 51 - Caminho Novo, Palhoça/SC',
      ],
      rodapeSuccao: null,
      responsavel: { nome: '', registro: '' },
      /** Registro do responsável na limpeza de coifa, quando é outro. */
      registroCoifa: null,
      responsavelSuccao: null,
    },
    /**
     * Proposta comercial em PDF. PROVISÓRIO: o modelo veio das propostas do RS; os
     * registros de SC (responsável técnico, alvará, licenças) ainda não foram passados,
     * então essas linhas não aparecem nos recursos até serem preenchidas aqui.
     */
    proposta: {
      cidade: 'Palhoça',
      empresa: 'Eco Ambiental Serviços Ambientais LTDA',
      servicos: [
        'Desinsetização, Desratização',
        "Limpeza e Desinfecção de caixas d'água",
        'Limpeza de coifa de cozinha industrial',
        'Sucção de fossa e caixa de gordura',
        'Desentupimento e hidrojateamento',
      ],
      rodape: [
        'CNPJ nº 69.636.469/0001-18, com sede na Rua Albino Dias, 51 - Caminho Novo, Palhoça/SC - CEP 88132-592',
        'adm@ecoambientalsc.com.br',
      ],
      responsavel: null,
      alvara: null,
      licencaSaude: null,
      normas: [],
      succao: null,
      acrescimoPadrao: 480,
    },
    /** Dados que já vêm preenchidos no gerador de assinatura de e-mail (Administrativo). */
    assinatura: {
      email: 'adm@ecoambientalsc.com.br',
      site: 'ecoambientalsc.com.br',
      instagram: '@ecoambientalsc',
      rodape1: 'Há mais de 22 anos atuando com',
      servicos: [
        { icone: 'inseto', texto: 'Desinsetização' },
        { icone: 'rato', texto: 'Desratização' },
        { icone: 'caixa', texto: "Limpeza e Desinfecção de Caixas d'Água" },
        { icone: 'succao', texto: 'Sucção de Fossa e Caixa de Gordura' },
        { icone: 'desentupimento', texto: 'Desentupimento' },
        { icone: 'jato', texto: 'Hidrojateamento' },
        { icone: 'coifa', texto: 'Limpeza de Coifas' },
        { icone: 'placa', texto: 'Limpeza de Placas' },
      ],
    },
  },
  rs: {
    nome: 'Eco Ambiental RS',
    uf: 'RS',
    cidade: 'Esteio',
    dominioOperador: 'op.ecoambientalrs.com.br',
    bancosBoleto: ['asaas', 'sicredi'],
    /** Sem número de WhatsApp ligado nesta unidade: o CRM não aparece. */
    crm: false,
    /** Cópia automática dos PDFs no Google Drive (pasta RS), além do servidor próprio. */
    drive: true,
    responsavelTecnico: {
      nome: 'Andréia S. H. Semensato',
      registro: 'CRQ Nº 05407339 - 5ª Região',
    },
    rodape: [
      'Eco-Ambiental Controle de Pragas e Higienização Ltda · CNPJ 07.125.516/0001-01',
      'Rua Santo Ângelo, 136 - Olímpica, Esteio/RS · Fone/Fax (51) 3458-4133 · atendimento@ecoambientalrs.com.br',
      'Resp. Técnica: Andréia S. H. Semensato - CRQ Nº 05407339 - 5ª Região · Centro de Informações Toxicológicas (CIT/24 horas): 0800 721 3000',
    ],
    /** Certificados de serviço (dados tirados dos modelos em PowerPoint usados hoje). */
    certificado: {
      cidade: 'Esteio',
      email: 'atendimento@ecoambientalrs.com.br',
      rodape: [
        'Eco-Ambiental Controle de Pragas e Higienização Ltda',
        'Inscrita sob CNPJ nº 07.125.516/0001-01, com sede na Rua Santo Ângelo, 136 - Olímpica, Esteio/RS',
        'Fone: (51)3458-4133 - LO FEPAM n° 02481/2022 - Val. 01/08/2027 - Vigilância Sanitária n° 0008 B3',
        'Centro de Informações Toxicológicas - 0800.721.3000',
      ],
      // A sucção tem outra responsável e outra licença.
      rodapeSuccao: [
        'Eco-Ambiental Controle de Pragas e Higienização Ltda',
        'Inscrita sob CNPJ nº 07.125.516/0001-01, com sede na Rua Santo Ângelo, 136 - Olímpica, Esteio/RS',
        'Fone: (51)3458-4133 - Engenheira Química Bárbara Ehlers Franke de Oliveira - CREA-RS: 155822',
        'LO FEPAM n° 02663/25 - Val. 02/07/2030',
      ],
      responsavel: { nome: 'RESP. TÉCNICA: ANDRÉIA S. H. SEMENSATO', registro: 'AFT - CRQ 251319' },
      // Na coifa a Andréia assina com outro CRQ (modelo "LC").
      registroCoifa: 'AFT - CRQ 253325',
      responsavelSuccao: { nome: 'BARBARA EHLERS FRANKE DE OLIVEIRA', registro: 'L.O. 02663/25' },
    },
    /** Proposta comercial em PDF (dados tirados das propostas em Word usadas hoje). */
    proposta: {
      cidade: 'Esteio',
      empresa: 'Eco Ambiental Controle de Pragas e Higienização Ltda.',
      servicos: [
        'Desinsetização, Desratização',
        "Limpeza e Desinfecção de caixas d'água",
        'Limpeza de coifa de cozinha industrial',
        'Sucção de resíduos, Limpeza de Fossa e',
        'Serviços de desentupimento',
      ],
      rodape: [
        'CNPJ nº 07.125.516/0001-01, com sede na Rua Santo Ângelo, 136 - Olímpica, Esteio/RS - Fone: (51) 3458-4133',
        'Licença Sanitária nº 8 B3, Proc. de acordo com RDC nº 622, NR 33 e NR 35 - LO FEPAM nº 02481/2022.',
        'Centro de Informações Toxicológicas - 0800.721.3000',
      ],
      responsavel: 'Andréia S. H. Semensato CRQ-V 05407339',
      alvara: 'Alvará Sanitário sob nº 0008 B3',
      licencaSaude: 'Licença de Saúde nº 68 - Processo sob nº 01.023243.12.0 / POA',
      normas: [
        'Procedimentos editados pela Secretaria Estadual de Saúde - Norma Técnica Estadual 03/88.',
        'Portaria 201/06 de 04 de maio de 2006 da SMS-PMPA, em cumprimento à Norma Técnica 02/07.',
      ],
      // Sucção e hidrojato têm outra responsável e outra licença.
      succao: {
        responsavel: 'Engª. Bárbara Ehlers Franke de Oliveira CREA-RS: 155822',
        licenca: 'LO / Licença de operação sob nº 02663/2025',
      },
      acrescimoPadrao: 480,
    },
    /** Assinatura de e-mail (dados e serviços da assinatura que o RS já usa). */
    assinatura: {
      email: 'atendimento@ecoambientalrs.com.br',
      site: 'ecoambientalrs.com.br',
      instagram: '@ecoambientalrs',
      rodape1: 'Há mais de 22 anos atuando com',
      servicos: [
        { icone: 'inseto', texto: 'Desinsetização' },
        { icone: 'rato', texto: 'Desratização' },
        { icone: 'caixa', texto: "Limpeza e Desinfecção de Caixas d'Água" },
        { icone: 'succao', texto: 'Sucção de Resíduos' },
        { icone: 'jato', texto: 'Hidrojateamento' },
        { icone: 'desentupimento', texto: 'Limpeza de Fossa e Desentupimento' },
        { icone: 'coifa', texto: 'Limpeza de Coifas' },
      ],
    },
  },
} as const

export type SiglaUnidade = keyof typeof UNIDADES

export function unidadeDaSigla(sigla: string | undefined) {
  const s = (sigla ?? 'sc').toLowerCase()
  if (!(s in UNIDADES)) throw new Error(`VITE_UNIDADE inválida: "${sigla}". Use "sc" ou "rs".`)
  return UNIDADES[s as SiglaUnidade]
}

export const UNIDADE = unidadeDaSigla(import.meta.env.VITE_UNIDADE)
