import { useQuery } from '@tanstack/react-query'

import { formatarTelefone } from '@/lib/documentos'
import { supabase } from '@/lib/supabase'
import { UNIDADE } from '@/lib/unidade'

import type { ClienteCompleto } from '../../clientes/api'
import type { PropostaCompleta } from '../api'
import { montarDadosPdf, type PropostaBase, type TaxaBase, type VendedorBase } from './dadosPdf'
import { gerarPdfProposta } from './gerarPdfProposta'

/** Nome e telefone do vendedor, para a assinatura do PDF. */
export function useVendedorPdf(id: string | null | undefined) {
  return useQuery({
    queryKey: ['equipe', 'contato', id],
    enabled: !!id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<VendedorBase | null> => {
      const { data, error } = await supabase
        .from('perfis')
        .select('nome, telefone')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { nome: data.nome, telefone: formatarTelefone(data.telefone) || null, email: null }
    },
  })
}

/** A proposta gravada, no formato que o PDF usa. */
export function propostaGravadaParaBase(p: PropostaCompleta): PropostaBase {
  return {
    numero: p.numero,
    tipo: p.tipo,
    contrato_valor_anual: p.contrato_valor_anual == null ? null : Number(p.contrato_valor_anual),
    contrato_parcelas: p.contrato_parcelas,
    data_envio: p.data_envio!,
    validade: p.validade,
    contato_nome: p.contato_nome,
    contato_telefone: p.contato_telefone,
    contato_email: p.contato_email,
    introducao: p.introducao,
    acrescimo_fora_horario:
      p.acrescimo_fora_horario == null ? null : Number(p.acrescimo_fora_horario),
    custos_detalhados: p.custos_detalhados ?? true,
    prazo_pagamento_dias: p.prazo_pagamento_dias,
    condicao_pagamento: p.condicao_pagamento,
    observacoes: p.observacoes,
    itens: p.itens.map((i) => ({
      modelo: i.modelo,
      titulo: i.titulo,
      escopo: i.escopo,
      metodologia: i.metodologia,
      recursos: i.recursos,
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      valor_unitario: Number(i.valor_unitario),
      periodicidade_meses: i.periodicidade_meses,
      frequencia: i.frequencia,
      cobranca: i.cobranca,
      taxas_adicionais: taxasDoItem(i.taxas_adicionais),
    })),
  }
}

export function pdfDaProposta(
  base: PropostaBase,
  cliente: ClienteCompleto | null | undefined,
  enderecoId: string | null | undefined,
  vendedor: VendedorBase | null | undefined,
) {
  return gerarPdfProposta(montarDadosPdf(base, cliente, enderecoId, vendedor))
}

export function nomeArquivoProposta(numero: string | null | undefined, cliente: string) {
  const limpo = cliente
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
  return `Proposta_${numero ?? 'rascunho'}_${limpo || 'cliente'}.pdf`
}

/**
 * Guarda uma cópia do PDF no Google Drive: VENDAS / ano / vendedor / cliente /
 * Proposta <número> - <data de envio>.pdf. Gerar de novo troca a cópia. Falhar aqui não
 * atrapalha quem está usando a proposta.
 */
const enviandoProposta = new Set<string>()

export function copiarPropostaNoDrive(propostaId: string | null, pdf: Blob) {
  // Uma cópia por vez de cada proposta (abrir e clicar em Baixar logo em seguida, por ex.).
  if (!UNIDADE.drive || !propostaId || enviandoProposta.has(propostaId)) return
  enviandoProposta.add(propostaId)
  void (async () => {
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    let texto = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
      texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    await supabase.functions.invoke('drive', {
      body: { acao: 'proposta', propostaId, pdf: btoa(texto) },
    })
  })()
    .catch(() => {})
    .finally(() => enviandoProposta.delete(propostaId))
}

/** As taxas adicionais gravadas no item (jsonb), já como números. */
export function taxasDoItem(taxas: unknown): TaxaBase[] {
  if (!Array.isArray(taxas)) return []
  return taxas
    .map((t: { descricao?: unknown; valor?: unknown }) => ({
      descricao: String(t?.descricao ?? '').trim(),
      valor: Number(t?.valor) || 0,
    }))
    .filter((t) => t.descricao && t.valor > 0)
}
