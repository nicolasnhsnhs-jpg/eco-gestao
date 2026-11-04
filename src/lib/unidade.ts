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
  },
} as const

export type SiglaUnidade = keyof typeof UNIDADES

export function unidadeDaSigla(sigla: string | undefined) {
  const s = (sigla ?? 'sc').toLowerCase()
  if (!(s in UNIDADES)) throw new Error(`VITE_UNIDADE inválida: "${sigla}". Use "sc" ou "rs".`)
  return UNIDADES[s as SiglaUnidade]
}

export const UNIDADE = unidadeDaSigla(import.meta.env.VITE_UNIDADE)
