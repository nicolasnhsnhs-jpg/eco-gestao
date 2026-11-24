import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'

import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

/*
 * E-mails que o sistema mandou ao cliente (tabela emails_enviados, gravada pelas
 * funções de envio). Cada setor consulta os seus na aba "E-mails enviados":
 *   financeiro      nota fiscal e boleto
 *   administrativo  certificado e OS
 *   comercial       proposta (o vendedor vê as dele)
 */

export type SetorEmail = 'financeiro' | 'administrativo' | 'comercial'

export type EmailEnviado = Database['public']['Tables']['emails_enviados']['Row'] & {
  perfil: { nome: string } | null
}

export const NOME_TIPO_EMAIL: Record<string, string> = {
  nota: 'Nota fiscal',
  proposta: 'Proposta',
  certificado: 'Certificado',
  os: 'Ordem de serviço',
  cronograma: 'Cronograma',
}

/** Quantos e-mails a lista carrega de cada vez. */
export const EMAILS_POR_PAGINA = 50

/** "João  da Silva" → "joao da silva" (como a coluna busca, feita no banco). */
export function textoDeBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Os mais recentes primeiro; com busca, só os que têm o texto (cliente, e-mail, número). */
export function useEmailsEnviados(setor: SetorEmail, busca: string) {
  const termo = textoDeBusca(busca)
  return useInfiniteQuery({
    queryKey: ['emails-enviados', setor, termo],
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let consulta = supabase
        .from('emails_enviados')
        .select('*, perfil:perfis!emails_enviados_enviado_por_fkey(nome)')
        .eq('setor', setor)
      // Cada palavra precisa aparecer (em qualquer ordem): "padaria 123".
      for (const palavra of termo.split(' ').filter(Boolean))
        consulta = consulta.ilike('busca', `%${palavra.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
      const { data, error } = await consulta
        .order('enviado_em', { ascending: false })
        .order('id')
        .range(pageParam, pageParam + EMAILS_POR_PAGINA - 1)
      if (error) throw error
      return data as EmailEnviado[]
    },
    getNextPageParam: (ultima, paginas) =>
      ultima.length < EMAILS_POR_PAGINA ? undefined : paginas.length * EMAILS_POR_PAGINA,
  })
}
