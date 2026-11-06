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
      responsavelSuccao: null,
    },
  },
  rs: {
    nome: 'Eco Ambiental RS',
    uf: 'RS',
    cidade: 'Esteio',
    dominioOperador: 'op.ecoambientalrs.com.br',
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
      responsavelSuccao: { nome: 'BARBARA EHLERS FRANKE DE OLIVEIRA', registro: 'L.O. 02663/25' },
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
